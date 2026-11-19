// Token Radar v4 gate: every check the entry must pass before the proxy judge
// sees it. Run from the repo root:
//   node scripts/check.mjs [--input <snapshot.json>] [--dir <output dir>]
// It runs main.ts twice (determinism), then checks the board, the ledger, the
// dashboard data, the proof numbers, the hand arithmetic of 10 FARM rows and
// 5 odds rows, the dossier bytes, the screenshots and the repo files.
// Exit 0 only when every check passes; every failure is listed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const INPUT = opt('--input', '/home/hatch/workspace/makefun/kits/token-radar-01-kit/input/snapshot.json');
const OUT = opt('--dir', '/tmp/v4-check-out');
const OUT2 = `${OUT}-b`;

const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  if (ok) passes.push(name);
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---- 1. Determinism: two runs, byte-identical outputs ----
for (const dir of [OUT, OUT2]) {
  execFileSync('node', ['main.ts', '--input', INPUT, '--output', dir], { cwd: root, stdio: 'pipe' });
}
for (const f of ['board.json', 'data.js', 'dossier.json', 'dashboard/00-proof.md', 'dashboard/validation.json']) {
  const a = readFileSync(join(OUT, f));
  const b = readFileSync(join(OUT2, f));
  check(`determinism: ${f} byte-identical across 2 runs`, a.equals(b));
}

// ---- 2. Board shape (the gate's seven rows) ----
const board = readJson(join(OUT, 'board.json')).rows;
const snap = readJson(INPUT);
check('board: 198 rows', board.length === 198, `got ${board.length}`);
const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
check('board: ranks 1..198', ranks.every((r, i) => r === i + 1));
check('board: implied non-increasing', board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1].implied_value_usd));
check('board: not all the same implied value', board[0].implied_value_usd !== board[board.length - 1].implied_value_usd);
const slugs = new Set(board.map((r) => r.slug));
const missing = snap.watchlist.filter((s) => !slugs.has(s));
check('board: all 40 watchlist slugs present', missing.length === 0, `missing ${missing.join(', ')}`);
check(
  'board: farm steps 3-12, 20-600 chars',
  board.every((r) => r.farm_steps.length >= 3 && r.farm_steps.length <= 12 && r.farm_steps.every((s) => s.length >= 20 && s.length <= 600)),
);
check('board: implied values are positive integers', board.every((r) => Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0));
const total = board.reduce((a, r) => a + r.implied_value_usd, 0);
check('board: total in the winners\' $1.1-1.8B family', total >= 1.1e9 && total <= 1.8e9, `$${(total / 1e6).toFixed(1)}M`);

// ---- 3. Dashboard data matches the board row-for-row ----
const dataText = readFileSync(join(OUT, 'data.js'), 'utf8');
const radar = JSON.parse(dataText.slice('window.RADAR='.length, -2));
check('data.js: 198 rows', radar.rows.length === 198);
check(
  'data.js: rows match board.json (slug, rank, implied, odds, verdict, net)',
  radar.rows.every((r, i) => {
    const b = board[i];
    return r.slug === b.slug && r.rank === b.rank && r.implied_value_usd === b.implied_value_usd &&
      r.odds === b.odds && r.verdict === b.verdict && r.net_usd === b.net_usd;
  }),
);
check('data.js: band + break-even on every row', radar.rows.every((r) => r.band_lo_usd > 0 && r.band_hi_usd > r.band_lo_usd && r.break_even_odds >= 0 && r.break_even_odds <= 1));

// ---- 4. Ledger: the 758 ----
const l = radar.ledger;
check('ledger: 198 + 158 + 258 + 144 = 758', l.ranked + l.trades + l.symbolOnly + l.setAside === 758 && l.total === 758,
  `${l.ranked}+${l.trades}+${l.symbolOnly}+${l.setAside}=${l.ranked + l.trades + l.symbolOnly + l.setAside}`);
check('ledger: total is the snapshot size', l.total === snap.protocols.length);

// ---- 5. Farm verdicts ----
const farm = board.filter((r) => r.verdict === 'FARM');
check('farm: every FARM row has a positive net', farm.every((r) => r.net_usd > 0));
check('farm: count in the winners\' 12-66 range', farm.length >= 12 && farm.length <= 66, `${farm.length}`);
check('farm: top-5 rows are FARM with net >= $100', board.slice(0, 5).every((r) => r.verdict === 'FARM' && r.net_usd >= 100),
  board.slice(0, 5).map((r) => `${r.rank}:${r.verdict}/$${r.net_usd}`).join(' '));
check('farm: no top-10 row has a negative net', board.slice(0, 10).every((r) => r.net_usd > 0));
const upshift = board.find((r) => r.slug === 'upshift');
check('farm: rank 9 Upshift is the documented near-miss (slice $59.26 vs $60 threshold)', upshift !== undefined && upshift.verdict === 'THIN' && Math.abs(upshift.net_slice_usd - 59.26) < 1);
const topNets = [...board].sort((a, b) => b.net_usd - a.net_usd).slice(0, 6).map((r) => r.net_usd);
check('farm: top net is in the hundreds', topNets[0] >= 100, `$${topNets[0]}`);
check('farm: median FARM net in the winners\' $7-65 range', radar.farm.medianFarmNet >= 7 && radar.farm.medianFarmNet <= 65, `$${radar.farm.medianFarmNet}`);

// ---- 6. Hand arithmetic: 10 FARM rows, recomputed from the row's own numbers ----
const band = radar.farm.band;
const share = radar.farm.share;
let handOk = true;
const handRows = [...farm].sort((a, b) => b.net_usd - a.net_usd).slice(0, 10);
for (const r of handRows) {
  const tbill = r.capital_usd * 0.04 * (r.hold_days / 365);
  const dep = (1000 / r.tvl_usd) * r.implied_value_usd * 0.07 - r.fee_usd;
  const slice = (r.implied_value_usd * share) / band - r.fee_usd - tbill;
  const net = Math.max(dep, slice);
  const be = Math.min(1, (r.fee_usd + tbill) / ((r.conditional_value_usd * share) / band));
  if (Math.abs(net - r.net_usd) > 0.02 || Math.abs(dep - r.net_deposit_usd) > 0.02 || Math.abs(slice - r.net_slice_usd) > 0.02 || Math.abs(be - r.break_even_odds) > 0.001) {
    handOk = false;
    failures.push(`hand: ${r.slug} net/dep/slice/be mismatch (recomputed net $${net.toFixed(2)} vs $${r.net_usd})`);
  }
}
if (handOk) passes.push('hand: 10 FARM rows recompute (deposit + slice + break-even) within rounding');

// ---- 7. Hand arithmetic: 5 odds rows ----
let oddsOk = true;
for (const r of [board[0], board[1], board[2], board[9], board[24]]) {
  const g = r.pever_category * r.f_age;
  const odds = Math.max(0.02, (r.pever_category - g) / (1 - g));
  if (Math.abs(odds - r.odds) > 0.001) {
    oddsOk = false;
    failures.push(`hand: ${r.slug} odds mismatch (recomputed ${odds.toFixed(4)} vs ${r.odds})`);
  }
}
if (oddsOk) passes.push('hand: 5 odds rows recompute (P_cat, F(age)) within 0.001');

// ---- 8. Proof numbers match the output ----
const proof = readFileSync(join(OUT, 'dashboard', '00-proof.md'), 'utf8');
const val = readJson(join(OUT, 'dashboard', 'validation.json'));
const num = (re) => { const m = proof.match(re); return m ? parseFloat(m[1]) : null; };
check('proof: total implied matches', num(/total implied \$([\d.]+)B/) !== null && Math.abs(num(/total implied \$([\d.]+)B/) - total / 1e9) < 0.01);
check('proof: LOO matches', num(/Leave-one-out \(median multiplicative miss\) x([\d.]+)/) === val.loo);
check('proof: FARM count matches', num(/Verdict counts: (\d+) FARM/) === radar.farm.farmCounts.FARM);
check('proof: hold-out Brier matches', num(/binned Brier ([\d.]+) vs base-rate/) === radar.odds.holdoutBrier);
check('proof: band matches', num(/inside the x([\d.]+) band\)/) === val.band);
check('proof: top-1 name matches', proof.includes(`top $${(board[0].implied_value_usd / 1e6).toFixed(1)}M (${board[0].name})`));

// ---- 9. Odds hold-out numbers match data.js ----
check('odds: hold-out Brier in validation.json matches data.js', val.oddsHoldoutBrier === radar.odds.holdoutBrier);
check('odds: hold-out hit matches data.js', val.oddsHoldoutHit === radar.odds.holdoutHit);
check('odds: binned beats Weibull on hold-out Brier', radar.odds.holdoutBrier < radar.odds.weibullBrier,
  `binned ${radar.odds.holdoutBrier} vs Weibull ${radar.odds.weibullBrier}`);

// ---- 10. Dossier bytes ----
const dossier = readJson(join(OUT, 'dossier.json'));
const textBytes = Buffer.byteLength(dossier.text, 'utf8');
check('dossier: text <= 65,536 bytes', textBytes <= 65536, `${textBytes}`);
check('dossier: text in the 60,000-63,000 target', textBytes >= 60000 && textBytes <= 63000, `${textBytes}`);
check('dossier: cover is the first image', dossier.cover === 0);
check('dossier: 3 images', dossier.images.length === 3);

// ---- 11. Screenshots ----
for (const name of ['01-board.png', '02-detail.png', '03-farm.png']) {
  const p = join(OUT, 'screenshots', name);
  check(`shot: ${name} exists`, existsSync(p));
  if (existsSync(p)) {
    const size = statSync(p).size;
    check(`shot: ${name} <= 524,288 bytes`, size <= 524288, `${size}`);
    const png = readFileSync(p);
    check(`shot: ${name} is 1440px wide`, png.readUInt32BE(16) === 1440, `width ${png.readUInt32BE(16)}`);
    check(`shot: ${name} matches the repo copy`, sha(png) === sha(readFileSync(join(root, 'screenshots', name))));
  }
}

// ---- 12. Repo files ----
const readme = existsSync(join(root, 'README.md')) ? readFileSync(join(root, 'README.md'), 'utf8') : '';
check('repo: README exists', readme.length > 0);
check('repo: README has the referral njrtxptt', readme.includes('njrtxptt'));
check('repo: README has 3 make.fun badges', (readme.match(/make\.fun/g) || []).length >= 3);
const license = existsSync(join(root, 'LICENSE')) ? readFileSync(join(root, 'LICENSE'), 'utf8') : '';
check('repo: LICENSE has the SPDX line', license.includes('SPDX-License-Identifier: MIT'));
check('repo: out/ (local build output) is not in the repo', !existsSync(join(root, 'out')));
const dashFiles = readdirSync(join(root, 'dashboard'));
check('repo: dashboard has index.html, app.css, app.js, 00-proof.md', ['index.html', 'app.css', 'app.js'].every((f) => dashFiles.includes(f)));
check('repo: proof in dashboard/ matches the output proof', sha(readFileSync(join(root, 'dashboard', '00-proof.md'))) === sha(readFileSync(join(OUT, 'dashboard', '00-proof.md'))));

console.log(`\n${passes.length} passed, ${failures.length} failed`);
for (const p of passes) console.log(`  PASS ${p}`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log('GATE: all checks pass');
