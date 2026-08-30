import type { Row } from "../data/load-rows";
import type { Aggregates, GroupAggregate } from "./aggregate";
import { territoryKey } from "./aggregate";
import { computeAggregateCpi } from "./cpi";
import { compareRows, compareNullableNumbers } from "./comparators";
import type { SortState, SortableColumn } from "./comparators";
import { matchesSearch } from "./search";
import type { EditsMap } from "./edits";

export interface TerritoryGroup {
  region: string;
  territory: string;
  rows: Row[];
}

export interface RegionGroup {
  region: string;
  territories: TerritoryGroup[];
}

// Groups by Region -> Territory in canonical (alphabetical) order. This is
// the structural grouping step — it never depends on sort/search/filter,
// so it only reruns when the underlying rows change (never, post-load).
export function groupRows(rows: Row[]): RegionGroup[] {
  const regionMap = new Map<string, Map<string, Row[]>>();

  for (const row of rows) {
    let territoryMap = regionMap.get(row.region);
    if (!territoryMap) {
      territoryMap = new Map();
      regionMap.set(row.region, territoryMap);
    }
    let territoryRows = territoryMap.get(row.territory);
    if (!territoryRows) {
      territoryRows = [];
      territoryMap.set(row.territory, territoryRows);
    }
    territoryRows.push(row);
  }

  const regions = [...regionMap.keys()].sort();
  return regions.map((region) => {
    const territoryMap = regionMap.get(region)!;
    const territories = [...territoryMap.keys()].sort();
    return {
      region,
      territories: territories.map((territory) => ({
        region,
        territory,
        rows: territoryMap.get(territory)!,
      })),
    };
  });
}

const NUMERIC_COLUMNS = new Set<SortableColumn>(["calls", "trx", "nrx", "cpi"]);

function aggregateValueFor(aggregate: GroupAggregate | undefined, column: SortableColumn): number | null {
  if (!aggregate) return null;
  switch (column) {
    case "calls":
      return aggregate.sumCalls;
    case "trx":
      return aggregate.sumTrx;
    case "nrx":
      return aggregate.sumNrx;
    case "cpi":
      return computeAggregateCpi(aggregate.sumCalls, aggregate.sumTrx);
    default:
      return null;
  }
}

// Sorts rows within each territory by the active column, and — when that
// column is numeric — reorders territories (and regions) by their
// aggregate value for the same column, per FR-3. A text-column sort or no
// sort at all leaves groups in canonical alphabetical order.
export function sortGroupsAndRows(
  groups: RegionGroup[],
  sort: SortState | null,
  aggregates: Aggregates,
  edits: EditsMap,
): RegionGroup[] {
  if (!sort) return groups;

  let orderedGroups = groups;
  if (NUMERIC_COLUMNS.has(sort.column)) {
    orderedGroups = [...groups].sort((a, b) =>
      compareNullableNumbers(
        aggregateValueFor(aggregates.region.get(a.region), sort.column),
        aggregateValueFor(aggregates.region.get(b.region), sort.column),
        sort.direction,
      ),
    );
    orderedGroups = orderedGroups.map((regionGroup) => ({
      ...regionGroup,
      territories: [...regionGroup.territories].sort((a, b) =>
        compareNullableNumbers(
          aggregateValueFor(aggregates.territory.get(territoryKey(a.region, a.territory)), sort.column),
          aggregateValueFor(aggregates.territory.get(territoryKey(b.region, b.territory)), sort.column),
          sort.direction,
        ),
      ),
    }));
  }

  return orderedGroups.map((regionGroup) => ({
    ...regionGroup,
    territories: regionGroup.territories.map((territoryGroup) => ({
      ...territoryGroup,
      rows: [...territoryGroup.rows].sort((a, b) => compareRows(a, b, sort.column, sort.direction, edits)),
    })),
  }));
}

export type FlatRow =
  | { kind: "region-header"; key: string; region: string }
  | { kind: "territory-header"; key: string; region: string; territory: string }
  | { kind: "data-row"; key: number; row: Row };

export interface FlattenUiState {
  expandedRegions: Set<string>;
  expandedTerritories: Set<string>;
  search: string;
  regionFilter: string | null;
}

// Flattens the grouped tree into one array for the virtualizer, applying
// the region filter and text search along the way. A collapsed group's
// rows (or a filtered-out group) are left out of the array entirely, not
// just hidden, so they cost nothing to render or scroll past. While
// searching, a group containing a match is shown expanded regardless of
// its manual expand/collapse state (without mutating that state), and a
// group with no match is hidden — this is what "auto-expand" means here.
export function flattenGroups(groups: RegionGroup[], ui: FlattenUiState): FlatRow[] {
  const flat: FlatRow[] = [];
  const searching = ui.search !== "";

  for (const regionGroup of groups) {
    if (ui.regionFilter !== null && regionGroup.region !== ui.regionFilter) continue;

    const territoriesWithMatches = regionGroup.territories.map((territoryGroup) => ({
      territoryGroup,
      matchingRows: searching ? territoryGroup.rows.filter((row) => matchesSearch(row, ui.search)) : territoryGroup.rows,
    }));

    const regionHasMatch = territoriesWithMatches.some((t) => t.matchingRows.length > 0);
    if (searching && !regionHasMatch) continue;

    flat.push({ kind: "region-header", key: `region:${regionGroup.region}`, region: regionGroup.region });

    const regionExpanded = ui.expandedRegions.has(regionGroup.region) || (searching && regionHasMatch);
    if (!regionExpanded) continue;

    for (const { territoryGroup, matchingRows } of territoriesWithMatches) {
      if (searching && matchingRows.length === 0) continue;

      const tKey = territoryKey(territoryGroup.region, territoryGroup.territory);
      flat.push({
        kind: "territory-header",
        key: `territory:${tKey}`,
        region: territoryGroup.region,
        territory: territoryGroup.territory,
      });

      const territoryExpanded = ui.expandedTerritories.has(tKey) || (searching && matchingRows.length > 0);
      if (!territoryExpanded) continue;

      for (const row of matchingRows) {
        flat.push({ kind: "data-row", key: row.rowKey, row });
      }
    }
  }

  return flat;
}
