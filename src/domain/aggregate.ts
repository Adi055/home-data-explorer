import type { Row } from "../data/load-rows";

export interface GroupAggregate {
  sumCalls: number;
  sumTrx: number;
  sumNrx: number;
  hcpCount: number;
  // rows whose `calls` couldn't be coerced to a number — excluded from
  // sumCalls so a bad value doesn't quietly skew the aggregate/CPI.
  skippedCallsCount: number;
}

export interface Aggregates {
  territory: Map<string, GroupAggregate>;
  region: Map<string, GroupAggregate>;
}

export function territoryKey(region: string, territory: string): string {
  return `${region}::${territory}`;
}

function emptyAggregate(): GroupAggregate {
  return { sumCalls: 0, sumTrx: 0, sumNrx: 0, hcpCount: 0, skippedCallsCount: 0 };
}

function addRow(aggregate: GroupAggregate, row: Row): void {
  const numericCalls = Number(row.calls);
  if (Number.isFinite(numericCalls)) {
    aggregate.sumCalls += numericCalls;
  } else {
    aggregate.skippedCallsCount += 1;
  }
  aggregate.sumTrx += row.trx;
  aggregate.sumNrx += row.nrx;
  aggregate.hcpCount += 1;
}

// Walks all rows once and builds both grouping levels' sums together.
// Called once at startup; accepted edits update these in place afterward
// via applyCallsDelta (added in Phase 4) instead of rebuilding from scratch.
export function buildAggregates(rows: Row[]): Aggregates {
  const territory = new Map<string, GroupAggregate>();
  const region = new Map<string, GroupAggregate>();

  for (const row of rows) {
    const tKey = territoryKey(row.region, row.territory);
    let territoryAgg = territory.get(tKey);
    if (!territoryAgg) {
      territoryAgg = emptyAggregate();
      territory.set(tKey, territoryAgg);
    }
    addRow(territoryAgg, row);

    let regionAgg = region.get(row.region);
    if (!regionAgg) {
      regionAgg = emptyAggregate();
      region.set(row.region, regionAgg);
    }
    addRow(regionAgg, row);
  }

  return { territory, region };
}

// O(1) update applied when a single-cell edit is accepted (or undone/redone)
// — never a full rebuild. Returns new Maps (immutable update) so React
// sees a changed `aggregates` reference and re-renders the affected rows.
export function applyCallsDelta(
  aggregates: Aggregates,
  groupKeys: { region: string; territory: string },
  prevValue: number | string,
  nextValue: number | string,
): Aggregates {
  const prevNumeric = Number(prevValue);
  const nextNumeric = Number(nextValue);
  const prevValid = Number.isFinite(prevNumeric);
  const nextValid = Number.isFinite(nextNumeric);
  const callsDelta = (nextValid ? nextNumeric : 0) - (prevValid ? prevNumeric : 0);
  const skippedDelta = (nextValid ? 0 : 1) - (prevValid ? 0 : 1);

  function applyToMap<K>(map: Map<K, GroupAggregate>, key: K): Map<K, GroupAggregate> {
    const current = map.get(key);
    if (!current) return map;
    const next = new Map(map);
    next.set(key, {
      ...current,
      sumCalls: current.sumCalls + callsDelta,
      skippedCallsCount: current.skippedCallsCount + skippedDelta,
    });
    return next;
  }

  return {
    territory: applyToMap(aggregates.territory, territoryKey(groupKeys.region, groupKeys.territory)),
    region: applyToMap(aggregates.region, groupKeys.region),
  };
}
