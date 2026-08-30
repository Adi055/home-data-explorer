import { useEffect, useMemo, useState } from "react";
import { loadRows } from "../../data/load-rows";
import { getRegionList } from "../../domain/search";
import { useAppState, useAppDispatch } from "../../state/store";
import { nextId } from "../../state/idGenerator";
import { TenantSwitcher } from "./TenantSwitcher";
import "./Toolbar.css";

export function Toolbar() {
  const { ui, undo } = useAppState();
  const dispatch = useAppDispatch();
  const regions = useMemo(() => getRegionList(loadRows()), []);
  const [searchInput, setSearchInput] = useState(ui.search);

  // Debounce dispatching search text so the derived-rows pipeline doesn't
  // re-run on every keystroke, only after typing pauses.
  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch({ type: "SET_SEARCH", search: searchInput });
    }, 150);
    return () => clearTimeout(timeout);
  }, [searchInput, dispatch]);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "UNDO" });
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        dispatch({ type: "REDO", newCommandId: nextId("cmd") });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return (
    <div className="toolbar">
      <input
        type="text"
        className="search-input"
        placeholder="Search name or ID..."
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      <select
        className="region-select"
        value={ui.regionFilter ?? ""}
        onChange={(event) =>
          dispatch({ type: "SET_REGION_FILTER", region: event.target.value === "" ? null : event.target.value })
        }
      >
        <option value="">All regions</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
      <div className="toolbar-spacer" />
      <TenantSwitcher />
      <button type="button" disabled={undo.past.length === 0} onClick={() => dispatch({ type: "UNDO" })}>
        Undo
      </button>
      <button
        type="button"
        disabled={undo.future.length === 0}
        onClick={() => dispatch({ type: "REDO", newCommandId: nextId("cmd") })}
      >
        Redo
      </button>
    </div>
  );
}
