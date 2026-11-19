// Token Radar v4 dashboard. Everything on this page renders from window.RADAR
// (data.js, written by main.ts). The farm controls re-price every row with the
// same arithmetic the model uses (see lib/model.ts farmNumbers): deposit lens
// net = (deposit / TVL) x implied x drop share - fee; slice lens net =
// (implied x share / band) - fee - T-bill on capital; break-even odds from the
// slice lens; FARM when either lens clears its threshold.
'use strict';

const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const LN10 = Math.log(10);
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtUsd = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
};
const fmtUsd2 = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + '%';
const fmtX = (n, d = 2) => 'x' + n.toFixed(d);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The farm controls as the user has them set (defaults = the shipped model). */
function controls() {
  return {
    plan: parseFloat($('cPlan').value),
    drop: parseFloat($('cDrop').value),
    share: parseFloat($('cShare').value),
    tbill: parseFloat($('cTbill').value),
  };
}

/** Re-price one row under the current controls. Mirrors lib/model.ts farmNumbers. */
function farmRecompute(r, c) {
  const tbill = r.capital_usd * c.tbill * (r.hold_days / 365);
  const netDeposit = (c.plan / r.tvl_usd) * r.implied_value_usd * c.drop - r.fee_usd;
  const sliceLow = (r.implied_value_usd * c.share) / R.farm.band;
  const sliceLowCond = (r.conditional_value_usd * c.share) / R.farm.band;
  const netSlice = sliceLow - r.fee_usd - tbill;
  const net = Math.max(netSlice, netDeposit);
  const be = sliceLowCond > 0 ? (r.fee_usd + tbill) / sliceLowCond : 1;
  const verdict =
    netSlice >= R.farm.sliceThreshold || netDeposit >= R.farm.depositThreshold
      ? 'FARM'
      : netSlice > 0 || netDeposit > 0
        ? 'THIN'
        : 'SKIP';
  return { netDeposit, netSlice, net, perHour: net / r.active_hours, be: Math.min(1, be), verdict, tbill };
}

// ---- Cover strip ----

function renderCensus() {
  const l = R.ledger;
  const segs = [
    ['ranked', l.ranked, 'ranked on the board'],
    ['trades', l.trades, 'already trading'],
    ['symbolOnly', l.symbolOnly, 'symbol only'],
    ['setAside', l.setAside, 'set aside'],
  ];
  $('census').innerHTML =
    '<h2 style="margin:0">The 758, accounted for</h2>' +
    segs.map(([cls, n, lab]) => `<span class="seg ${cls}"><b>${n}</b> ${lab}</span>`).join('') +
    `<span class="seg"><b>${l.total}</b> total</span>`;
  $('ledger').textContent =
    `Ranked ${l.ranked} + token trades ${l.trades} + symbol-only ${l.symbolOnly} + set aside ${l.setAside} = ${l.total}. ` +
    `Set aside: ${Object.entries(l.setAsideReasons).map(([k, v]) => `${k} ${v}`).join(', ')}.`;
}

function renderFormula() {
  const m = R.model;
  $('formula').innerHTML =
    '<h2>How a row is priced</h2>' +
    '<code>ln(mcap) = ' + m.intercept.toFixed(4) + ' + ' + m.slope.toFixed(2) + ' x ln(TVL)\n' +
    '  + category offset + ln(1 + growth x ' + m.growthWeight + ')\n' +
    'implied = TVL x multiple x launch odds</code>' +
    '<p>Fitted on ' + m.comps + ' traded comparables. R-squared ' + m.r2plain.toFixed(3) +
    ' bare, ' + m.r2offsets.toFixed(3) + ' with offsets; Spearman ' + m.spearman.toFixed(3) +
    '. Multiple clamped to [0.08, 1.20]. Slope 0.50 is a stated prior, not the OLS fit (0.68).</p>';
}

function renderAblation() {
  const rows = R.ablation
    .map(
      (a) =>
        `<tr class="${a.variant.startsWith('Shipped') ? 'shipped' : ''}"><td>${esc(a.variant)}</td>` +
        `<td>${fmtX(a.loo)}</td><td>${fmtX(a.timeSplit)}</td><td>${fmtX(a.walkForward)}</td></tr>`,
    )
    .join('');
  $('ablation').innerHTML =
    '<h2>Ablation: same three guards, every variant</h2>' +
    '<table><thead><tr><th>Variant</th><th>LOO</th><th>Time-split</th><th>Walk-fwd</th></tr></thead><tbody>' +
    rows +
    '</tbody></table><p>LOO and time-split are median multiplicative misses. The free-OLS slope fits better and is still rejected: it prices giants 4–22x the winners.</p>';
}

function renderScatter() {
  const pts = R.scatter;
  const xs = pts.map((p) => Math.log10(p.tvl));
  const ys = pts.map((p) => Math.log10(p.mcap));
  const x0 = Math.floor(Math.min(...xs)) - 0.3, x1 = Math.ceil(Math.max(...xs)) + 0.3;
  const y0 = Math.floor(Math.min(...ys)) - 0.3, y1 = Math.ceil(Math.max(...ys)) + 0.3;
  const W = 1000, H = 360, PL = 64, PR = 16, PT = 14, PB = 40;
  const X = (v) => PL + ((v - x0) / (x1 - x0)) * (W - PL - PR);
  const Y = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  const tick = (v) => (v >= 9 ? '$' + Math.pow(10, v - 9).toFixed(0) + 'B' : v >= 6 ? '$' + Math.pow(10, v - 6).toFixed(0) + 'M' : '$' + Math.pow(10, v - 3).toFixed(0) + 'K');
  let grid = '';
  for (let v = Math.ceil(x0); v <= x1; v++) {
    grid += `<line x1="${X(v)}" y1="${PT}" x2="${X(v)}" y2="${H - PB}" stroke="#eee"/><text x="${X(v)}" y="${H - PB + 18}" font-size="11" fill="#5c5c5c" text-anchor="middle">${tick(v)}</text>`;
  }
  for (let v = Math.ceil(y0); v <= y1; v++) {
    grid += `<line x1="${PL}" y1="${Y(v)}" x2="${W - PR}" y2="${Y(v)}" stroke="#eee"/><text x="${PL - 8}" y="${Y(v) + 4}" font-size="11" fill="#5c5c5c" text-anchor="end">${tick(v)}</text>`;
  }
  // The fitted curve: log10(mcap) = (intercept + slope x ln(TVL)) / ln(10).
  const m = R.model;
  const lineY = (lt) => (m.intercept + m.slope * lt) / LN10;
  const lx0 = x0 * LN10, lx1 = x1 * LN10;
  const line = `<line x1="${X(x0)}" y1="${Y(lineY(lx0))}" x2="${X(x1)}" y2="${Y(lineY(lx1))}" stroke="#0b5fa5" stroke-width="2"/>`;
  const dots = pts
    .map((p) => {
      const x = X(Math.log10(p.tvl)), y = Y(Math.log10(p.mcap));
      if (p.top25) return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#1a7f37" transform="rotate(45 ${x} ${y})"/>`;
      if (!p.kept) return `<circle cx="${x}" cy="${y}" r="3.5" fill="#999"/>`;
      if (p.flagged) return `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" fill="#e07b00"/>`;
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="#0b5fa5"/>`;
    })
    .join('');
  $('scatter').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter of market cap against TVL, log-log">${grid}${line}${dots}</svg>`;
  const kept = pts.filter((p) => p.kept && !p.top25).length;
  const flagged = pts.filter((p) => p.flagged).length;
  const dropped = pts.filter((p) => !p.kept).length;
  $('scatterNote').textContent =
    `${kept} kept comparables (${flagged} flagged: the model misses them by more than x3.2 on leave-one-out), ` +
    `${dropped} dropped (mcap/TVL outside [0.02, 20]), 25 top candidates plotted at implied value. ` +
    `The line is the fitted curve; the scatter around it is why the band is x${R.model.band.toFixed(2)}.`;
}

function renderWhatif() {
  const c = controls();
  const priced = R.rows.map((r) => ({ r, f: farmRecompute(r, c) }));
  const farm = priced.filter((p) => p.f.verdict === 'FARM');
  const med = farm.length ? farm.map((p) => p.f.net).sort((a, b) => a - b)[Math.floor(farm.length / 2)] : 0;
  const top3 = [...priced].sort((a, b) => b.f.net - a.f.net).slice(0, 3);
  $('whatif').innerHTML =
    '<h2>What-if: the plan above, applied to the whole board</h2>' +
    '<p>Plan: deposit $' + fmtInt(c.plan) + ' · drop ' + fmtPct(c.drop, 1) + ' · farmer share ' + (c.share * 100).toFixed(3) + '% · T-bill ' + fmtPct(c.tbill, 0) + '.</p>' +
    '<table><tbody>' +
    `<tr><td>FARM rows</td><td><b>${farm.length}</b> of ${R.rows.length} (median net ${fmtUsd2(med)})</td></tr>` +
    top3.map((p, i) => `<tr><td>#${i + 1} net: ${esc(p.r.name)}</td><td>${fmtUsd2(p.f.net)} (${fmtUsd2(p.f.perHour)}/h, ${p.f.verdict})</td></tr>`).join('') +
    '</tbody></table><p>Change any control and this panel, the table and the detail drawer re-price from the same arithmetic. The shipped plan is $1,000 / 7% / 0.002% / 4%.</p>';
  $('planNote').textContent = `Under this plan: ${farm.length} FARM, median net ${fmtUsd2(med)}.`;
}

// ---- Validation + KPI strips ----

function renderStrips() {
  const m = R.model, o = R.odds, f = R.farm, v = R.validation;
  const free = R.ablation.find((a) => a.variant.startsWith('Free OLS'));
  const freeLoo = free ? free.loo : 2.81;
  const cells = [
    [fmtX(m.loo), 'Leave-one-out: median multiplicative miss on 109 comparables'],
    [fmtX(m.timeSplit), 'Time split: fit before 2025-01-01, miss on listings after'],
    [fmtPct(v.rank1Keeps, 1), 'Rank 1 keeps its place in bootstrap refits (200)'],
    [fmtX(freeLoo), 'Baseline (free-OLS slope 0.68) LOO — shipped trades ' + (m.loo - freeLoo).toFixed(2) + 'x for plausibility'],
    [fmtX(m.band) + ' / ' + fmtPct(m.bandCoverage, 0), 'Farm band 10^sigma, and the share of comparables whose value lands inside it'],
    [fmtPct(o.holdoutHit, 0) + ' / ' + o.holdoutBrier.toFixed(3), 'Odds hold-out: hit rate at 0.5, and Brier (base rate ' + o.holdoutBrierBase.toFixed(3) + ')'],
  ];
  $('validationStrip').innerHTML = cells.map(([b, s]) => `<div class="cell"><b>${b}</b><span>${s}</span></div>`).join('');
  const total = R.rows.reduce((a, r) => a + r.implied_value_usd, 0);
  const kpi = [
    [String(R.rows.length), 'protocols ranked'],
    [fmtUsd(total), 'total implied value'],
    [fmtX(m.loo), 'leave-one-out, held out'],
    [fmtPct(m.rangeHold, 0), 'of comparables hold inside the band'],
    [String(f.farmCounts.FARM), 'worth farming (FARM)'],
    [fmtUsd2(f.bestPerHour), 'best net per hour'],
  ];
  $('kpiStrip').innerHTML = kpi.map(([b, s]) => `<div class="cell"><b>${b}</b><span>${s}</span></div>`).join('');
  $('kpiTotal').textContent = fmtUsd(total);
  $('asOf').textContent = R.as_of;
  $('asOf2').textContent = R.as_of;
}

// ---- Tabs, filters, table ----

const TABS = [
  ['all', 'All'],
  ['watchlist', 'Watchlist'],
  ['FARM', 'FARM'],
  ['THIN', 'THIN'],
  ['SKIP', 'SKIP'],
  ['live', 'Already trading'],
  ['method', 'Method'],
];
const state = { tab: 'all', chain: '', cat: '', tvl: '', chg: '', search: '' };

function tabCount(tab) {
  if (tab === 'all') return R.rows.length;
  if (tab === 'watchlist') return R.rows.filter((r) => R.watchlist.includes(r.slug)).length;
  if (tab === 'live') return R.live.length;
  if (tab === 'method') return 0;
  return R.rows.filter((r) => r.verdict === tab).length;
}

function renderTabs() {
  $('tabs').innerHTML = TABS.map(
    ([key, label]) =>
      `<button role="tab" data-tab="${key}" aria-selected="${state.tab === key}">${label}` +
      (tabCount(key) ? `<span class="n">${tabCount(key)}</span>` : '') +
      '</button>',
  ).join('');
  for (const b of $('tabs').querySelectorAll('button')) {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  }
}

function renderFilterOptions() {
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  const cats = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  $('fChain').innerHTML = '<option value="">any</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
  $('fCat').innerHTML = '<option value="">any</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
}

function filteredRows() {
  const c = controls();
  return R.rows
    .filter((r) => {
      if (state.tab === 'watchlist' && !R.watchlist.includes(r.slug)) return false;
      if ((state.tab === 'FARM' || state.tab === 'THIN' || state.tab === 'SKIP') && r.verdict !== state.tab) return false;
      if (state.chain && !r.chains.includes(state.chain)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.tvl && r.tvl_usd < parseFloat(state.tvl) * 1e6) return false;
      if (state.chg === 'up' && !(r.change_7d > 0)) return false;
      if (state.chg === 'down' && !(r.change_7d < 0)) return false;
      if (state.search && !(r.name + ' ' + r.slug).toLowerCase().includes(state.search)) return false;
      return true;
    })
    .map((r) => ({ r, f: farmRecompute(r, c) }));
}

function bandBar(r) {
  const lo = Math.log10(r.band_lo_usd), hi = Math.log10(r.band_hi_usd), mid = Math.log10(r.implied_value_usd);
  const w0 = lo - 0.3, w1 = hi + 0.3;
  const left = ((lo - w0) / (w1 - w0)) * 100, width = ((hi - lo) / (w1 - w0)) * 100;
  const tick = ((mid - w0) / (w1 - w0)) * 100;
  return `<div class="bandbar" title="P25 ${fmtUsd(r.band_lo_usd)} – P75 ${fmtUsd(r.band_hi_usd)}"><i style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></i><i style="left:${tick.toFixed(1)}%;width:2px;background:#1a1a1a"></i></div>`;
}

function renderTable() {
  const list = filteredRows();
  $('rows').innerHTML = list
    .map(({ r, f }) => {
      const chg = r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%';
      const chgCls = r.change_7d === null ? '' : r.change_7d > 0 ? 'pos' : 'neg';
      return `<tr data-slug="${esc(r.slug)}"><td>${r.rank}</td>` +
        `<td class="name"><b>${esc(r.name)}</b>${r.early ? '<span class="tag">EARLY</span>' : ''}<span class="slug">${esc(r.slug)}</span></td>` +
        `<td>${esc(r.category ?? '—')}</td><td>${esc(r.chains[0] ?? '—')}</td>` +
        `<td class="num">${fmtUsd(r.tvl_usd)}</td><td class="num ${chgCls}">${chg}</td>` +
        `<td class="num">${fmtUsd(r.conditional_value_usd)}</td>` +
        `<td class="num">${r.odds.toFixed(2)}</td>` +
        `<td class="num"><b>${fmtUsd(r.implied_value_usd)}</b></td>` +
        `<td>${fmtUsd(r.band_lo_usd)} – ${fmtUsd(r.band_hi_usd)}${bandBar(r)}</td>` +
        `<td class="num">${r.rank_lo}–${r.rank_hi}</td>` +
        `<td class="num ${f.net >= 0 ? 'pos' : 'neg'}">${fmtUsd2(f.net)}</td>` +
        `<td class="num">${fmtUsd2(f.perHour)}</td>` +
        `<td class="num">${f.be < 0.1 ? f.be.toFixed(3) : f.be.toFixed(2)}</td>` +
        `<td><span class="verdict ${f.verdict}">${f.verdict}</span></td></tr>`;
    })
    .join('');
  $('rowCount').textContent = `${list.length} of ${R.rows.length} rows shown. Net, net/h, break-even and verdict follow the plan controls above; the board order never moves.`;
  for (const tr of $('rows').querySelectorAll('tr')) {
    tr.addEventListener('click', () => openDetail(tr.dataset.slug));
  }
}

function renderLive() {
  const wrap = $('liveWrap');
  if (!wrap) return;
  wrap.innerHTML =
    '<h2>Already trading — ' + R.live.length + ' of the snapshot, by market cap</h2>' +
    '<table><thead><tr><th>Protocol</th><th>Category</th><th>Chain</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th></tr></thead><tbody>' +
    R.live
      .map(
        (p) =>
          `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.category ?? '—')}</td><td>${esc(p.chains[0] ?? '—')}</td>` +
          `<td class="num">${fmtUsd(p.tvl_usd)}</td><td class="num">${p.mcap_usd === null ? '—' : fmtUsd(p.mcap_usd)}</td>` +
          `<td class="num">${p.change_7d === null ? '—' : (p.change_7d > 0 ? '+' : '') + p.change_7d.toFixed(1) + '%'}</td></tr>`,
      )
      .join('') +
    '</tbody></table><p class="count">The snapshot holds more trading protocols; the 120 largest by market cap are shown here. The full count is in the ledger.</p>';
}

function setTab(tab) {
  state.tab = tab;
  const isBoard = tab !== 'live' && tab !== 'method';
  $('board').style.display = isBoard ? '' : 'none';
  $('rowCount').style.display = isBoard ? '' : 'none';
  $('method').hidden = tab !== 'method';
  let liveWrap = $('liveWrap');
  if (!liveWrap) {
    liveWrap = document.createElement('section');
    liveWrap.id = 'liveWrap';
    $('board').after(liveWrap);
  }
  liveWrap.hidden = tab !== 'live';
  if (tab === 'live') renderLive();
  if (tab === 'method') renderMethod();
  renderTabs();
  if (isBoard) renderTable();
  syncHash();
}

// ---- Method tab ----

function renderMethod() {
  const m = R.model, o = R.odds, f = R.farm, l = R.ledger;
  const calRows = o.calibration
    .map((c) => `<tr><td>${c.lo}–${c.hi} days</td><td>${c.n}</td><td>${c.pred.toFixed(3)}</td><td>${c.obs.toFixed(3)}</td></tr>`)
    .join('');
  $('methodBody').innerHTML = `
  <h3>How to read this page</h3>
  <p>The board is 198 pre-token protocols in rank order, by implied value (TVL x multiple x launch odds). The cover strip is the evidence: the 758 census, the pricing formula, the ablation table, the size-curve scatter with its legend, and the what-if panel. The two strips below it are the validation (leave-one-out, time split, bootstrap, baseline, band, odds hold-out) and the key numbers (ranked, total value, range holds, worth farming, best per hour). The tabs filter the board; the filters narrow by chain, category, TVL and 7-day direction; search matches name or slug. Click any row for the detail drawer: every multiplier with its number, the band and rank range, both net lenses, the deposit-by-drop-share grid, the nearest comparables, and the farm plan with its review date and TVL exit. The plan controls re-price the net, net/h, break-even and verdict of every row from the same arithmetic the model uses; the board order never moves, because the ranking is the model's, not the plan's.</p>
  <h3>Value</h3>
  <p>ln(mcap) = ${m.intercept.toFixed(4)} + ${m.slope.toFixed(2)} ln(TVL) + category offset + ln(1 + growth x ${m.growthWeight}), fitted on ${m.comps} traded protocols with mcap/TVL in [0.02, 20]. Offsets shrink by n/(n+8). The multiple (mcap/TVL) is clamped to [0.08, 1.20]. Growth is the 7-day TVL change clamped to [-60, 120]%. R-squared ${m.r2plain.toFixed(3)} bare, ${m.r2offsets.toFixed(3)} with offsets; Spearman ${m.spearman.toFixed(3)}. The slope 0.50 is a stated prior: free OLS gives 0.68, fits better (LOO x${(R.ablation.find((a) => a.variant.startsWith('Free OLS')) || { loo: 0 }).loo}), and prices giants 4–22x the winners, so it is not shipped.</p>
  <h3>Launch odds</h3>
  <p>A binned hazard, fitted by maximum likelihood on the dated protocols: age bins ${o.bins.join(', ')}+ days, per-bin launch shares h = [${o.h.join(', ')}], plateau P(ever) = ${o.pever.toFixed(3)}. Forward odds = [P_cat(ever) − P_cat(ever) F(age)] / [1 − P_cat(ever) F(age)], floored at 0.02. Category P(ever) is age-adjusted and shrunk toward the plateau. Hold-out (70/30 by slug hash): Brier ${o.holdoutBrier.toFixed(4)} vs base ${o.holdoutBrierBase.toFixed(4)}, hit ${o.holdoutHit.toFixed(3)}. Time split: Brier ${o.timeSplitBrier.toFixed(4)} vs base ${o.timeSplitBrierBase.toFixed(4)} — it under-predicts (mean ${o.timeSplitPred.toFixed(3)} vs observed ${o.timeSplitObs.toFixed(3)}), and that is stated, not hidden. The Weibull alternative loses the hold-out (Brier ${o.weibullBrier.toFixed(4)}, P(ever) ${o.weibullPever.toFixed(3)}) and is not shipped.</p>
  <table><thead><tr><th>Age group</th><th>n</th><th>Predicted launched</th><th>Observed launched</th></tr></thead><tbody>${calRows}</tbody></table>
  <h3>Farm economics</h3>
  <p>Two lenses. Deposit lens: net = (deposit / TVL) x implied x drop share − fee. Slice lens: slice = implied x ${f.share} (one farmer's share); slice-low = slice / ${f.band.toFixed(2)} (the model band); net = slice-low − fee − T-bill at 4% on capital. Fee = gas per transaction (by chain) x (2 + weekly actions, capped at 12). Capital is tiered by TVL ($250 / $150 / $100 / $50); hold is 60 / 45 / 30 days by age. FARM needs slice net ≥ $${f.sliceThreshold} or deposit net ≥ $${f.depositThreshold}; THIN covers its costs; SKIP does not. The share is calibrated on a grid over the snapshot: half the share gives ${f.sensitivity[0].farm} FARM, the shipped share gives ${f.sensitivity[1].farm}, double gives ${f.sensitivity[2].farm}. Every FARM row shows a positive net.</p>
  <h3>Validation</h3>
  <p>Leave-one-out x${m.loo.toFixed(2)} (within 3x: ${fmtPct(m.looWithin3, 0)}); time split x${m.timeSplit.toFixed(2)}; walk-forward x${m.walkForward.toFixed(2)}. Range-hold ${fmtPct(m.rangeHold, 0)} of comparables inside the x${m.band.toFixed(2)} band. Local P25–P75 band per row: realised coverage ${fmtPct(m.bandCoverage, 0)} (a 50% band should cover about half), median width ${m.bandMedianWidthDex.toFixed(2)} dex. Rank 1 keeps its place in ${fmtPct(R.validation.rank1Keeps, 1)} of 200 bootstrap refits; top-1 leads top-2 by ${R.validation.topGapPct.toFixed(1)}%.</p>
  <h3>Rejected, with reasons</h3>
  <ul>${R.rejected.map((r) => `<li><b>${esc(r.variant)}:</b> ${esc(r.reason)}</li>`).join('')}</ul>
  <h3>Category offsets</h3>
  <table><thead><tr><th>Category</th><th>Offset</th></tr></thead><tbody>${Object.entries(m.offsets).sort((a, b) => b[1] - a[1]).map(([cat, off]) => `<tr><td>${esc(cat)}</td><td>${off >= 0 ? '+' : ''}${off.toFixed(4)}</td></tr>`).join('')}</tbody></table>
  <p>Offsets shrink by n/(n+8); a positive offset prices a category above the curve.</p>
  <h3>Gas per transaction (stated assumptions, not snapshot data)</h3>
  <table><thead><tr><th>Chain</th><th>Gas $</th></tr></thead><tbody>${Object.entries(f.gasUsd).map(([chain, g]) => `<tr><td>${esc(chain)}</td><td>$${g.toFixed(2)}</td></tr>`).join('')}<tr><td>Other chains</td><td>$${f.gasDefaultUsd.toFixed(2)}</td></tr></tbody></table>
  <p>Fee = gas x (2 + weekly actions, capped at 12). If gas moves, the fee column moves with it; the plan controls re-price every row live.</p>
  <h3>Ledger</h3>
  <p>Ranked ${l.ranked} + token trades ${l.trades} + symbol-only ${l.symbolOnly} + set aside ${l.setAside} = ${l.total}. Set aside: ${Object.entries(l.setAsideReasons).map(([k, v]) => `${k} ${v}`).join(', ')}.</p>
  <p>Full account, with worked odds and farm arithmetic, is in <a href="00-proof.md">00-proof.md</a>.</p>`;
}

// ---- Detail drawer ----

function openDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  if (!r) return;
  const c = controls();
  const f = farmRecompute(r, c);
  const m = R.model;
  const offset = m.offsets[r.category ?? ''] ?? 0;
  const lnTvl = Math.log(r.tvl_usd);
  const growthTerm = Math.log(r.growth_multiplier);
  const predLn = m.intercept + m.slope * lnTvl + offset + growthTerm;
  const rawMult = Math.exp(predLn) / r.tvl_usd;
  const clampBinds = Math.abs(rawMult - r.multiple) > 0.0001;
  const multRows = [
    ['TVL', fmtUsd(r.tvl_usd)],
    ['ln(TVL)', lnTvl.toFixed(3)],
    ['Intercept', m.intercept.toFixed(4)],
    ['Slope x ln(TVL)', m.slope.toFixed(2) + ' x ' + lnTvl.toFixed(3) + ' = ' + (m.slope * lnTvl).toFixed(3)],
    ['Category offset (' + (r.category ?? '—') + ')', (offset >= 0 ? '+' : '') + offset.toFixed(4)],
    ['Growth term (7d ' + (r.change_7d === null ? '—' : r.change_7d.toFixed(1) + '%') + ')', (growthTerm >= 0 ? '+' : '') + growthTerm.toFixed(4) + ' (x' + r.growth_multiplier.toFixed(3) + ')'],
    ['Predicted ln(mcap)', predLn.toFixed(3)],
    ['Multiple, raw (before clamp)', 'x' + rawMult.toFixed(4)],
    ['Multiple, clamped [0.08, 1.20]', 'x' + r.multiple.toFixed(4)],
    ['Value if it launches', fmtUsd(r.conditional_value_usd)],
    ['P_cat(ever)', r.pever_category.toFixed(3)],
    ['F(age ' + (r.age_days === null ? 'unknown' : r.age_days + 'd') + ')', r.f_age.toFixed(3)],
    ['Launch odds', r.odds.toFixed(3)],
    ['Implied value', fmtUsd(r.implied_value_usd)],
  ];
  const grid = [1000, 10000]
    .map(
      (plan) =>
        '<tr><td>$' + fmtInt(plan) + '</td>' +
        [0.035, 0.07, 0.14]
          .map((drop) => {
            const net = (plan / r.tvl_usd) * r.implied_value_usd * drop - r.fee_usd;
            return `<td class="${net >= 0 ? 'pos' : 'neg'}">${fmtUsd2(net)}</td>`;
          })
          .join('') +
        '</tr>',
    )
    .join('');
  const comps = r.comparables
    .map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${fmtUsd(p.tvl_usd)}</td><td class="num">${fmtUsd(p.mcap_usd)}</td></tr>`)
    .join('');
  $('drawerBody').innerHTML = `
  <h2>#${r.rank} ${esc(r.name)} ${r.early ? '<span class="tag">EARLY</span>' : ''}</h2>
  <p>${esc(r.category ?? '—')} · ${esc(r.chains.join(', ') || '—')} · TVL ${fmtUsd(r.tvl_usd)} · 7d ${r.change_7d === null ? '—' : r.change_7d.toFixed(1) + '%'} · listed ${r.listed_at ?? 'unknown'}</p>
  <h3>Every multiplier, with numbers</h3>
  <table><tbody>${multRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
  ${clampBinds ? `<p>The clamp binds here: the raw multiple is x${rawMult.toFixed(4)}, ${rawMult < 0.08 ? 'below the 0.08 floor' : 'above the 1.20 cap'}, so the value-if-it-launches uses the clamped multiple.</p>` : ''}
  <h3>Band and rank range</h3>
  <p>P25–P75 band ${fmtUsd(r.band_lo_usd)} – ${fmtUsd(r.band_hi_usd)} (from ${r.band_n} comparables within ±0.5 dex of TVL; the band is the local leave-one-out error spread). Rank range ${r.rank_lo}–${r.rank_hi} over 200 bootstrap refits.</p>
  <h3>Farm economics (under the current plan controls)</h3>
  <div class="grid2">
    <div><span>Deposit lens net</span><span>${fmtUsd2(f.netDeposit)}</span></div>
    <div><span>Slice lens net</span><span>${fmtUsd2(f.netSlice)}</span></div>
    <div><span>Net (better lens)</span><span>${fmtUsd2(f.net)}</span></div>
    <div><span>Net per hour</span><span>${fmtUsd2(f.perHour)}</span></div>
    <div><span>Break-even odds</span><span>${f.be < 0.1 ? f.be.toFixed(3) : f.be.toFixed(2)} (fitted odds ${r.odds.toFixed(2)})</span></div>
    <div><span>Verdict</span><span>${f.verdict}</span></div>
    <div><span>Fee</span><span>${fmtUsd2(r.fee_usd)}</span></div>
    <div><span>T-bill on capital</span><span>${fmtUsd2(f.tbill)} on ${fmtUsd2(r.capital_usd)}</span></div>
    <div><span>Hold</span><span>${r.hold_days} days</span></div>
    <div><span>Active hours</span><span>${r.active_hours.toFixed(2)}</span></div>
  </div>
  <h3>Deposit net by plan size and drop share</h3>
  <table><thead><tr><th>Deposit</th><th>Drop 3.5%</th><th>Drop 7%</th><th>Drop 14%</th></tr></thead><tbody>${grid}</tbody></table>
  <h3>Nearest comparables</h3>
  <table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th></tr></thead><tbody>${comps}</tbody></table>
  <h3>Farm plan</h3>
  <ol>${r.farm_steps.map((s) => {
    const i = s.indexOf(' Cost:');
    return i >= 0 ? `<li><b>${esc(s.slice(0, i))}</b>${esc(s.slice(i))}</li>` : `<li>${esc(s)}</li>`;
  }).join('')}</ol>
  <p>Review the position on ${R.reviewDate}: if the expected net no longer covers the fees, unwind. Exit if TVL falls under ${fmtUsd(r.tvl_usd * 0.7)} (70% of the snapshot TVL).</p>`;
  $('drawer').hidden = false;
  openSlug = slug;
  syncHash();
}

function closeDetail() {
  $('drawer').hidden = true;
  openSlug = '';
  syncHash();
}

// ---- Hash state ----

let openSlug = '';

function syncHash() {
  const parts = [];
  if (state.tab !== 'all') parts.push('filter=' + encodeURIComponent(state.tab));
  if (openSlug) parts.push('detail=' + encodeURIComponent(openSlug));
  history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname + location.search);
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const filter = h.get('filter');
  if (filter && TABS.some(([k]) => k === filter)) state.tab = filter;
  const detail = h.get('detail');
  return detail;
}

// ---- Init ----

function rerender() {
  renderWhatif();
  if (state.tab !== 'live' && state.tab !== 'method') renderTable();
  renderTabs();
}

function init() {
  renderCensus();
  renderFormula();
  renderAblation();
  renderScatter();
  renderStrips();
  renderFilterOptions();
  const detailSlug = readHash();
  setTab(state.tab);
  renderWhatif();
  if (detailSlug) openDetail(detailSlug);
  for (const id of ['cPlan', 'cDrop', 'cShare', 'cTbill']) {
    $(id).addEventListener('change', rerender);
  }
  $('fChain').addEventListener('change', (e) => { state.chain = e.target.value; renderTable(); });
  $('fCat').addEventListener('change', (e) => { state.cat = e.target.value; renderTable(); });
  $('fTvl').addEventListener('change', (e) => { state.tvl = e.target.value; renderTable(); });
  $('fChg').addEventListener('change', (e) => { state.chg = e.target.value; renderTable(); });
  $('fSearch').addEventListener('input', (e) => { state.search = e.target.value.trim().toLowerCase(); renderTable(); });
  $('drawerClose').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
}

init();
