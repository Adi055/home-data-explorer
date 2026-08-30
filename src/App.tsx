import { useCallback, useState } from "react";
import { loadRows } from "./data/load-rows";
import { timeOperation } from "./utils/timeOperation";
import { StoreProvider } from "./state/store";
import { ThemeProvider } from "./theme/ThemeProvider";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { Grid } from "./components/Grid/Grid";
import { Footer } from "./components/Footer/Footer";
import { ToastHost } from "./components/Toast/ToastHost";

function App() {
  const [totalRows] = useState(() => loadRows().length);
  const [rowsInDom, setRowsInDom] = useState(0);
  const [lastOperationLabel, setLastOperationLabel] = useState("load");
  const [lastOperationMs, setLastOperationMs] = useState(() => timeOperation(() => loadRows()).ms);

  // Primitive state setters bail out when the value hasn't actually
  // changed, so this stays a stable callback that never causes a loop even
  // though Grid's effect re-runs on every recompute.
  const handleLastOperationChange = useCallback((label: string, ms: number) => {
    setLastOperationLabel(label);
    setLastOperationMs(ms);
  }, []);

  return (
    <ThemeProvider>
      <StoreProvider>
        <Toolbar />
        <Grid onRowsInDomChange={setRowsInDom} onLastOperationChange={handleLastOperationChange} />
        <Footer
          rowsInDom={rowsInDom}
          totalRows={totalRows}
          lastOperationLabel={lastOperationLabel}
          lastOperationMs={lastOperationMs}
        />
        <ToastHost />
      </StoreProvider>
    </ThemeProvider>
  );
}

export default App;
