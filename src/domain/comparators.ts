import type { Row } from "../data/load-rows";
import { computeRowCpi } from "./cpi";
import { getEffectiveCalls } from "./edits";
import type { EditsMap } from "./edits";

export type SortableColumn = "id" | "name" | "specialty" | "region" | "territory" | "calls" | "trx" | "nrx" | "cpi";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortableColumn;
  direction: SortDirection;
}

// Extracts a comparable value for a row/column. Incomparable values
// (null specialty, a non-numeric `calls`, undefined CPI) come back as
// null and always sort last regardless of direction — see ASSUMPTIONS.md.
// calls/cpi use the row's *effective* value, i.e. any accepted edit wins
// over the originally-generated value.
function valueFor(row: Row, column: SortableColumn, edits: EditsMap): string | number | null {
  switch (column) {
    case "id":
      return row.id;
    case "name":
      return row.name;
    case "specialty":
      return row.specialty;
    case "region":
      return row.region;
    case "territory":
      return row.territory;
    case "calls": {
      const numeric = Number(getEffectiveCalls(row, edits));
      return Number.isFinite(numeric) ? numeric : null;
    }
    case "trx":
      return row.trx;
    case "nrx":
      return row.nrx;
    case "cpi":
      return computeRowCpi(getEffectiveCalls(row, edits), row.trx);
  }
}

export function compareRows(a: Row, b: Row, column: SortableColumn, direction: SortDirection, edits: EditsMap): number {
  const va = valueFor(a, column, edits);
  const vb = valueFor(b, column, edits);

  // rowKey is the stable tiebreaker everywhere below, which is what makes
  // sorting "stable" and "none" mean "back to original order".
  if (va === null && vb === null) return a.rowKey - b.rowKey;
  if (va === null) return 1;
  if (vb === null) return -1;

  const cmp =
    typeof va === "string" && typeof vb === "string"
      ? va.localeCompare(vb, undefined, { sensitivity: "base" })
      : (va as number) - (vb as number);

  if (cmp === 0) return a.rowKey - b.rowKey;
  return direction === "asc" ? cmp : -cmp;
}

export function compareNullableNumbers(va: number | null, vb: number | null, direction: SortDirection): number {
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const cmp = va - vb;
  return direction === "asc" ? cmp : -cmp;
}
