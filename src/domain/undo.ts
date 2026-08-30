export interface Command {
  id: string;
  type: "edit-calls";
  rowKey: number;
  prevValue: number | string;
  nextValue: number;
  // set when undone while still pending — tells a late validator response
  // to be discarded instead of applied.
  stale: boolean;
  status: "pending" | "saved" | "rejected";
  groupKeys: { region: string; territory: string };
}

export interface UndoState {
  past: Command[];
  future: Command[];
}

export function findCommand(undo: UndoState, commandId: string): Command | undefined {
  return undo.past.find((c) => c.id === commandId) ?? undo.future.find((c) => c.id === commandId);
}
