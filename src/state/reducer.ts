import type { AppState } from "./types";
import type { Action } from "./actions";
import type { SortState } from "../domain/comparators";
import type { Command } from "../domain/undo";
import { findCommand } from "../domain/undo";
import type { EditsMap } from "../domain/edits";
import { applyCallsDelta } from "../domain/aggregate";
import { loadRows } from "../data/load-rows";
import { nextId } from "./idGenerator";

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// asc -> desc -> none, per column. Picking a different column always
// starts that column fresh at "asc".
function nextSort(current: SortState | null, column: SortState["column"]): SortState | null {
  if (!current || current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return null;
}

function isBaselineValue(rowKey: number, value: number | string): boolean {
  return loadRows()[rowKey].calls === value;
}

function replaceCommand(commands: Command[], updated: Command): Command[] {
  return commands.map((command) => (command.id === updated.id ? updated : command));
}

function omitKey(edits: EditsMap, rowKey: number): EditsMap {
  const next = { ...edits };
  delete next[rowKey];
  return next;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "TOGGLE_REGION_EXPANDED":
      return {
        ...state,
        ui: { ...state.ui, expandedRegions: toggle(state.ui.expandedRegions, action.region) },
      };

    case "TOGGLE_TERRITORY_EXPANDED":
      return {
        ...state,
        ui: { ...state.ui, expandedTerritories: toggle(state.ui.expandedTerritories, action.territoryKey) },
      };

    case "SET_SEARCH":
      return { ...state, ui: { ...state.ui, search: action.search } };

    case "SET_REGION_FILTER":
      return { ...state, ui: { ...state.ui, regionFilter: action.region } };

    case "SET_SORT":
      return { ...state, ui: { ...state.ui, sort: nextSort(state.ui.sort, action.column) } };

    case "EDIT_COMMIT": {
      // Locked while a previous commit for this row is still in flight —
      // this shouldn't fire since the UI locks the cell, but stay safe.
      if (state.edits[action.rowKey]?.status === "pending") return state;

      const command: Command = {
        id: action.commandId,
        type: "edit-calls",
        rowKey: action.rowKey,
        prevValue: action.prevValue,
        nextValue: action.nextValue,
        stale: false,
        status: "pending",
        groupKeys: action.groupKeys,
      };

      return {
        ...state,
        edits: {
          ...state.edits,
          [action.rowKey]: { status: "pending", value: action.nextValue, commandId: command.id },
        },
        // A fresh commit always starts a new redo branch.
        undo: { past: [...state.undo.past, command], future: [] },
      };
    }

    case "EDIT_RESOLVED": {
      const command = findCommand(state.undo, action.commandId);
      if (!command || command.stale) return state; // late response for an undone/superseded edit

      const aggregates = applyCallsDelta(state.aggregates, command.groupKeys, command.prevValue, command.nextValue);
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.rowKey]: { status: "saved", value: command.nextValue, commandId: command.id },
        },
        aggregates,
        undo: { ...state.undo, past: replaceCommand(state.undo.past, { ...command, status: "saved" }) },
      };
    }

    case "EDIT_REJECTED": {
      const command = findCommand(state.undo, action.commandId);
      if (!command || command.stale) return state;

      return {
        ...state,
        edits: {
          ...state.edits,
          [action.rowKey]: {
            status: "rejected",
            value: command.prevValue,
            rejectionReason: action.reason,
            commandId: command.id,
          },
        },
        // Nothing durable changed, so there's nothing to undo — drop it.
        undo: { ...state.undo, past: state.undo.past.filter((c) => c.id !== command.id) },
        toasts: [...state.toasts, { id: nextId("toast"), message: `Edit rejected: ${action.reason}` }],
      };
    }

    case "UNDO": {
      if (state.undo.past.length === 0) return state;
      const command = state.undo.past[state.undo.past.length - 1];
      const past = state.undo.past.slice(0, -1);

      const revertedEdits = isBaselineValue(command.rowKey, command.prevValue)
        ? omitKey(state.edits, command.rowKey)
        : {
            ...state.edits,
            [command.rowKey]: { status: "saved" as const, value: command.prevValue, commandId: command.id },
          };

      if (command.status === "pending") {
        // Never touched aggregates in the first place — just mark stale so
        // the validator response, whenever it arrives, gets discarded.
        return {
          ...state,
          edits: revertedEdits,
          undo: { past, future: [...state.undo.future, { ...command, stale: true }] },
        };
      }

      const aggregates = applyCallsDelta(state.aggregates, command.groupKeys, command.nextValue, command.prevValue);
      return {
        ...state,
        edits: revertedEdits,
        aggregates,
        undo: { past, future: [...state.undo.future, command] },
      };
    }

    case "REDO": {
      if (state.undo.future.length === 0) return state;
      const command = state.undo.future[state.undo.future.length - 1];
      const future = state.undo.future.slice(0, -1);

      // Re-applies the value without re-validating (the value was already
      // validated once; see README for why redo skips the validator). A
      // fresh command id is minted so a still-in-flight original promise
      // for a since-undone pending edit can never be mistaken for this one.
      const aggregates = applyCallsDelta(state.aggregates, command.groupKeys, command.prevValue, command.nextValue);
      const redoneCommand: Command = { ...command, id: action.newCommandId, status: "saved", stale: false };

      return {
        ...state,
        edits: {
          ...state.edits,
          [command.rowKey]: { status: "saved", value: command.nextValue, commandId: redoneCommand.id },
        },
        aggregates,
        undo: { past: [...state.undo.past, redoneCommand], future },
      };
    }

    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}
