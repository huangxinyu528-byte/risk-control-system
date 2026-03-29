"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SheetItem = {
  id: string;
  name: string;
  projectId?: string;
  projectName?: string;
  sourceCustomerName?: string;
  data: Record<string, unknown>;
};

type Props = {
  customerId: string;
  sheets: SheetItem[];
  emptyMessage?: string;
  preferredProjectId?: string;
  preferredProjectName?: string;
  preferredSheetName?: string;
};

type SpreadsheetCell = {
  text?: string | number | null;
};

type SpreadsheetRow = {
  cells?: Record<string, SpreadsheetCell | undefined>;
  height?: number;
};

type SpreadsheetSheetData = {
  name?: string;
  rows?: Record<string, SpreadsheetRow | undefined>;
  merges?: string[];
};

type SpreadsheetInstance = {
  loadData: (data: unknown) => SpreadsheetInstance;
  getData: () => unknown[];
  change: (cb: () => void) => SpreadsheetInstance;
};

type MergeAnchor = {
  rowspan: number;
  colspan: number;
};

function columnLettersToIndex(value: string): number {
  return value.split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseCellRef(ref: string) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    col: columnLettersToIndex(match[1].toUpperCase()),
    row: Number(match[2]) - 1,
  };
}

function buildPreviewModel(sheet: SpreadsheetSheetData) {
  const rows = sheet.rows ?? {};
  const merges = Array.isArray(sheet.merges) ? sheet.merges : [];

  let maxRow = 0;
  let maxCol = 0;

  Object.entries(rows).forEach(([rowKey, rowValue]) => {
    const rowIndex = Number(rowKey);
    if (!Number.isNaN(rowIndex)) {
      maxRow = Math.max(maxRow, rowIndex);
    }
    Object.keys(rowValue?.cells ?? {}).forEach((colKey) => {
      const colIndex = Number(colKey);
      if (!Number.isNaN(colIndex)) {
        maxCol = Math.max(maxCol, colIndex);
      }
    });
  });

  const covered = new Set<string>();
  const anchors = new Map<string, MergeAnchor>();

  merges.forEach((merge) => {
    const [startRef, endRef] = merge.split(":");
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef ?? startRef);
    if (!start || !end) {
      return;
    }

    maxRow = Math.max(maxRow, start.row, end.row);
    maxCol = Math.max(maxCol, start.col, end.col);

    const rowspan = end.row - start.row + 1;
    const colspan = end.col - start.col + 1;
    anchors.set(`${start.row}:${start.col}`, { rowspan, colspan });

    for (let row = start.row; row <= end.row; row += 1) {
      for (let col = start.col; col <= end.col; col += 1) {
        if (row === start.row && col === start.col) continue;
        covered.add(`${row}:${col}`);
      }
    }
  });

  return {
    rows,
    maxRow,
    maxCol,
    anchors,
    covered,
  };
}

function excelSerialToDate(serial: number) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 24 * 60 * 60 * 1000);
}

function formatExcelSerialByHeader(serialValue: string, headerText: string) {
  if (!/^\d{5}$/.test(serialValue)) {
    return serialValue;
  }

  const serial = Number(serialValue);
  if (Number.isNaN(serial) || serial < 30000 || serial > 60000) {
    return serialValue;
  }

  const normalizedHeader = headerText.trim();
  const date = excelSerialToDate(serial);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  if (normalizedHeader.includes("月份") || normalizedHeader.includes("期间")) {
    return `${yyyy}-${mm}`;
  }

  if (normalizedHeader.includes("日期") || normalizedHeader.includes("时间")) {
    return `${yyyy}-${mm}-${dd}`;
  }

  return serialValue;
}

function findColumnHeaderText(sheetRows: Record<string, SpreadsheetRow | undefined>, colIndex: number) {
  const candidateRows = [3, 2, 1, 0];
  for (const rowIndex of candidateRows) {
    const header = sheetRows[String(rowIndex)]?.cells?.[String(colIndex)]?.text;
    if (header != null && String(header).trim() !== "") {
      return String(header);
    }
  }
  return "";
}

function renderCellText(sheetRows: Record<string, SpreadsheetRow | undefined>, rowIndex: number, colIndex: number) {
  const cell = sheetRows[String(rowIndex)]?.cells?.[String(colIndex)];
  if (cell?.text == null) {
    return "";
  }

  const rawText = String(cell.text);
  const headerText = findColumnHeaderText(sheetRows, colIndex);
  return formatExcelSerialByHeader(rawText, headerText);
}

function SpreadsheetLayoutPreview({ sheet }: { sheet: SheetItem | null }) {
  const preview = useMemo(() => {
    if (!sheet) {
      return null;
    }
    return buildPreviewModel(sheet.data as SpreadsheetSheetData);
  }, [sheet]);

  if (!sheet || !preview) {
    return null;
  }

  return (
    <div className="ledger-layout-preview">
      <div className="ledger-layout-preview-header">
        <div>
          <strong>原始布局预览</strong>
          <div className="muted">按原始 sheet 坐标展示左侧主表、右侧辅助区与底部汇总区</div>
        </div>
        <span className="ledger-sheet-name">Sheet：{sheet.name}</span>
      </div>
      <div className="ledger-layout-scroll">
        <table className="ledger-layout-table">
          <tbody>
            {Array.from({ length: preview.maxRow + 1 }, (_, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {Array.from({ length: preview.maxCol + 1 }, (_, colIndex) => {
                  const key = `${rowIndex}:${colIndex}`;
                  if (preview.covered.has(key)) {
                    return null;
                  }

                  const anchor = preview.anchors.get(key);
                  const text = renderCellText(preview.rows, rowIndex, colIndex);
                  const isBlank = text === "";
                  const isHeaderRow = rowIndex <= 3;
                  const className = [
                    "ledger-layout-cell",
                    isHeaderRow ? "ledger-layout-cell-header" : "",
                    isBlank ? "ledger-layout-cell-empty" : "",
                    colIndex >= 11 ? "ledger-layout-cell-side" : "",
                    rowIndex >= 45 ? "ledger-layout-cell-summary" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <td
                      key={key}
                      className={className}
                      colSpan={anchor?.colspan ?? 1}
                      rowSpan={anchor?.rowspan ?? 1}
                    >
                      {text || "\u00A0"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function normalizeMatchValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findPreferredSheet(
  sheets: SheetItem[],
  preferredProjectId?: string,
  preferredProjectName?: string,
  preferredSheetName?: string,
) {
  if (!sheets.length) {
    return null;
  }

  if (preferredSheetName) {
    const match = sheets.find((sheet) => sheet.name === preferredSheetName);
    if (match) {
      return match;
    }
  }

  if (preferredProjectId) {
    const match = sheets.find((sheet) => sheet.projectId === preferredProjectId);
    if (match) {
      return match;
    }
  }

  const normalizedPreferredProjectName = normalizeMatchValue(preferredProjectName);
  if (normalizedPreferredProjectName) {
    const match = sheets.find((sheet) => {
      const projectName = normalizeMatchValue(sheet.projectName);
      const sourceCustomerName = normalizeMatchValue(sheet.sourceCustomerName);
      return (
        projectName === normalizedPreferredProjectName ||
        projectName.includes(normalizedPreferredProjectName) ||
        normalizedPreferredProjectName.includes(projectName) ||
        sourceCustomerName.includes(normalizedPreferredProjectName)
      );
    });

    if (match) {
      return match;
    }
  }

  return sheets[0];
}

export function CustomerLedgerSpreadsheet({
  customerId,
  sheets,
  emptyMessage,
  preferredProjectId,
  preferredProjectName,
  preferredSheetName,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetRef = useRef<SpreadsheetInstance | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);

  const sheetData = useMemo(
    () =>
      sheets.map((sheet) => ({
        ...sheet.data,
        name: String(sheet.data.name ?? sheet.name),
      })),
    [sheets],
  );

  useEffect(() => {
    if (!sheets.length) {
      setSelectedSheetId(null);
      return;
    }

    const preferredSheet = findPreferredSheet(sheets, preferredProjectId, preferredProjectName, preferredSheetName);
    setSelectedSheetId((current) =>
      current && sheets.some((sheet) => sheet.id === current) ? current : (preferredSheet?.id ?? sheets[0].id),
    );
  }, [preferredProjectId, preferredProjectName, preferredSheetName, sheets]);

  const selectedSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === selectedSheetId) ?? sheets[0] ?? null,
    [selectedSheetId, sheets],
  );

  useEffect(() => {
    let mounted = true;

    async function setup() {
      if (!containerRef.current) {
        return;
      }
      containerRef.current.innerHTML = "";

      await import("x-data-spreadsheet/dist/xspreadsheet");

      if (!mounted || !containerRef.current) {
        return;
      }

      const spreadsheetFactory =
        typeof window !== "undefined"
          ? (
              window as typeof window & {
                x_spreadsheet?: (element: HTMLElement, options: Record<string, unknown>) => SpreadsheetInstance;
              }
            ).x_spreadsheet
          : undefined;

      if (typeof spreadsheetFactory !== "function") {
        throw new Error("Spreadsheet 初始化失败");
      }

      const instance = spreadsheetFactory(containerRef.current, {
        mode: "edit",
        showToolbar: true,
        showGrid: true,
        showContextmenu: true,
        showBottomBar: true,
        row: {
          len: 200,
          height: 28,
        },
        col: {
          len: 32,
          width: 120,
          indexWidth: 64,
          minWidth: 60,
        },
        view: {
          height: () => 640,
          width: () => containerRef.current?.clientWidth ?? 1200,
        },
      }) as unknown as SpreadsheetInstance;

      instance.loadData(sheetData).change(() => {
        if (!mounted) return;
        setDirty(true);
        setSaveMessage("");
      });

      spreadsheetRef.current = instance;
      setDirty(false);
    }

    void setup();

    return () => {
      mounted = false;
      spreadsheetRef.current = null;
    };
  }, [sheetData]);

  async function handleSave() {
    if (!spreadsheetRef.current) {
      return;
    }

    setSaving(true);
    setSaveMessage("");
    try {
      const workbookData = spreadsheetRef.current.getData();
      const payload = {
        sheets: sheets.map((sheet, index) => ({
          id: sheet.id,
          sheetData: (workbookData[index] ?? sheet.data) as Record<string, unknown>,
        })),
      };

      const response = await fetch(`/api/customers/${customerId}/account-ledger-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "保存失败");
      }

      setDirty(false);
      setSaveMessage("已保存到账款档案数据库");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="table-header">
        <div>
          <h3 style={{ margin: 0 }}>完整账款档案</h3>
          <span className="muted">按原始 sheet 在线查看和编辑客户账款档案</span>
        </div>
        <div className="table-actions">
          <button className="button button-secondary" disabled={saving || !dirty} onClick={handleSave} type="button">
            {saving ? "保存中..." : "保存修改"}
          </button>
        </div>
      </div>

      {saveMessage ? <div className="inline-notice inline-notice-success">{saveMessage}</div> : null}

      {sheets.length === 0 ? (
        <div className="empty-cell" style={{ padding: 24 }}>{emptyMessage || "暂无可展示的原始账款 sheet"}</div>
      ) : (
        <>
          <div className="ledger-sheet-switcher">
            {sheets.map((sheet) => (
              <button
                key={sheet.id}
                className={`ledger-sheet-tab ${selectedSheet?.id === sheet.id ? "active" : ""}`}
                onClick={() => setSelectedSheetId(sheet.id)}
                type="button"
              >
                {sheet.name}
              </button>
            ))}
          </div>

          <SpreadsheetLayoutPreview sheet={selectedSheet} />

          <div className="spreadsheet-wrapper">
            <div className="spreadsheet-canvas" ref={containerRef} />
          </div>
        </>
      )}
    </section>
  );
}
