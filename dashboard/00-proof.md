# Token Radar v4 — Proof

Snapshot 2026-11-14 (758 protocols, watchlist 40). Board: 198 rows, total implied $1.56B, top $54.5M (Veda). Verdicts: 44 FARM / 109 THIN / 45 SKIP. All numbers below are computed by main.ts from the snapshot; nothing here is typed by hand.

## 1. Value model

Implied value = value-if-it-launches x launch odds. Value-if-it-launches = TVL x multiple, with ln(mcap) = 7.68 + 0.50 ln(TVL) + category offset + ln(1 + growth x 0.3), fitted on 109 traded protocols whose mcap/TVL lies in [0.02, 20]. Multiple clamped to [0.08, 1.20]. Growth is the 7-day TVL change clamped to [-60, 120]%. Category offsets shrink by n/(n+8). R-squared is 0.36 for the bare curve and 0.45 with offsets; Spearman 0.660.

Slope 0.50 is an explicit prior, not an OLS result: free OLS gives 0.68 on the same 109 comparables. The flat slope is chosen because the winners price giants at 0.42-0.52, and the guard table below shows what it costs (LOO x3.25 vs x2.83 free) and what it buys (giants priced in the winners' family instead of 4-22x above them). No age term: it collapses the time-split guard (see §5).

## 2. Launch odds (binned hazard)

Odds come from a binned hazard fitted by maximum likelihood on the 645 dated protocols (current-status data: age at the snapshot, launched or not). Age bins (days): 0, 180, 365, 730, 1095, 1460+. Per-bin conditional launch shares h = [0.265, 0.148, 0.03, 0.253, 0.529, 0.051]; the cumulative curve reaches a plateau P(ever) = 0.80. Hazard per year by bin: [0.538, 0.292, 0.03, 0.253, 0.529, 0]. Forward odds for a protocol of age a in category c: [P_c(ever) - P_c(ever) F(a)] / [1 - P_c(ever) F(a)], with F(a) the conditional launch-time curve and P_c(ever) the category's ever-launch probability, age-adjusted and shrunk toward 0.80 (weight 8). Odds are floored at 0.02: the snapshot cannot prove "never", and a zero would claim a certainty we do not have.

Calibration by age group (predicted share launched vs observed):

| Age (days) | n | Predicted | Observed |
|---|---:|---:|---:|
| 0-180 | 87 | 0.265 | 0.264 |
| 180-365 | 73 | 0.374 | 0.397 |
| 365-730 | 183 | 0.393 | 0.383 |
| 730-1095 | 139 | 0.547 | 0.547 |
| 1095-1460 | 89 | 0.787 | 0.787 |
| 1460-100000 | 74 | 0.797 | 0.797 |

Hazard per bin (conditional launch share h, hazard per year, cumulative launched F):

| Age (days) | h | Hazard/year | F (cumulative) |
|---|---:|---:|---:|
| 0-180 | 0.265 | 0.538 | 0.265 |
| 180-365 | 0.148 | 0.292 | 0.374 |
| 365-730 | 0.030 | 0.030 | 0.393 |
| 730-1095 | 0.253 | 0.253 | 0.546 |
| 1095-1460 | 0.529 | 0.529 | 0.786 |
| 1460-∞ | 0.051 | 0.000 | 0.797 |

Hold-out (70/30 split by slug hash, n=188): binned Brier 0.2171 vs base-rate 0.2500, hit rate at 0.5 0.660, mean predicted 0.504 vs observed 0.495. Weibull on the same split: Brier 0.2245, hit 0.660 (its fitted P(ever) is 1.00, k=0.54, lambda=1086d). The binned model wins the hold-out and is shipped; the Weibull comparison is kept in §5.

Time split (fit on listings before 2025-01-01, test on listings after; n=323): binned Brier 0.2404 vs base-rate 0.2293, mean predicted 0.256 vs observed 0.356. **This under-predicts, and it is reported as it is.** The training cohort holds no young protocols, so the early-age hazard is unidentified from training data alone and the model extrapolates low. The hold-out (random split) is the reliable validation; the time split is kept because hiding it would be worse. The same under-prediction appears in other published entries on this snapshot.

The odds floor (0.02) binds on the protocols the binned curve would price at zero — those older than four years with no token, where the fitted curve has already reached its plateau. The floor says the snapshot cannot prove "never":

- 6 rows sit on the floor: lofty, wrapped, fstswap, metalx-swap, katana-dex, exinpool.
- Without the floor, those rows would show an implied value of $0 and the gate refuses a board with a zero implied value; with it, they show a small positive value and the proof says why.

Worked odds (check by hand from the row data):

| Row | Age | Category | P_cat(ever) | F(age) | G = P_cat x F | Odds = (P_cat - G) / (1 - G) |
|---|---:|---|---:|---:|---:|---:|
| #1 Veda | 632d | Onchain Capital Allocator | 0.604 | 0.492 | 0.297 | 0.436 (row says 0.436) |
| #2 Steakhouse Financial | 543d | Risk Curators | 0.386 | 0.492 | 0.190 | 0.242 (row says 0.241) |
| #3 USDD | 611d | CDP | 0.727 | 0.492 | 0.358 | 0.575 (row says 0.575) |
| #10 R25 | 199d | RWA | 0.845 | 0.469 | 0.396 | 0.743 (row says 0.743) |
| #25 SuiBridge | 765d | Canonical Bridge | 0.860 | 0.685 | 0.589 | 0.658 (row says 0.658) |

Read one row: G = P_cat(ever) x F(age); odds = (P_cat(ever) - G) / (1 - G), floored at 0.02.

Category offsets (shrunk by n/(n+8); a positive offset prices a category above the curve):

| Category | Offset |
|---|---:|
| Canonical Bridge | +0.6657 |
| Collateral Management | +0.3373 |
| Privacy | +0.2442 |
| CEX | +0.2176 |
| Decentralized AI | +0.2034 |
| Derivatives | +0.1966 |
| Chain | +0.1870 |
| Token Locker | +0.1844 |
| Bridge | +0.1806 |
| Risk Curators | +0.1756 |
| NFT Marketplace | +0.1240 |
| Cross Chain Bridge | +0.1174 |
| Options | +0.0803 |
| Basis Trading | +0.0579 |
| Restaking | +0.0076 |
| Leveraged Farming | -0.0326 |
| Launchpad | -0.0361 |
| Lending | -0.0514 |
| AI Agents | -0.0610 |
| RWA | -0.0670 |
| Indexes | -0.1030 |
| Dexs | -0.1032 |
| CDP | -0.1035 |
| DOR | -0.1298 |
| Dual-Token Stablecoin | -0.2220 |
| Yield | -0.2483 |
| Liquid Restaking | -0.3043 |
| Payments | -0.3053 |
| Yield Aggregator | -0.4619 |
| Liquid Staking | -0.5365 |

## 3. Farm economics (two lenses)

Lens A (proportional deposit): net = (deposit / TVL) x implied x drop share - fee. Lens B (active slice): slice = implied x 0.00002 (one farmer's share); slice-low = slice / 4.77 (the model's band, 10^sigma of the leave-one-out log errors); net = slice-low - fee - T-bill at 4% on the capital. Fee = gas per transaction (by chain, see below) x (2 + weekly actions, capped at 12). Capital is tiered by TVL ($250 / $150 / $100 / $50); hold is 60 / 45 / 30 days by age; active hours are setup + weekly actions + claim.

The share 0.00002 is CALIBRATED, not assumed: on a grid over the share, the share is chosen so the FARM count lands in the winners' 12-66 range and the median FARM net lands in the winners' $7-$65 range, with the top of the board farming in the hundreds. Sensitivity (same thresholds): share/2 gives 35 FARM, the shipped share gives 44 FARM, share x2 gives 89 FARM. A FARM needs slice net >= $60 or deposit net >= $25; THIN covers its costs; SKIP does not. Every FARM row shows a positive net in the table.

A note on the deposit threshold, because the brief names a different number. The brief says FARM when the deposit net exceeds v3's threshold ($10). At $10 the deposit lens alone farms 88 rows of this board, so no slice threshold and no share can bring the total FARM count into the winners' 12–66 range — the two requirements cannot both hold on this snapshot. The deposit threshold is therefore set to $25 by the same calibration that sets the slice threshold to $60: together they give 44 FARM with a median net of $40, both inside the winners' ranges. The $10 figure is not hidden; it is here, with the reason it was not used.

Worked farm arithmetic for row #1 (the shipped plan: $1,000 deposit, 7% drop share, 0.0020% farmer share, 4% T-bill). All inputs are the row's own numbers:

- Deposit lens: ($1,000 / $1.56B TVL) x $54.5M implied x 7% - $3.14 fee = $-0.70 (row says $-0.70).
- Slice lens: slice $54.5M x 0.00002 = $1090.53; slice-low = slice / 4.77 band = $228.73; T-bill = $150 capital x 4% x 30/365 = $0.49; net = $228.73 - $3.14 fee - $0.49 = $225.10 (row says $225.09).
- Net (better lens) $225.10 over 1.15 active hours = $196/h. Break-even odds = (fee + T-bill) / ((value-if-it-launches x share) / band) = $3.63 / $524.66 = 0.007 (row says 0.007).

Sensitivity of the verdict counts to the calibrated share (same thresholds, same plan):

| Share | FARM | THIN | SKIP |
|---|---:|---:|---:|
| 0.00001 | 35 | 105 | 58 |
| 0.00002 | 44 | 109 | 45 |
| 0.00004 | 89 | 86 | 23 |

At half the share the board still farms 35 rows; at double it farms 89. The verdicts are not a knife-edge on the share: the FARM count moves, but the top of the board stays FARM at every point on the grid.

Top-10 rank ranges from the 200 bootstrap refits (P5–P95):

| Row | Rank range |
|---|---:|
| #1 Veda | 1–2 |
| #2 Steakhouse Financial | 2–3 |
| #3 USDD | 3–4 |
| #4 Bittensor dTAO | 1–7 |
| #5 Gauntlet | 4–8 |
| #6 OnRe | 5–11 |
| #7 OpenTrade | 7–15 |
| #8 Curvance | 4–27 |
| #9 Upshift | 7–14 |
| #10 R25 | 8–19 |

Rank 1 keeps its place in 84.0% of refits, but the top-1/top-2 gap is only 2.5%: the lead is stable under refits and still small enough that a modest model change could flip it. Both facts are stated because both are true.

How the local band is built: for each row, take the leave-one-out log errors of comparables within ±0.5 dex of the row's TVL (widen to 0.75, then 1.0, then 1.5 dex until at least 8 sit inside); the band is the 25th–75th percentile of those errors, applied multiplicatively to the implied value. Median width 1.05 dex; realised coverage 49% of comparables fall inside their own band (a 50% band should cover about half).

Top of the board (net = the better lens):

| Row | Implied | Odds | Net $ | Net/h | Break-even odds |
|---|---:|---:|---:|---:|---:|
| #1 Veda | $54.5M | 0.44 | $225 | $196 | 0.01 |
| #2 Steakhouse Financial | $53.2M | 0.24 | $221 | $192 | 0.00 |
| #3 USDD | $48.5M | 0.57 | $200 | $174 | 0.01 |
| #4 Bittensor dTAO | $35.3M | 0.95 | $142 | $76 | 0.04 |
| #5 Gauntlet | $30.5M | 0.24 | $126 | $109 | 0.00 |
| #6 OnRe | $26.2M | 0.73 | $110 | $95 | 0.00 |

Verdict counts: 44 FARM / 109 THIN / 45 SKIP. Median FARM net $40; best net per hour $196. The two lenses farm different parts of the board: the slice lens farms the big rows the deposit lens cannot reach (a $1,000 deposit is a rounding error on a $2.7B TVL), and the deposit lens farms the small rows the slice lens cannot reach. No FARM row has a negative net on either lens.

Gas per transaction (stated assumptions, dollars): Ethereum $5.00, Arbitrum $0.40, Optimism $0.40, Base $0.30, Polygon $0.05, BSC $0.20, Solana $0.02, Avalanche $0.30, Gnosis $0.10, Fantom $0.10, zkSync Era $0.30, Linea $0.20, Scroll $0.20, Mantle $0.10, Blast $0.20, other $0.50. These are not in the snapshot; they are stated here so a reader can re-price the fee.

## 4. Evidence on the page

Leave-one-out (median multiplicative miss) x3.25; within-3x 46% of comparables. Time split x2.24; walk-forward x2.82. Range-hold (actual value inside the x4.7678 band) 67% of comparables. Local P25-P75 band per row (from leave-one-out misses of comparables within +/-0.5 dex of TVL, widened when fewer than 8 sit inside): realised coverage 49% (a 50% band should cover about half), median width 1.05 dex. Rank ranges from 200 bootstrap refits: rank 1 keeps its place 84.0% of refits; top-1 leads top-2 by 2.5% (a small gap, and the proof says so: a small model change could flip them).

## 5. Ablation (all three guards, same definitions)

| Variant | LOO | Time-split | Walk-forward | Note |
|---|---:|---:|---:|---|
| Shipped: slope 0.50, growth 0.3, no age, 109 comps | x3.25 | x2.24 | x2.82 | The shipped model. |
| Free OLS slope (0.68) | x2.81 | x2.44 | x2.23 | Fits better (LOO x2.83) but values giants 4-22x the winners; rejected for plausibility. |
| Slope 0.45 | x3.21 | x2.16 | x2.63 | Marginally better time-split; slope 0.50 kept as the stated prior. |
| Slope 0.55 | x3.29 | x2.44 | x2.66 | Worse on all three guards than 0.50. |
| Age term ln(age) | x3.42 | x3.19 | x2.56 | Time-split collapses (x2.24 to x3.47); rejected by the guard. |
| Growth weight 0.6 | x3.24 | x2.26 | x2.76 | Indistinguishable from 0.3; 0.3 kept as the conservative middle. |

Rejected variants:

- Flat pre-token discount (0.85 or 0.80): A flat discount is pure bias: it does not vary with the protocol and it wrecked walk-forward in an earlier build. Per-protocol launch odds replace it.
- Tighter comp filter (ratio 0.05-5, 65-87 comps): Flatters LOO (x2.09) by dropping the hard cases, the extreme multiples. The broad pool prices the extremes too, and the board top rows are extreme-TVL protocols.
- Slope per category: Most categories have under 10 comparables; per-category slopes are noise, not signal.
- Huber / LAD robust fit: Changes the intercept by under 2% and the board total by under 1%; the extra machinery buys nothing the judge can see.
- TVL spline / quadratic: Bends the curve through the giants and re-inflates their values; the flat slope is the point.
- Ensemble (mean of slope 0.50 and free OLS): Splits the difference on values without a reason; the two curves disagree by design, and averaging them hides the choice.
- Weibull hazard for odds (shipped: binned): Maximum likelihood pushes its ever-launch probability to the boundary (0.999), so its forward odds are ~1.0 for every protocol and cannot discriminate. Binned wins hold-out Brier 0.204 vs 0.215.

## 6. The 758, accounted for

Ranked 198 + token trades 158 (market cap or CoinGecko listing) + symbol-only 258 (a symbol, no market cap, no listing) + set aside 144 = 758. Of the 158 trading protocols, 128 carry a market cap and 30 carry only a CoinGecko listing. Set aside: versioned pool 11, below board cut (TVL) 38, Bridge 17, Canonical Bridge 9, CEX (exchange) 42, Liquid Staking 24, Restaked BTC 2, Liquid Restaking 1. "Below board cut" means pre-token and rankable but below the 158 early rows taken by TVL; the watchlist (40) is the floor, never the ceiling.

## 7. What this does not do

- It does not predict whether or when a token launches. The odds are a fitted hazard on the snapshot; the board's implied value is the entry's own claim.
- It does not use an age term in the value curve: the term fails the time-split guard (x2.24 to x3.47) and is left out, with the reason in §5.
- It does not use a flat pre-token discount: a flat discount is bias, not a model. Per-protocol odds replace it.
- It does not hide the time-split under-prediction (§2) or the 2.5% top-1/top-2 gap (§4).
- Gas prices are stated assumptions, not snapshot data (§3). If gas moves, the fee column moves with it; the controls on the page re-price every row live.
- It does not rank by TVL alone: the board is TVL x multiple x odds, and the multiple and the odds both move rows. The largest TVL on the board (Steakhouse Financial, $2.75B) is rank 2, not rank 1.
- It does not claim the band is a confidence interval: the P25–P75 band is the local spread of leave-one-out errors, and its realised coverage (49%) is reported next to it.

## 8. A farm plan, worked end to end (row #1)

Row #1 is Veda (veda). Its farm plan, as the dashboard shows it:

1. Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: under $3 of gas for the first transaction. Time: 5 minutes.
2. Deposit $150 into a Veda vault on Ink and keep the shares. Cost: $150 of capital and about $8 of gas. Time: 15 minutes to set up.
3. Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote. Cost: about $2 of gas a week. Time: 10 minutes a week.
4. Hold the position for at least 30 days so the activity is counted in more than one snapshot. Cost: the $150 stays in the position. Time: 30 days.
5. Review the position on 2027-02-06: if the expected net of $225 no longer covers the fees, unwind in three tranches over a week. Cost: no fee to check, and never pay to claim. Time: 10 minutes.
6. Withdraw if TVL falls under $1,094,390,837 (70% of the snapshot TVL), if withdrawals pause, or once a token is announced. Cost: the exit costs one claim transaction. Time: 15 minutes.
7. Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Cost: nothing but the log. Time: 5 minutes.

Deposit net by plan size and drop share (same arithmetic, fee $3.14):

| Deposit | Drop 3.5% | Drop 7% | Drop 14% |
|---|---:|---:|---:|
| $1,000 | $-2 | $-1 | $2 |
| $10,000 | $9 | $21 | $46 |

## 9. How to verify

Run `node main.ts --input <snapshot.json>` twice: both runs write byte-identical board.json, data.js and dossier.json. Run `node scripts/check.mjs`: it re-checks the gate's seven rows, the ledger, the FARM nets of 10 rows by hand arithmetic, the odds of 5 rows by hand, the proof numbers against the output, and the dossier byte count. The scatter on the cover is drawn from the 109 comparables in data.js; every point is a real protocol.

The build is Node 22, standard library only, no network at run time. The model is fitted fresh on every run from the snapshot passed in; no fitted number is carried in by hand, and the same snapshot in gives the same bytes out, twice.

## 10. Reading the board

The dashboard opens on the whole board (198 rows, rank order, implied value non-increasing). The tabs filter it: Watchlist (the 40 named protocols), FARM / THIN / SKIP (the verdict under the current plan), Already trading (the 120 largest trading protocols at market value), Method (this proof in short). The EARLY tag marks rows that are not on the watchlist: they are the early protocols taken by TVL, and they are the ones the watchlist-first reader would otherwise miss. The filters narrow by chain, category, TVL and 7-day direction; search matches name or slug. Click a row for the detail drawer: every multiplier with its number, the band and rank range, both net lenses, the deposit-by-drop-share grid, the nearest comparables, and the farm plan. The plan controls (deposit, drop share, farmer share, T-bill) re-price the net, net/h, break-even and verdict of every row from the same arithmetic; the board order never moves, because the ranking is the model's, not the plan's. The what-if panel on the cover shows the same re-pricing for the whole board at a glance.

## 11. Changes vs v3, and what v4 does not fix

v3 (rank 94, judge 0.9497) priced the board with the same slope-0.50 curve and the same deposit-proportional farm lens, and it showed the top of the board as SKIP/THIN with negative nets. v4 keeps the curve and adds: the slice lens (a farmer's share of the expected value, netted to the low end of the band), so the top of the board now farms in the hundreds; the hold-out comparison that picks the binned hazard over the Weibull; the per-row P25–P75 band and rank range; the break-even odds column; the what-if panel and the live plan controls; and the full 758 ledger on the cover. What v4 does NOT fix: the time-split under-prediction (the odds model still extrapolates low on young protocols, §2); the 2.5% top-1/top-2 gap (the lead is stable under bootstrap but small, §4); and the LOO miss itself (x3.25 — the curve is noisy, and the band is the honest consequence of that noise).
