import { describe, it, expect } from "vitest";
import { computeRowCpi, computeAggregateCpi, formatCpi } from "../domain/cpi";

describe("computeRowCpi", () => {
  it("computes calls / trx * 100", () => {
    expect(computeRowCpi(40, 200)).toBe(20);
  });

  it("returns null when trx is 0, never Infinity", () => {
    expect(computeRowCpi(50, 0)).toBeNull();
  });

  it("coerces a numeric-string calls value", () => {
    expect(computeRowCpi("40", 200)).toBe(20);
  });

  it("returns null for a non-numeric calls value, never NaN", () => {
    expect(computeRowCpi("n/a", 200)).toBeNull();
  });
});

describe("computeAggregateCpi", () => {
  it("returns null when sumTrx is 0", () => {
    expect(computeAggregateCpi(0, 0)).toBeNull();
  });

  it("computes the ratio of sums, not an average of per-row CPIs", () => {
    expect(computeAggregateCpi(300, 1000)).toBe(30);
  });
});

describe("formatCpi", () => {
  it("renders null as an em dash", () => {
    expect(formatCpi(null)).toBe("—");
  });

  it("rounds to the nearest integer", () => {
    expect(formatCpi(19.6)).toBe("20");
  });
});
