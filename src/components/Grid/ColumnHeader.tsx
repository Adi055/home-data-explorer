import { useAppState, useAppDispatch } from "../../state/store";
import type { SortableColumn } from "../../domain/comparators";

interface ColumnHeaderProps {
  column: SortableColumn;
  label: string;
  align?: "left" | "right";
}

export function ColumnHeader({ column, label, align = "left" }: ColumnHeaderProps) {
  const { ui } = useAppState();
  const dispatch = useAppDispatch();

  const active = ui.sort?.column === column;
  const indicator = active ? (ui.sort!.direction === "asc" ? " ▲" : " ▼") : "";

  function toggleSort() {
    dispatch({ type: "SET_SORT", column });
  }

  return (
    <div
      className={`sortable-header${align === "right" ? " num" : ""}`}
      role="button"
      tabIndex={0}
      aria-sort={active ? (ui.sort!.direction === "asc" ? "ascending" : "descending") : "none"}
      onClick={toggleSort}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSort();
        }
      }}
    >
      {label}
      {indicator}
    </div>
  );
}
