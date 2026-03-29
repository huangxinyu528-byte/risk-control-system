import { getStatusClassName } from "@/lib/status";

type DataTableCardProps = {
  title: string;
  columns: string[];
  rows: string[][];
};

export function DataTableCard({ title, columns, rows }: DataTableCardProps) {
  return (
    <section className="table-card">
      <div className="table-header">
        <h3>{title}</h3>
        <span className="muted">当前为开发占位数据</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${title}-${rowIndex}`}>
              {row.map((cell, cellIndex) => {
                const isLastCell = cellIndex === row.length - 1;
                return (
                  <td key={`${cell}-${cellIndex}`}>
                    {isLastCell ? (
                      <span className={getStatusClassName(cell)}>{cell}</span>
                    ) : (
                      cell
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
