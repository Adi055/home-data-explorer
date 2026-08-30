import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDerivedRows } from "../../selectors/useDerivedRows";
import { useAppState, useAppDispatch } from "../../state/store";
import { territoryKey } from "../../domain/aggregate";
import { GroupHeaderRow } from "./GroupHeaderRow";
import { DataRow } from "./DataRow";
import { ColumnHeader } from "./ColumnHeader";
import "./Grid.css";

const DATA_ROW_HEIGHT = 32;
const HEADER_ROW_HEIGHT = 36;

interface GridProps {
  onRowsInDomChange: (count: number) => void;
  onLastOperationChange: (label: string, ms: number) => void;
}

export function Grid({ onRowsInDomChange, onLastOperationChange }: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const { ui } = useAppState();
  const { flatRows, aggregates, lastOperationMs, lastOperationLabel } = useDerivedRows();

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (flatRows[index].kind === "data-row" ? DATA_ROW_HEIGHT : HEADER_ROW_HEIGHT),
    overscan: 8,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Footer's "rows in DOM" readout is just how many the virtualizer decided to mount.
  useEffect(() => {
    onRowsInDomChange(virtualRows.length);
  }, [virtualRows.length, onRowsInDomChange]);

  useEffect(() => {
    onLastOperationChange(lastOperationLabel, lastOperationMs);
  }, [lastOperationLabel, lastOperationMs, onLastOperationChange]);

  return (
    <div className="grid">
      <div className="grid-row grid-header">
        <ColumnHeader column="id" label="ID" />
        <ColumnHeader column="name" label="Name" />
        <ColumnHeader column="specialty" label="Specialty" />
        <ColumnHeader column="region" label="Region" />
        <ColumnHeader column="territory" label="Territory" />
        <ColumnHeader column="calls" label="Calls" align="right" />
        <ColumnHeader column="trx" label="TRx" align="right" />
        <ColumnHeader column="nrx" label="NRx" align="right" />
        <ColumnHeader column="cpi" label="CPI" align="right" />
      </div>
      <div ref={scrollRef} className="grid-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualRows.map((virtualRow) => {
            const flatRow = flatRows[virtualRow.index];
            const style: CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            };

            if (flatRow.kind === "region-header") {
              return (
                <GroupHeaderRow
                  key={flatRow.key}
                  style={style}
                  label={flatRow.region}
                  depth={0}
                  expanded={ui.expandedRegions.has(flatRow.region)}
                  aggregate={aggregates.region.get(flatRow.region)!}
                  onToggle={() => dispatch({ type: "TOGGLE_REGION_EXPANDED", region: flatRow.region })}
                />
              );
            }

            if (flatRow.kind === "territory-header") {
              const tKey = territoryKey(flatRow.region, flatRow.territory);
              return (
                <GroupHeaderRow
                  key={flatRow.key}
                  style={style}
                  label={flatRow.territory}
                  depth={1}
                  expanded={ui.expandedTerritories.has(tKey)}
                  aggregate={aggregates.territory.get(tKey)!}
                  onToggle={() => dispatch({ type: "TOGGLE_TERRITORY_EXPANDED", territoryKey: tKey })}
                />
              );
            }

            return <DataRow key={flatRow.key} style={style} row={flatRow.row} />;
          })}
        </div>
      </div>
    </div>
  );
}
