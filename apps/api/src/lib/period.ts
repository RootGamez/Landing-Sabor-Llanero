/** Mes calendario actual en formato 'YYYY-MM' (mismo formato que `raffle_entries.period`/`raffle_draws.period`). */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
