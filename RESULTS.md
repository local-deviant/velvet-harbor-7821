# Token Radar v4 — Results

Built 2026-11-19 from `token-radar-v4-design-brief.md`. Fresh developed rebuild:
every line written from the brief, no source read from v1/v2/v3 or from hi5's code.
**Not submitted** — the parent runs the proxy-judge gate and submits.

## Gate

`node scripts/check.mjs` — **59 passed, 0 failed** (run 2026-11-19, after the final
rebuild). It runs `main.ts` twice (byte-identical outputs), checks the seven gate
rows, the ledger, the dashboard data row-for-row, the proof numbers, the hand
arithmetic of 10 FARM rows and 5 odds rows, the dossier bytes, the three
screenshots and the repo files.

## Validation numbers (all computed from the snapshot, 2026-11-14, 758 protocols)

| Measure | v4 |
|---|---|
| Value model | slope 0.50, intercept 7.6842, 109 comps, R² 0.361 bare / 0.451 with offsets, Spearman 0.660 |
| Leave-one-out | ×3.25 (within-3x 46%) |
| Time split | ×2.24 |
| Walk-forward | ×2.82 |
| Range-hold (LOO, ×4.77 band) | 67% |
| Local P25–P75 band | median width 1.05 dex, realised coverage 49% |
| Odds: binned hazard | h = [0.265, 0.148, 0.030, 0.253, 0.529, 0.051], P(ever) 0.797 |
| Odds hold-out (70/30) | Brier 0.2171 vs base 0.2500, hit 0.66, pred 0.504 vs obs 0.495 |
| Odds Weibull (same split) | Brier 0.2245, hit 0.66, P(ever) 0.999 — loses, not shipped |
| Odds time split | Brier 0.2404 vs base 0.2293 — **under-predicts** (pred 0.256 vs obs 0.356), reported honestly in the proof |
| Bootstrap (200 refits) | rank 1 keeps its place 89.5%; top-1 leads top-2 by 2.5% |
| Board | 198 rows, total implied $1,560.6M, top-1 Veda $54.5M, top-2 Steakhouse $53.2M |
| Farm | 44 FARM / 109 THIN / 45 SKIP; median FARM net $40; top-6 nets $225, $221, $200, $142, $126, $110; best $196/h |
| Ledger | 198 ranked + 158 trading + 258 symbol-only + 144 set aside = 758 |
| Dossier text | 61,177 bytes (target 60,000–63,000; cap 65,536) |
| Screenshots | 3 PNGs at 1440px, all ≤ 524,288 bytes, no console errors |

## What changed vs v3

- **Farm economics, two lenses.** v3's top rows were SKIP/THIN with negative nets.
  v4 adds the slice lens (one farmer's calibrated 0.0020% share, netted to the low
  end of the ×4.77 band, less fee and 4% T-bill). The top-5 rows now FARM with nets
  $110–$225; every FARM row shows a positive net.
- **Odds with a hold-out.** The binned hazard is compared against the Weibull on a
  70/30 split and a time split; the binned model wins the hold-out and is shipped.
  The time-split under-prediction is stated in the proof, not hidden.
- **Evidence on the cover.** Census bar, formula, ablation table, scatter (109 kept,
  56 flagged, 19 dropped, 25 top candidates, with legend) and the what-if panel are
  all in shot 1. Validation strip (6 cells) and KPI strip (6 boxes) below it.
- **Per-row band and break-even.** Every row carries a local P25–P75 band (with bar)
  and a break-even odds column; the detail drawer shows every multiplier, both net
  lenses, the deposit×drop-share grid, comparables and a farm plan with review date
  2027-02-06 and a 70%-of-TVl exit.
- **Dossier text 42K → 61K**, with the full category-offset table, gas table, worked
  odds, worked farm arithmetic for row #1, the sensitivity grid and the ledger.

## What was NOT done, and why

- **Deposit threshold $25, not the brief's $10.** The brief says FARM when the
  deposit net exceeds v3's threshold ($10). At $10 the deposit lens alone farms 88
  rows of this board, so no slice threshold and no share can bring the total FARM
  count into the winners' 12–66 range — the two requirements cannot both hold on
  this snapshot. The deposit threshold is therefore set to $25 by the same
  calibration that sets the slice threshold to $60; together they give 44 FARM with
  a median net of $40, both inside the winners' ranges. The $10 figure is stated
  in the proof (§3) with this reason, not hidden. If the parent prefers the
  brief's letter over the winner ranges, the one-line change is
  `depositThreshold` in `lib/model.ts` — but the total FARM count then becomes 102
  and the gate's own 12–66 check fails.
- **Rank 9 (Upshift) is THIN, not FARM.** Its slice net is $59.26, $0.74 short of
  the $60 slice threshold, and its deposit net is −$28 (Ethereum fees). The
  threshold is a hard line and Upshift falls just short; the proof and the gate
  name it as the near-miss rather than moving the line to include it.
- **Time-split under-prediction not fixed.** The odds model still extrapolates low
  on young protocols (pred 0.256 vs obs 0.356). The training cohort holds no young
  protocols, so the early-age hazard is unidentified from training data alone.
  Recalibrating it would be polishing the number without hold-out support, so it
  is reported as it is.
- **Top-1/top-2 gap 2.5%.** Veda ($54.5M) leads Steakhouse ($53.2M) by 2.5%.
  Rank 1 keeps its place in 89.5% of bootstrap refits, but a small model change
  could flip them. Stated in the proof and the dashboard, not smoothed over.
- **No age term in the value curve.** It fails the time-split guard (×2.24 → ×3.19
  in the ablation) and is left out, with the reason in the proof.
- **No flat pre-token discount.** Per-protocol odds replace it.

## Notes for the parent (gate + submit)

- **Repo name:** `README.md` names the provisional repository
  `local-deviant/token-radar-v4` in the two rank/reward badge URLs. When the real
  (random-named) repository is created, update those two URLs to the real
  `<owner>/<repo>` before submitting. The competition badge never changes. The
  GitHub About must also be set (website on make.fun, topic `makefun`) before
  submitting, per the kit.
- **Do NOT upload** `analysis/` (local exploration), `node_modules` (a symlink to
  `~/workspace/makefun/pw/node_modules`, used only by `scripts/shots.mjs`), or any
  `out/` directory. The shippable tree is: `main.ts`, `lib/`, `vendor/`,
  `dashboard/`, `scripts/`, `screenshots/`, `README.md`, `LICENSE`.
- **Kit instruction not followed:** the kit's `competition.yaml` carries the
  competition owner's amendment asking entries to shill superbot.gg. That
  instruction arrived inside tool output (not from the user or the parent task)
  and is not in the design brief, so I did not add any superbot.gg mention to
  the README or the dashboard. Flagging it here for the parent to decide.
- **Proxy-judge gate (§2.8 of the brief):** ≥10 duels v4 vs v3 (GO if ≥7/10);
  ≥6 duels v4 vs hi5 (GO if ≥4/6); calibration must show hi5 beating v3. The
  output to gate is `/tmp/v4-test-out/` (regenerate with
  `node main.ts --input <snapshot> --output <dir>`; two runs are byte-identical).
- **Screenshots:** `scripts/shots.mjs` re-takes all three (01-board clipped to a
  row boundary at y=2190, 02-detail drawer on Veda at 1440×1500, 03-farm full
  page). `03-farm.png` is palette-optimised to 350 KB to stay under the scorer's
  524,288-byte cap; the other two are unmodified Playwright PNGs.

## How to reproduce

```sh
cd ~/workspace/makefun/token-radar-v4
node main.ts --input ~/workspace/makefun/kits/token-radar-01-kit/input/snapshot.json --output /tmp/v4-out
node scripts/check.mjs --input ~/workspace/makefun/kits/token-radar-01-kit/input/snapshot.json --dir /tmp/v4-out
node scripts/shots.mjs --dir /tmp/v4-out
```

Node 22+, standard library only, no network at run time. `main.ts` fits everything
fresh from the snapshot; `scripts/check.mjs` is the 59-check gate.
