import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createImportLog,
  enrichImportedProjectContext,
  importExcelData,
  invalidateDataAccessReadCaches,
} from "@/lib/server/data-access";

const execFileAsync = promisify(execFile);

function normalizeBusinessType(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "诉" || text === "已诉" || text === "诉讼") return "已诉";
  if (text === "待起诉") return "待起诉";
  if (text === "尾款") return "尾款";
  return text;
}

function deriveFallbackRisks(
  receivables: Array<Record<string, unknown>>,
  existingRisks: Array<Record<string, unknown>>,
) {
  if (existingRisks.length > 0) {
    return existingRisks;
  }

  const riskMap = new Map<string, Record<string, unknown>>();

  for (const row of receivables) {
    const customerName = String(row.customerName ?? "").trim();
    const projectName = String(row.projectName ?? "").trim() || null;
    const businessType = normalizeBusinessType(row.businessType);
    const currentStatus = String(row.currentStatus ?? "").trim();
    const remark = String(row.remark ?? "").trim();

    let riskType = "";
    let riskLevel = "";
    let summary = remark || currentStatus || businessType;

    if (businessType === "待起诉" || businessType === "已诉") {
      riskType = "诉讼";
      riskLevel = "高";
      summary = summary || businessType;
    } else if (["停工", "资金紧张", "未回款"].some((keyword) => currentStatus.includes(keyword))) {
      riskType = currentStatus.includes("停工")
        ? "经营异常"
        : currentStatus.includes("资金紧张")
          ? "财务异常"
          : "付款逾期";
      riskLevel = "中";
    } else if (["风险", "无法支付"].some((keyword) => remark.includes(keyword))) {
      riskType = remark.includes("无法支付") ? "财务异常" : "沟通异常";
      riskLevel = "中";
    }

    if (!customerName || !riskType) {
      continue;
    }

    const key = `${customerName}::${projectName ?? ""}::${riskType}`;
    if (!riskMap.has(key)) {
      riskMap.set(key, {
        customerName,
        projectName,
        riskType,
        riskLevel,
        source: "Excel导入",
        remark: summary,
      });
    }
  }

  return Array.from(riskMap.values());
}

function riskLevelToDb(level: unknown) {
  const text = String(level ?? "").trim();
  if (text === "中") {
    return "medium";
  }
  if (text === "低") {
    return "low";
  }
  if (text === "重大") {
    return "critical";
  }
  return "high";
}

async function persistExcelRisks(risks: Array<Record<string, unknown>>) {
  if (!process.env.DATABASE_URL || risks.length === 0) {
    return;
  }

  for (const item of risks) {
    const customerName = String(item.customerName ?? "").trim();
    if (!customerName) continue;

    const customer = await prisma.customer.findUnique({
      where: { name: customerName },
      select: { id: true },
    });
    if (!customer) continue;

    const projectName = String(item.projectName ?? "").trim();
    const project = projectName
      ? await prisma.project.findUnique({
          where: {
            customerId_name: {
              customerId: customer.id,
              name: projectName,
            },
          },
          select: { id: true },
        })
      : null;

    const riskType = String(item.riskType ?? "").trim();
    if (!riskType) continue;

    const existing = await prisma.riskRecord.findFirst({
      where: {
        customerId: customer.id,
        projectId: project?.id ?? null,
        riskType,
        source: "excel",
      },
      select: { id: true },
    });

    const data = {
      customerId: customer.id,
      projectId: project?.id ?? null,
      riskType,
      riskLevel: riskLevelToDb(item.riskLevel) as never,
      source: "excel" as never,
      title: riskType,
      description: String(item.remark ?? "").trim() || null,
      remark: String(item.remark ?? "").trim() || null,
      handled: false,
      status: "open",
    };

    if (existing) {
      await prisma.riskRecord.update({
        where: { id: existing.id },
        data,
      });
      continue;
    }

    await prisma.riskRecord.create({ data });
  }
}

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
      return NextResponse.json(
        { success: false, message: "请选择要导入的 Excel 文件" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { success: false, message: "仅支持 .xlsx 或 .xls 文件" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(os.tmpdir(), `excel-import-${Date.now()}${extension}`);
    await fs.writeFile(tempPath, bytes);

    const { stdout, stderr } = await execFileAsync(
      "python3",
      [path.join(process.cwd(), "scripts/parse_receivable_excel.py"), tempPath],
      {
        // Real-world xlsx files may produce a large JSON payload because row errors
        // are returned in full. Increase the child-process buffer to keep import
        // logging and response generation consistent across xls/xlsx inputs.
        maxBuffer: 50 * 1024 * 1024,
      },
    );

    if (stderr) {
      console.warn(stderr);
    }

    const parsed = JSON.parse(stdout) as {
      customers: Array<Record<string, unknown>>;
      projects: Array<Record<string, unknown>>;
      receivables: Array<Record<string, unknown>>;
      risks: Array<Record<string, unknown>>;
      ledgerProfiles?: Array<Record<string, unknown>>;
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
    const effectiveRisks = deriveFallbackRisks(parsed.receivables, parsed.risks);

    const summary = await importExcelData({
      sourceFileName: originalFileName,
      customers: parsed.customers as never,
      projects: parsed.projects as never,
      receivables: parsed.receivables as never,
      risks: effectiveRisks as never,
      ledgerProfiles: (parsed.ledgerProfiles ?? []) as never,
    });
    await enrichImportedProjectContext(parsed.projects as never);
    await persistExcelRisks(effectiveRisks);
    invalidateDataAccessReadCaches();

    logPayload = {
      fileName: originalFileName,
      totalCount: parsed.receivables.length + rowErrors.length + skippedRows,
      successCount: parsed.receivables.length,
      failureCount: rowErrors.length,
      errors: rowErrors,
    };

    return NextResponse.json({
      success: true,
      data: {
        total: parsed.receivables.length + rowErrors.length,
        success: parsed.receivables.length,
        failed: rowErrors.length,
        skippedRows,
        successCount: parsed.receivables.length,
        failedCount: rowErrors.length,
        customers: parsed.customers.length,
        projects: parsed.projects.length,
        ledgerProfiles: (parsed.ledgerProfiles ?? []).length,
        newCustomers: (summary as { newCustomers?: number }).newCustomers ?? 0,
        updatedCustomers: (summary as { updatedCustomers?: number }).updatedCustomers ?? 0,
        summary,
        mappedFields: parsed.mappedFields,
        unmappedColumns: parsed.unmappedColumns,
        errors: rowErrors,
      },
    });
  } catch (error) {
    logPayload = {
      fileName: originalFileName,
      totalCount: 1,
      successCount: 0,
      failureCount: 1,
      errorMessage: error instanceof Error ? error.message : "Excel 导入失败",
      errors: [
        {
          message: error instanceof Error ? error.message : "Excel 导入失败",
        },
      ],
    };

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Excel 导入失败",
      },
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
