import "./Footer.css";

interface FooterProps {
  rowsInDom: number;
  totalRows: number;
  lastOperationLabel: string;
  lastOperationMs: number;
}

export function Footer({ rowsInDom, totalRows, lastOperationLabel, lastOperationMs }: FooterProps) {
  return (
    <div className="footer">
      <span>
        rows in DOM: {rowsInDom} of {totalRows.toLocaleString()}
      </span>
      <span>
        {lastOperationLabel}: {lastOperationMs.toFixed(0)} ms
      </span>
    </div>
  );
}
