// Token Radar v4: read the sealed snapshot, fit the model, write the board,
// the dashboard data, the proof and the dossier.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The program is deterministic: same snapshot in, same bytes out, twice.
// It fits everything at run time (size curve, hazard, bands, bootstrap ranges),
// so no fitted number is carried in by hand. Node 22, standard library only.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { radarIssues } from './lib/validate.ts';
import { renderProof } from './lib/proof.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}
const problems = radarIssues(board, radar, snapshot);
if (problems.length > 0) {
  process.stderr.write(`token radar: the radar fails its own checks:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
// The proof and the validation summary are rendered from the computed numbers,
// so they are written after the copy, straight into the output dashboard.
writeFileSync(join(out, 'dashboard', '00-proof.md'), renderProof(radar, snapshot));
writeFileSync(
  join(out, 'dashboard', 'validation.json'),
  `${JSON.stringify(
    {
      rows: radar.rows.length,
      totalImpliedUsd: radar.rows.reduce((a, r) => a + r.implied_value_usd, 0),
      topImpliedUsd: radar.rows[0]!.implied_value_usd,
      farmCounts: radar.farm.farmCounts,
      medianFarmNet: radar.farm.medianFarmNet,
      loo: radar.model.loo,
      timeSplit: radar.model.timeSplit,
      walkForward: radar.model.walkForward,
      rangeHold: radar.model.rangeHold,
      band: radar.model.band,
      bandCoverage: radar.model.bandCoverage,
      oddsHoldoutBrier: radar.odds.holdoutBrier,
      oddsHoldoutHit: radar.odds.holdoutHit,
      oddsTimeSplitBrier: radar.odds.timeSplitBrier,
      ledger: radar.ledger,
      slope: radar.model.slope,
      intercept: radar.model.intercept,
      r2offsets: radar.model.r2offsets,
    },
    null,
    1,
  )}\n`,
);
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const total = board.reduce((a, r) => a + r.implied_value_usd, 0);
process.stdout.write(
  `token radar v4: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored, total $${(total / 1e6).toFixed(1)}M\n` +
    `token radar v4: verdicts ${radar.farm.farmCounts.FARM} FARM / ${radar.farm.farmCounts.THIN} THIN / ${radar.farm.farmCounts.SKIP} SKIP; LOO x${radar.model.loo}, time-split x${radar.model.timeSplit}, walk-forward x${radar.model.walkForward}\n` +
    `token radar v4: odds hold-out Brier ${radar.odds.holdoutBrier} (base ${radar.odds.holdoutBrierBase}), hit ${radar.odds.holdoutHit}; wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
