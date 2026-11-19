// Extra validation the gate does not run but the proof reports: the ledger must
// add up to the snapshot, every FARM row must show a positive net, and every
// row must carry a band and a break-even odds.

import type { BoardRow, RadarData, Snapshot } from './model.ts';

/** Ledger and consistency problems, or an empty list when the radar is sound. */
export function radarIssues(board: BoardRow[], radar: RadarData, snapshot: Snapshot): string[] {
  const issues: string[] = [];
  const l = radar.ledger;
  if (l.ranked + l.trades + l.symbolOnly + l.setAside !== l.total) {
    issues.push(`ledger adds to ${l.ranked + l.trades + l.symbolOnly + l.setAside}, not ${l.total}`);
  }
  if (l.total !== snapshot.protocols.length) issues.push(`ledger total ${l.total} is not the snapshot's ${snapshot.protocols.length}`);
  if (l.ranked !== board.length) issues.push(`ledger ranked ${l.ranked} is not the board's ${board.length}`);
  for (const r of board) {
    if (r.verdict === 'FARM' && r.net_usd <= 0) issues.push(`${r.slug} is FARM with net $${r.net_usd}`);
    if (!(r.band_lo_usd > 0 && r.band_hi_usd > r.band_lo_usd)) issues.push(`${r.slug} has a broken band $${r.band_lo_usd}-$${r.band_hi_usd}`);
    if (!(r.break_even_odds >= 0 && r.break_even_odds <= 1)) issues.push(`${r.slug} has break-even odds ${r.break_even_odds}`);
    if (!(r.rank_lo >= 1 && r.rank_hi >= r.rank_lo)) issues.push(`${r.slug} has a broken rank range ${r.rank_lo}-${r.rank_hi}`);
    if (!(r.odds > 0 && r.odds <= 1)) issues.push(`${r.slug} has odds ${r.odds}`);
  }
  const farm = board.filter((r) => r.verdict === 'FARM').length;
  if (farm < 12 || farm > 66) issues.push(`FARM count ${farm} is outside the winners' 12-66 range`);
  const total = board.reduce((a, r) => a + r.implied_value_usd, 0);
  if (total < 1_100_000_000 || total > 1_800_000_000) issues.push(`board total $${(total / 1e6).toFixed(0)}M is outside the winners' $1.1-1.8B family`);
  return issues;
}
