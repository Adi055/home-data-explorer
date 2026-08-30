import { describe, it, expect } from "vitest";
import { compareRows } from "../domain/comparators";
import type { Row } from "../data/load-rows";

function makeRow(overrides: Partial<Row> & { rowKey: number }): Row {
  return {
    id: `HCP-${overrides.rowKey}`,
    name: "Test Person",
    specialty: "Cardiology",
    region: "West",
    territory: "West / T1",
    calls: 10,
    trx: 100,
    nrx: 50,
    ...overrides,
  };
}

describe("compareRows", () => {
  it("sorts numeric calls ascending/descending", () => {
    const a = makeRow({ rowKey: 0, calls: 5 });
    const b = makeRow({ rowKey: 1, calls: 20 });
    expect(compareRows(a, b, "calls", "asc", {})).toBeLessThan(0);
    expect(compareRows(a, b, "calls", "desc", {})).toBeGreaterThan(0);
  });

  it("sorts null specialty last regardless of direction", () => {
    const withSpecialty = makeRow({ rowKey: 0, specialty: "Cardiology" });
    const withoutSpecialty = makeRow({ rowKey: 1, specialty: null });
    expect(compareRows(withSpecialty, withoutSpecialty, "specialty", "asc", {})).toBeLessThan(0);
    expect(compareRows(withSpecialty, withoutSpecialty, "specialty", "desc", {})).toBeLessThan(0);
  });

  it("treats a non-numeric calls value as incomparable (sorts last)", () => {
    const numeric = makeRow({ rowKey: 0, calls: 10 });
    const nonNumeric = makeRow({ rowKey: 1, calls: "not-a-number" });
    expect(compareRows(numeric, nonNumeric, "calls", "asc", {})).toBeLessThan(0);
    expect(compareRows(numeric, nonNumeric, "calls", "desc", {})).toBeLessThan(0);
  });

  it("uses rowKey as a stable tiebreaker when values are equal", () => {
    const a = makeRow({ rowKey: 0, calls: 10 });
    const b = makeRow({ rowKey: 1, calls: 10 });
    expect(compareRows(a, b, "calls", "asc", {})).toBeLessThan(0);
    expect(compareRows(a, b, "calls", "desc", {})).toBeLessThan(0);
  });

  it("sorts by the effective (edited) value, not the raw generated value", () => {
    const a = makeRow({ rowKey: 0, calls: 5 });
    const b = makeRow({ rowKey: 1, calls: 20 });
    const edits = { 0: { status: "saved" as const, value: 99, commandId: "cmd-1" } };
    expect(compareRows(a, b, "calls", "asc", edits)).toBeGreaterThan(0);
  });

  it("returns null CPI (trx=0) last, same as any other incomparable value", () => {
    const withCpi = makeRow({ rowKey: 0, calls: 10, trx: 100 });
    const zeroTrx = makeRow({ rowKey: 1, calls: 10, trx: 0 });
    expect(compareRows(withCpi, zeroTrx, "cpi", "asc", {})).toBeLessThan(0);
    expect(compareRows(withCpi, zeroTrx, "cpi", "desc", {})).toBeLessThan(0);
  });
});
