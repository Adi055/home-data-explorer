import type { CSSProperties } from "react";
import type { Row } from "../../data/load-rows";
import { computeRowCpi, formatCpi } from "../../domain/cpi";
import { getEffectiveCalls } from "../../domain/edits";
import { useAppState } from "../../state/store";
import { EditableCallsCell } from "./EditableCallsCell";

interface DataRowProps {
  style: CSSProperties;
  row: Row;
}

export function DataRow({ style, row }: DataRowProps) {
  const { edits } = useAppState();
  const effectiveCalls = getEffectiveCalls(row, edits);
  const cpi = computeRowCpi(effectiveCalls, row.trx);

  return (
    <div className="grid-row" style={style}>
      <div>{row.id}</div>
      <div>{row.name}</div>
      {/* Missing specialty is shown as literal "null", not hidden — see ASSUMPTIONS.md */}
      <div className={row.specialty === null ? "muted" : undefined}>{row.specialty ?? "null"}</div>
      <div>{row.region}</div>
      <div>{row.territory}</div>
      <div className="num">
        <EditableCallsCell row={row} />
      </div>
      <div className="num">{row.trx}</div>
      <div className="num">{row.nrx}</div>
      <div className="num">{formatCpi(cpi)}</div>
    </div>
  );
}
