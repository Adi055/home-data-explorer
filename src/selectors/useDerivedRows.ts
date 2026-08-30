import { useMemo } from "react";
import { loadRows } from "../data/load-rows";
import type { Aggregates } from "../domain/aggregate";
import { groupRows, sortGroupsAndRows, flattenGroups } from "../domain/pipeline";
import type { FlatRow } from "../domain/pipeline";
import { useAppState } from "../state/store";
import { timeOperation } from "../utils/timeOperation";

interface DerivedRows {
  flatRows: FlatRow[];
  aggregates: Aggregates;
  lastOperationMs: number;
  lastOperationLabel: string;
}

function describeOperation(ui: { sort: unknown; search: string; regionFilter: string | null }): string {
  if (ui.sort) return "sort";
  if (ui.search !== "") return "search";
  if (ui.regionFilter !== null) return "filter";
  return "update";
}

// rows are a stable, module-level singleton (see load-rows.ts) so they
// never trigger these memos to recompute on their own. aggregates live in
// AppState and update by O(1) delta on accepted edits (see aggregate.ts),
// never by rebuilding here. Grouping never changes after load. Sorting and
// flattening are timed together as one "operation" — this is what the
// Footer's timing readout reports (FR-1), and it recomputes exactly when a
// user-visible action (sort, search, filter, expand/collapse, accepted
// edit) actually changes something, not on every render.
export function useDerivedRows(): DerivedRows {
  const { ui, edits, aggregates } = useAppState();
  const rows = loadRows();

  const groups = useMemo(() => groupRows(rows), [rows]);

  const { flatRows, lastOperationMs, lastOperationLabel } = useMemo(() => {
    const { result, ms } = timeOperation(() => {
      const sortedGroups = sortGroupsAndRows(groups, ui.sort, aggregates, edits);
      return flattenGroups(sortedGroups, ui);
    });
    return { flatRows: result, lastOperationMs: ms, lastOperationLabel: describeOperation(ui) };
  }, [groups, ui, aggregates, edits]);

  return { flatRows, aggregates, lastOperationMs, lastOperationLabel };
}
