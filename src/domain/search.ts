import type { Row } from "../data/load-rows";

// Search matches name or ID, case-insensitively. Identity (rowKey) is
// never searched — id is a display/search field only, see ASSUMPTIONS.md.
export function matchesSearch(row: Row, search: string): boolean {
  if (search === "") return true;
  const needle = search.toLowerCase();
  return row.name.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle);
}

export function getRegionList(rows: Row[]): string[] {
  return [...new Set(rows.map((row) => row.region))].sort();
}
