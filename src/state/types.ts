import type { SortState } from "../domain/comparators";
import type { EditsMap } from "../domain/edits";
import type { UndoState } from "../domain/undo";
import type { Aggregates } from "../domain/aggregate";
import { buildAggregates } from "../domain/aggregate";
import { loadRows } from "../data/load-rows";

export interface UiState {
  expandedRegions: Set<string>;
  expandedTerritories: Set<string>;
  search: string;
  regionFilter: string | null;
  sort: SortState | null;
}

export interface Toast {
  id: string;
  message: string;
}

export interface AppState {
  ui: UiState;
  edits: EditsMap;
  aggregates: Aggregates;
  undo: UndoState;
  toasts: Toast[];
}

export function createInitialState(): AppState {
  return {
    // Everything starts collapsed: cheapest initial render, and it matches
    // most users' first move (scan regions, drill into one).
    ui: {
      expandedRegions: new Set(),
      expandedTerritories: new Set(),
      search: "",
      regionFilter: null,
      sort: null,
    },
    edits: {},
    aggregates: buildAggregates(loadRows()),
    undo: { past: [], future: [] },
    toasts: [],
  };
}
