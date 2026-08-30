import { describe, it, expect } from "vitest";
import { buildAggregates, applyCallsDelta, territoryKey } from "../domain/aggregate";
import type { Row } from "../data/load-rows";

function makeRow(overrides: Partial<Row> & { rowKey: number }): Row {
  return {
    id: `HCP-${overrides.rowKey}`,
    name: "Test",
    specialty: "Cardiology",
    region: "West",
    territory: "West / T1",
    calls: 10,
    trx: 100,
    nrx: 20,
    ...overrides,
  };
}

describe("buildAggregates", () => {
  it("sums calls/trx/nrx and counts rows per territory and region", () => {
    const rows = [
      makeRow({ rowKey: 0, calls: 10, trx: 100, nrx: 20 }),
      makeRow({ rowKey: 1, calls: 15, trx: 50, nrx: 5 }),
    ];
    const aggregates = buildAggregates(rows);

    const territory = aggregates.territory.get(territoryKey("West", "West / T1"))!;
    expect(territory.sumCalls).toBe(25);
    expect(territory.sumTrx).toBe(150);
    expect(territory.sumNrx).toBe(25);
    expect(territory.hcpCount).toBe(2);

    const region = aggregates.region.get("West")!;
    expect(region.sumCalls).toBe(25);
  });

  it("excludes a non-numeric calls value from sumCalls but still counts the row", () => {
    const rows = [makeRow({ rowKey: 0, calls: "oops" })];
    const aggregates = buildAggregates(rows);
    const territory = aggregates.territory.get(territoryKey("West", "West / T1"))!;
    expect(territory.sumCalls).toBe(0);
    expect(territory.skippedCallsCount).toBe(1);
    expect(territory.hcpCount).toBe(1);
  });
});

describe("applyCallsDelta", () => {
  it("applies an O(1) delta to both the territory and its parent region", () => {
    const rows = [makeRow({ rowKey: 0, calls: 10 })];
    const base = buildAggregates(rows);
    const updated = applyCallsDelta(base, { region: "West", territory: "West / T1" }, 10, 25);

    expect(updated.territory.get(territoryKey("West", "West / T1"))!.sumCalls).toBe(25);
    expect(updated.region.get("West")!.sumCalls).toBe(25);
  });

  it("does not mutate the original aggregates object (immutable update)", () => {
    const rows = [makeRow({ rowKey: 0, calls: 10 })];
    const base = buildAggregates(rows);
    applyCallsDelta(base, { region: "West", territory: "West / T1" }, 10, 25);

    expect(base.territory.get(territoryKey("West", "West / T1"))!.sumCalls).toBe(10);
  });
});
