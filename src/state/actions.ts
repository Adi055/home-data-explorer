import type { SortableColumn } from "../domain/comparators";

export type Action =
  | { type: "TOGGLE_REGION_EXPANDED"; region: string }
  | { type: "TOGGLE_TERRITORY_EXPANDED"; territoryKey: string }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_REGION_FILTER"; region: string | null }
  | { type: "SET_SORT"; column: SortableColumn }
  | {
      type: "EDIT_COMMIT";
      rowKey: number;
      prevValue: number | string;
      nextValue: number;
      commandId: string;
      groupKeys: { region: string; territory: string };
    }
  | { type: "EDIT_RESOLVED"; rowKey: number; commandId: string }
  | { type: "EDIT_REJECTED"; rowKey: number; commandId: string; reason: string }
  | { type: "UNDO" }
  | { type: "REDO"; newCommandId: string }
  | { type: "DISMISS_TOAST"; id: string };
