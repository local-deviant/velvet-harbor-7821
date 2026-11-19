# Token Radar v4

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/token-radar-01/local-deviant/velvet-harbor-7821/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/token-radar-01/local-deviant/velvet-harbor-7821/reward.svg)](https://make.fun)

A token launch radar for the [token-radar-01](https://make.fun) bounty: 198 pre-token
protocols ranked by implied value, with the farm economics worked out for each one —
what it is worth if it launches, how likely that is, and what a farmer actually nets.

> **Repo name note:** the two rank/reward badge URLs above name this repository
> (`local-deviant/velvet-harbor-7821`). When the repository is created under its final
> random name, update those two URLs to the real `<owner>/<repo>` before submitting;
> the competition badge (`token-radar-01.svg`) never changes.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot
(`input/snapshot.json`, 758 protocols as of 2026-11-14), fits the model fresh on every
run, and writes:

- `board.json` — 198 ranked rows, total implied value $1.56B
- `data.js` — the dashboard's data, beside the page
- `dashboard/` — the page, its proof (`00-proof.md`) and validation summary
- `dossier.json` — the judge's dossier, built with the kit's `vendor/makefun-board.ts`

## The model, in one paragraph

Implied value = value-if-it-launches × launch odds. Value-if-it-launches comes from
a size curve, ln(mcap) = 7.6842 + 0.50 × ln(TVL) + category offset + ln(1 + growth × 0.3),
fitted on 109 traded comparables (leave-one-out ×3.25, time split ×2.24, walk-forward
×2.82). Launch odds come from a binned hazard fitted by maximum likelihood, which
beat the Weibull on a 70/30 hold-out (Brier 0.217 vs 0.225). Farm economics use two
lenses: a deposit-proportional lens and a slice lens (one active farmer's calibrated
0.0020% share of the expected value, netted to the low end of the ×4.77 model band,
less fee and 4% T-bill). The top of the board farms: 44 FARM rows, median net $41,
best net $225 ($196/h). The full account — with worked odds, worked farm arithmetic,
the ablation table and the honest limits — is in `dashboard/00-proof.md`.

## Run it

```sh
node main.ts --input <snapshot.json> --output out
node scripts/check.mjs   # 40+ checks: determinism, gate, ledger, hand arithmetic, dossier
node scripts/shots.mjs --dir out   # 3 screenshots at 1440px, no console errors
```

Two runs write byte-identical output. No network at run time.

## Referral

Built with [make.fun](https://make.fun) — referral code `njrtxptt`.
