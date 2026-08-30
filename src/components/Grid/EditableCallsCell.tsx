import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useAppState, useAppDispatch } from "../../state/store";
import { useValidator } from "../../state/validatorContext";
import { nextId } from "../../state/idGenerator";
import type { Row } from "../../data/load-rows";
import { getEffectiveCalls } from "../../domain/edits";

interface EditableCallsCellProps {
  row: Row;
}

export function EditableCallsCell({ row }: EditableCallsCellProps) {
  const { edits } = useAppState();
  const dispatch = useAppDispatch();
  const validate = useValidator();

  const editState = edits[row.rowKey];
  const status = editState?.status ?? "idle";
  const effectiveValue = getEffectiveCalls(row, edits);

  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState("");

  function startEditing() {
    if (status === "pending") return; // locked while a previous commit is in flight
    setDraftText(String(effectiveValue));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function commit() {
    const parsed = Number(draftText);
    if (!Number.isFinite(parsed)) {
      setIsEditing(false); // not a usable number: quietly discard, revert to view mode
      return;
    }

    setIsEditing(false);
    const commandId = nextId("cmd");
    dispatch({
      type: "EDIT_COMMIT",
      rowKey: row.rowKey,
      prevValue: effectiveValue,
      nextValue: parsed,
      commandId,
      groupKeys: { region: row.region, territory: row.territory },
    });

    validate(parsed).then(
      () => dispatch({ type: "EDIT_RESOLVED", rowKey: row.rowKey, commandId }),
      (reason: unknown) => dispatch({ type: "EDIT_REJECTED", rowKey: row.rowKey, commandId, reason: String(reason) }),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    else if (event.key === "Escape") cancelEditing();
  }

  if (isEditing) {
    return (
      <input
        className="calls-input"
        data-testid="calls-input"
        autoFocus
        inputMode="numeric"
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={cancelEditing}
      />
    );
  }

  return (
    <div
      className={`calls-cell status-${status}`}
      data-testid="calls-cell"
      data-status={status}
      onClick={startEditing}
      title={status === "rejected" ? editState?.rejectionReason : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && status !== "pending") {
          event.preventDefault();
          startEditing();
        }
      }}
    >
      {effectiveValue}
      {status === "pending" && (
        <span className="spinner" aria-label="saving">
          ⏳
        </span>
      )}
    </div>
  );
}
