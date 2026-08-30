import type { CSSProperties } from "react";
import type { GroupAggregate } from "../../domain/aggregate";
import { computeAggregateCpi, formatCpi } from "../../domain/cpi";

interface GroupHeaderRowProps {
  style: CSSProperties;
  label: string;
  depth: 0 | 1;
  expanded: boolean;
  aggregate: GroupAggregate;
  onToggle: () => void;
}

export function GroupHeaderRow({ style, label, depth, expanded, aggregate, onToggle }: GroupHeaderRowProps) {
  const cpi = computeAggregateCpi(aggregate.sumCalls, aggregate.sumTrx);

  return (
    <div
      className={`grid-row group-header depth-${depth}`}
      style={style}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      data-testid={depth === 0 ? "region-header" : "territory-header"}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="group-label">
        <span className="disclosure">{expanded ? "▾" : "▸"}</span>
        {label} <span className="muted">({aggregate.hcpCount.toLocaleString()} HCPs)</span>
      </div>
      <div className="num" data-testid="agg-calls">
        {aggregate.sumCalls.toLocaleString()}
      </div>
      <div className="num">{aggregate.sumTrx.toLocaleString()}</div>
      <div className="num">{aggregate.sumNrx.toLocaleString()}</div>
      <div className="num">{formatCpi(cpi)}</div>
    </div>
  );
}
