// CPI = Calls / TRx * 100. Undefined whenever TRx is 0 or Calls isn't a
// usable number — we return null rather than let NaN/Infinity leak out,
// and callers render that as "—".
export function computeRowCpi(calls: number | string, trx: number): number | null {
  const numericCalls = Number(calls);
  if (!Number.isFinite(numericCalls) || trx === 0) return null;
  return (numericCalls / trx) * 100;
}

export function computeAggregateCpi(sumCalls: number, sumTrx: number): number | null {
  if (sumTrx === 0) return null;
  return (sumCalls / sumTrx) * 100;
}

export function formatCpi(cpi: number | null): string {
  return cpi === null ? "—" : cpi.toFixed(0);
}
