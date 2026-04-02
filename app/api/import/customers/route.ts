import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { createImportLog, importCustomerMasterData } from "@/lib/server/data-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  let tempPath = "";
  let originalFileName = "unknown.xlsx";
  let logPayload: {
    fileName: string;
    totalCount: number;
    successCount: number;
    failureCount: number;
    errorMessage?: string | null;
    errors?: Array<{
      rowRef?: string | null;
      message: string;
      rawPayload?: unknown;
    }>;
  } | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      logPayload = {
        fileName: originalFileName,
        totalCount: 0,
        successCount: 0,
        failureCount: 1,
        errorMessage: "请选择要导入的 Excel 文件",
        errors: [{ message: "请选择要导入的 Excel 文件" }],
      };
      return NextResponse.json({ success: false, message: "请选择要导入的 Excel 文件" }, { status: 400 });
    }

    originalFileName = file.name || originalFileName;
    const extension = path.extname(file.name || "").toLowerCase();
    if (![".xlsx", ".xls"].includes(extension)) {
      logPayload = {
        fileName: originalFileName,
        totalCount: 0,
        successCount: 0,
        failureCount: 1,
        errorMessage: "仅支持 .xlsx 或 .xls 文件",
        errors: [{ message: "仅支持 .xlsx 或 .xls 文件" }],
      };
      return NextResponse.json({ success: false, message: "仅支持 .xlsx 或 .xls 文件" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(os.tmpdir(), `customer-import-${Date.now()}${extension}`);
    await fs.writeFile(tempPath, bytes);

    const { stdout, stderr } = await execFileAsync(
      "python3",
      [path.join(process.cwd(), "scripts/parse_customer_excel.py"), tempPath],
      { maxBuffer: 20 * 1024 * 1024 },
    );

    if (stderr) {
      console.warn(stderr);
    }

    const parsed = JSON.parse(stdout) as {
      customers: Array<Record<string, unknown>>;
      mappedFields: string[];
      unmappedColumns: string[];
      skippedRows?: number;
      errors?: Array<{
        rowRef?: string | null;
        message: string;
        rawPayload?: unknown;
      }>;
    };

    const rowErrors = parsed.errors ?? [];
    const skippedRows = parsed.skippedRows ?? 0;

    const summary = await importCustomerMasterData({
      sourceFileName: originalFileName,
      customers: parsed.customers as never,
    });

    logPayload = {
      fileName: originalFileName,
      totalCount: parsed.customers.length + rowErrors.length + skippedRows,
      successCount: summary.successCount,
      failureCount: rowErrors.length + summary.failedCount,
      errors: [...rowErrors, ...summary.errors],
    };

    return NextResponse.json({
      success: true,
      data: {
        total: parsed.customers.length + rowErrors.length + skippedRows,
        success: summary.successCount,
        failed: rowErrors.length + summary.failedCount,
        skippedRows,
        addedCount: summary.addedCount,
        updatedCount: summary.updatedCount,
        skippedCount: summary.skippedCount,
        failedCount: summary.failedCount,
        successCount: summary.successCount,
        mappedFields: parsed.mappedFields,
        unmappedColumns: parsed.unmappedColumns,
        errors: [...rowErrors, ...summary.errors],
        summary,
      },
    });
  } catch (error) {
    logPayload = {
      fileName: originalFileName,
      totalCount: 1,
      successCount: 0,
      failureCount: 1,
      errorMessage: error instanceof Error ? error.message : "客户 Excel 导入失败",
      errors: [{ message: error instanceof Error ? error.message : "客户 Excel 导入失败" }],
    };

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "客户 Excel 导入失败" },
      { status: 500 },
    );
  } finally {
    if (logPayload) {
      await createImportLog(logPayload);
    }
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
