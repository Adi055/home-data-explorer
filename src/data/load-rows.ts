import { generateRows } from "./hcp-generator";
import type { HcpRecord } from "./hcp-generator";

// A row plus its stable identity. `id` from the generator can repeat
// (see ASSUMPTIONS.md), so we key everything internally by rowKey instead.
export interface Row extends HcpRecord {
  rowKey: number;
}

let cachedRows: Row[] | null = null;

// generateRows() is deterministic and only needs to run once per app load.
export function loadRows(): Row[] {
  if (!cachedRows) {
    cachedRows = generateRows().map((record, rowKey) => ({ ...record, rowKey }));
  }
  return cachedRows;
}
