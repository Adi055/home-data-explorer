export type EditStatus = "pending" | "saved" | "rejected";

export interface CellEditState {
  status: EditStatus;
  // current effective value: the pending/saved new value, or — while
  // rejected — the value reverted back to.
  value: number | string;
  rejectionReason?: string;
  commandId: string;
}

// Keyed by rowKey. A row with no entry has never been edited — its
// effective value is just row.calls.
export type EditsMap = Record<number, CellEditState>;

export function getEffectiveCalls(row: { rowKey: number; calls: number | string }, edits: EditsMap): number | string {
  return edits[row.rowKey]?.value ?? row.calls;
}
