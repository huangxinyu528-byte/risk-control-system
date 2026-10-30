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

type SpreadsheetInstance = {
  loadData: (data: unknown) => SpreadsheetInstance;
  getData: () => unknown[];
  change: (cb: () => void) => SpreadsheetInstance;
};

export function CustomerLedgerSpreadsheet({
  customerId,
  sheets,
  emptyMessage,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spreadsheetRef = useRef<SpreadsheetInstance | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const sheetData = useMemo(
    () =>
      sheets.map((sheet) => ({
        ...sheet.data,
        name: String(sheet.data.name ?? sheet.name),
      })),
    [sheets],
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
          <span className="muted">在线编辑，保存后写回档案库</span>
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
        <div className="spreadsheet-wrapper">
          <div className="spreadsheet-canvas" ref={containerRef} />
        </div>
      )}
    </section>
  );
}
