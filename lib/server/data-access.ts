import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCustomerCode, generateNextCustomerCode, normalizeCustomerCode } from "@/lib/customer-code";
import {
  buildProjectNormalization,
  deriveCustomerProjectIdentity,
  normalizeCustomerSourceName,
  normalizeProjectName,
} from "@/lib/customer-entity-normalization";
import {
  buildCustomerRecord,
  buildReceivableRecord,
  collectionReports,
  creditScores,
  developmentCustomers,
  developmentReceivables,
  reportEntries,
} from "@/lib/mock-data";
import {
  applyCustomerRules,
  applyReceivablePortfolioRules,
  applyReceivableRules,
  buildRuleAwareDashboardOverview,
  evaluateProjectExecutableRiskRules,
  summarizeProjectExecutableRiskRules,
} from "@/lib/server/risk-rules";
import { loadDevelopmentDataset } from "@/lib/server/development-dataset";
import type {
  CollectionItemPayload,
  CollectionItemRecord,
  CreditScoreFilters,
  CreditScorePayload,
  CreditScoreRecord,
  ContractFilters,
  ContractPayload,
  ContractRecord,
  CustomerFilters,
  CustomerFullProfileRecord,
  CustomerLedgerFilters,
  CustomerLedgerCustomerRow,
  CustomerLedgerProjectRow,
  CustomerLedgerResponse,
  CustomerLedgerArchiveRecord,
  CustomerPayload,
  CustomerRecord,
  CustomerSummaryRecord,
  DashboardOverviewData,
  HighRiskCustomerFilters,
  HighRiskCustomerRecord,
  KeyAttentionCustomerFilters,
  KeyAttentionCustomerRecord,
  ProjectRecord,
  ReportEntry,
  RiskFilters,
  RiskCustomerFilters,
  RiskCustomerResponse,
  RiskCustomerRow,
  RiskOverviewData,
  RiskPayload,
  RiskProjectFilters,
  RiskProjectResponse,
  RiskProjectRow,
  RiskRecordItem,
  ReceivableFilters,
  ReceivablePayload,
  ReceivableRecord,
} from "@/lib/types";
import { contracts, risks } from "@/lib/mock-data";

const importedDataset = loadDevelopmentDataset();

const memoryStore = {
  customers: [...(importedDataset?.customers ?? developmentCustomers)],
  receivables: [...(importedDataset?.receivables ?? developmentReceivables)],
  contracts: [...(importedDataset?.contracts ?? contracts)],
  risks: [...(importedDataset?.risks ?? risks)],
  creditScores: [...(importedDataset?.creditScores ?? creditScores)],
  collections: [...(importedDataset?.collections ?? collectionReports)],
};

function isoDateFromOffset(daysOffset: number) {
  const date = new Date(Date.UTC(2024, 0, 1));
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

function buildDevelopmentLedgerRows(project: ProjectRecord) {
  const portions = [0.35, 0.35, 0.3];
  const statementAmounts = portions.map((portion, index) => {
    if (index === portions.length - 1) {
      const previous = portions
        .slice(0, index)
        .reduce((sum, current) => sum + Number((project.receivableAmount * current).toFixed(2)), 0);
      return Number((project.receivableAmount - previous).toFixed(2));
    }
    return Number((project.receivableAmount * portion).toFixed(2));
  });
  const receivedRatio = project.receivableAmount > 0 ? Math.min(1, project.receivedAmount / project.receivableAmount) : 0;
  let cumulative = 0;

  return statementAmounts.map((statementAmount, index) => {
    cumulative += statementAmount;
    const contractReceivable = statementAmount;
    const receivedAmount = Number((statementAmount * receivedRatio).toFixed(2));
    const quantity = Number((20 + index * 6 + Math.max(0, project.receivableAmount / 1_000_000)).toFixed(2));

    return {
      id: `dev-ledger-row-${project.id}-${index + 1}`,
      rowOrder: index + 1,
      statementDate: isoDateFromOffset(index * 30 + 10),
      quantity,
      statementAmount,
      contractReceivable,
      receivedDate: receivedAmount > 0 ? isoDateFromOffset(index * 30 + 38) : null,
      receivedAmount,
      cumulativeReceivable: Number(cumulative.toFixed(2)),
      invoiceDate: isoDateFromOffset(index * 30 + 20),
      invoiceQuantity: quantity,
      invoiceAmount: statementAmount,
      remark: index === 0 ? (project.remark || "试运行环境开发档案回退展示") : "",
      extraFields: null,
    };
  });
}

function buildDevelopmentLedgerSheetData(project: ProjectRecord, rows: CustomerLedgerArchiveRecord["archives"][number]["rows"]) {
  const sheetRows: Record<string, { cells?: Record<string, { text?: string | number | null }> }> = {
    "0": {
      cells: {
        "0": { text: `${project.projectName} - 开发档案预览` },
      },
    },
    "3": {
      cells: {
        "0": { text: "对账时间" },
        "1": { text: "方量" },
        "2": { text: "对账金额" },
        "3": { text: "按合同应收金额" },
        "4": { text: "实际收款时间" },
        "5": { text: "实际收款金额" },
        "6": { text: "累计应收" },
        "7": { text: "开票时间" },
        "8": { text: "开票方量" },
        "9": { text: "开票金额" },
        "10": { text: "备注" },
        "11": { text: "汇总!A1" },
        "12": { text: "结算期间" },
        "13": { text: "计提方量" },
        "14": { text: "回款金额" },
        "15": { text: "应回款月份" },
      },
    },
  };

  rows.forEach((row, index) => {
    const displayRow = 4 + index;
    sheetRows[String(displayRow)] = {
      cells: {
        "0": { text: row.statementDate ?? "" },
        "1": { text: row.quantity ?? "" },
        "2": { text: row.statementAmount ?? "" },
        "3": { text: row.contractReceivable ?? "" },
        "4": { text: row.receivedDate ?? "" },
        "5": { text: row.receivedAmount ?? "" },
        "6": { text: row.cumulativeReceivable ?? "" },
        "7": { text: row.invoiceDate ?? "" },
        "8": { text: row.invoiceQuantity ?? "" },
        "9": { text: row.invoiceAmount ?? "" },
        "10": { text: row.remark ?? "" },
        "11": { text: project.projectName },
        "12": { text: row.statementDate ? row.statementDate.slice(0, 7) : "" },
        "13": { text: row.quantity ?? "" },
        "14": { text: row.receivedAmount ?? "" },
        "15": { text: row.receivedDate ? row.receivedDate.slice(0, 7) : "" },
      },
    };
  });

  sheetRows["46"] = {
    cells: {
      "0": { text: "按合同未收款：" },
      "1": { text: Number(project.unpaidAmount.toFixed(2)) },
      "3": { text: "未制票：" },
      "4": { text: 0 },
    },
  };
  sheetRows["47"] = {
    cells: {
      "0": { text: "验证：" },
      "1": { text: "开发环境回退生成档案，仅用于试运行展示" },
    },
  };
  sheetRows["48"] = {
    cells: {
      "0": { text: "其他底部信息" },
      "1": { text: project.businessType || project.projectStatus || "进行中" },
    },
  };

  return {
    name: project.projectName,
    rows: sheetRows,
    merges: ["A1:K1"],
  };
}

function buildDevelopmentLedgerArchives(
  customer: Pick<CustomerRecord, "id" | "customerId" | "customerCode" | "name">,
  projects: ProjectRecord[],
): CustomerLedgerArchiveRecord {
  const archives = projects
    .filter((project) => !isNoiseProjectName(project.projectName))
    .map((project, index) => {
      const rows = buildDevelopmentLedgerRows(project);
      const sheetData = buildDevelopmentLedgerSheetData(project, rows);
      const sheetName =
        project.projectName.length <= 20 ? project.projectName : `${index + 1}-${project.projectName.slice(0, 18)}`;

      return {
        id: `dev-ledger-${project.id}`,
        projectId: project.id,
        sheetName,
        workbookSource: `${customer.name}（开发回退档案）`,
        projectName: project.projectName,
        settlementClause: "开发环境回退生成，用于无数据库试运行展示",
        sheetData,
        summary: {
          contractUnpaidTotal: Number(project.unpaidAmount.toFixed(2)),
          uninvoicedTotal: 0,
          extraSummary: {
            generatedFrom: "development-fallback",
            businessType: project.businessType ?? "",
            projectStatus: project.projectStatus,
          },
        },
        rows,
      };
    });

  return {
    customer: {
      id: customer.id,
      customerId: customer.customerId,
      customerCode: customer.customerCode ?? "",
      name: customer.name,
    },
    archives,
  };
}

function containsKeyword(keyword: string, values: Array<string | number | null | undefined>) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function projectMatchesLedgerKeyword(keyword: string, project: CustomerLedgerProjectRow) {
  return containsKeyword(keyword, [
    project.projectName,
    project.projectAlias,
    project.sourceCustomerName,
    project.normalizedProjectName,
    project.projectBelonging,
    project.remarkRaw,
    project.remarkSummary,
    project.creditStatusRaw,
    project.creditStatusSummary,
    project.currentStatusRaw,
    project.currentStatusSummary,
    project.businessType,
    project.timeNode,
  ]);
}

function customerMatchesLedgerKeyword(keyword: string, customer: CustomerLedgerCustomerRow) {
  return containsKeyword(keyword, [
    customer.customerId,
    customer.customerCode,
    customer.customerName,
    customer.normalizedName,
    customer.projectNamesPreview,
    customer.projectBelongingSummary,
    customer.remarkSummary,
    customer.creditStatusSummary,
    customer.currentStatusSummary,
  ]);
}

const NOISE_CUSTOMER_NAMES = new Set([
  "合计",
  "小计",
  "总计",
  "汇总",
  "待补数据",
  "单位",
  "单位名称",
  "购货单位",
  "结算单位",
  "客户名称",
  "公司名称",
]);

const NOISE_PROJECT_NAMES = new Set([
  "合计",
  "小计",
  "总计",
  "汇总",
  "待补数据",
  "工程项目",
  "项目名称",
  "项目",
  "工程名称",
  "合计/待补数据",
]);

function normalizeNoiseLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseCustomerName(value: string | null | undefined) {
  const text = normalizeNoiseLabel(value);
  if (!text) {
    return true;
  }
  return NOISE_CUSTOMER_NAMES.has(text);
}

function isNoiseProjectName(value: string | null | undefined) {
  const text = normalizeNoiseLabel(value);
  if (!text) {
    return true;
  }
  if (NOISE_PROJECT_NAMES.has(text)) {
    return true;
  }
  return /汇总\s*$/.test(text);
}

function isNoiseRiskSubjectName(value: string | null | undefined) {
  return isNoiseCustomerName(value);
}

function categorizeProjectBelonging(value: string | null | undefined): "央企" | "国企" | "民营" | "项目类" | "未标注" {
  const text = normalizeNoiseLabel(value);
  if (!text || text === "待补数据" || text === "未标注") {
    return "未标注";
  }
  if (text.includes("央企")) {
    return "央企";
  }
  if (text.includes("国企")) {
    return "国企";
  }
  if (text.includes("民营") || text.includes("民企")) {
    return "民营";
  }
  return "项目类";
}

function buildProjectContextValues(args: {
  projectName?: string | null;
  projectAlias?: string | null;
  sourceCustomerName?: string | null;
  seedProjectBelonging?: string | null;
  seedCreditStatus?: string | null;
  seedCurrentStatus?: string | null;
  customerCreditStatus?: string | null;
  customerCreditStanding?: string | null;
  customerCurrentStatus?: string | null;
}) {
  const projectBelonging = fitDbText(
    args.seedProjectBelonging || args.projectAlias || args.projectName || args.sourceCustomerName || null,
    200,
  );
  const creditStatus = fitDbText(
    args.seedCreditStatus || args.customerCreditStatus || args.customerCreditStanding || null,
    100,
  );
  const currentStatus = fitDbText(
    args.seedCurrentStatus || args.customerCurrentStatus || null,
    200,
  );

  return {
    projectBelonging,
    creditStatus,
    currentStatus,
  };
}

function attachCustomerCodes<T extends { createdAt?: string; customerCode?: string; customerId: string }>(
  items: T[],
) {
  const sorted = [...items].sort((left, right) =>
    String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")),
  );
  const assigned = new Map<string, string>();
  let sequence = 1;

  for (const item of sorted) {
    const current = normalizeCustomerCode(item.customerCode);
    if (current) {
      assigned.set(item.customerId, current);
      const match = current.match(/^KH(\d+)$/);
      if (match) {
        sequence = Math.max(sequence, Number(match[1]) + 1);
      }
      continue;
    }

    const nextCode = buildCustomerCode(sequence);
    assigned.set(item.customerId, nextCode);
    sequence += 1;
  }

  return items.map((item) => ({
    ...item,
    customerCode: assigned.get(item.customerId) ?? normalizeCustomerCode(item.customerCode) ?? buildCustomerCode(sequence),
  }));
}

function normalizeCustomer(row: CustomerRecord): CustomerRecord {
  return {
    ...row,
    customerCode: normalizeCustomerCode(row.customerCode) ?? "",
    creditStatus: row.creditStatus ?? row.creditStanding ?? "",
    currentStatus: row.currentStatus ?? "",
    customerNature: row.customerNature ?? "",
    hasGuarantee: row.hasGuarantee ?? false,
    creditStanding: row.creditStanding ?? "",
    dueDiligenceCompleted: row.dueDiligenceCompleted ?? false,
    creditScore: row.creditScore ?? null,
    creditLevel: row.creditLevel ?? row.currentCreditLevel ?? "",
    riskAction: row.riskAction ?? "常规跟进",
    riskStatus: row.riskStatus ?? "正常",
    creditLimit: row.creditLimit ?? null,
    riskRemark: row.riskRemark ?? "",
  };
}

function normalizeReceivable(row: ReceivableRecord): ReceivableRecord {
  return applyReceivableRules({
    ...row,
    contractReceivable: row.contractReceivable ?? row.amount ?? 0,
    cumulativeReceivable: row.cumulativeReceivable ?? row.amount ?? 0,
    statementDate: row.statementDate ?? null,
    businessType: normalizeBusinessType(row.businessType),
    timeNode: row.timeNode ?? row.period ?? "",
    remark: row.remark ?? "",
    extraFields: row.extraFields ?? null,
    period: row.period ?? "",
    paymentTerm: row.paymentTerm ?? null,
    baseDate: row.baseDate ?? null,
    billingPeriodDays: row.billingPeriodDays ?? null,
    dueDate: row.dueDate ?? null,
    receivedDate: row.receivedDate ?? null,
    isSettled: row.isSettled ?? false,
    overdueDays: row.overdueDays ?? null,
    agingBucket: row.agingBucket ?? null,
  });
}

function normalizeContract(row: ContractRecord): ContractRecord {
  return {
    ...row,
    billingPeriodDays: row.billingPeriodDays ?? null,
    signedAt: row.signedAt ?? null,
  };
}

function normalizeRisk(row: RiskRecordItem): RiskRecordItem {
  return {
    ...row,
    handlingAction: row.handlingAction ?? "",
    followUpRecord: row.followUpRecord ?? "",
    riskStatus: row.riskStatus ?? (row.handled ? "已关闭" : "待处理"),
  };
}

function normalizeBusinessType(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  if (text === "诉" || text === "已诉" || text === "诉讼") {
    return "已诉";
  }
  if (text === "待起诉") {
    return "待起诉";
  }
  if (text === "尾款") {
    return "尾款";
  }
  return text;
}

function summarizeText(values: Array<string | null | undefined>, fallback = "待补数据", maxItems = 2) {
  const unique = Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (unique.length === 0) {
    return fallback;
  }

  const preview = unique.slice(0, maxItems).join("、");
  return unique.length > maxItems ? `${preview} 等${unique.length}项` : preview;
}

function inferCustomerEntityType(customerName: string, manualValue?: string | null) {
  const manual = String(manualValue ?? "").trim();
  if (manual === "公司" || manual === "个人" || manual === "自运" || manual === "其他") {
    return manual as "公司" | "个人" | "自运" | "其他";
  }

  const name = String(customerName ?? "").trim();
  if (!name) {
    return "其他" as const;
  }
  if (name.includes("自运")) {
    return "自运" as const;
  }
  if (/(公司|有限|集团|建设|建筑|工程|商贸|实业|劳务|分公司)/.test(name)) {
    return "公司" as const;
  }
  if (/^[\u4e00-\u9fa5·、]{2,8}$/.test(name)) {
    return "个人" as const;
  }
  return "其他" as const;
}

function riskLevelRank(level: "极高风险" | "高风险" | "中风险" | "低风险") {
  if (level === "极高风险") return 4;
  if (level === "高风险") return 3;
  if (level === "中风险") return 2;
  return 1;
}

const GENERIC_CUSTOMER_RISK_REASONS = new Set([
  "当前未发现明显异常",
]);

function riskReasonPriority(reason: string) {
  if (reason.includes("诉讼") || reason.includes("起诉")) return 100;
  if (reason.includes("跳票") || reason.includes("追索")) return 95;
  if (reason.includes("应回款月份已到")) return 90;
  if (reason.includes("项目金额和未收金额同时较大")) return 88;
  if (reason.includes("项目回款比例偏低")) return 86;
  if (reason.includes("未办理结算") || reason.includes("结算")) return 82;
  if (reason.includes("资金") || reason.includes("无法支付") || reason.includes("未回款")) return 78;
  if (reason.includes("高等级风险记录")) return 72;
  if (reason.includes("潜在风险提示")) return 68;
  if (reason.includes("存在项目未回款")) return 30;
  if (reason.includes("当前未发现明显异常")) return 0;
  return 40;
}

function buildCustomerRiskReasons(args: {
  computedRiskReasons: string[];
  projectRiskReasons: string[];
}) {
  const reasonFrequency = new Map<string, number>();
  for (const reason of args.projectRiskReasons) {
    const normalized = String(reason ?? "").trim();
    if (!normalized) continue;
    reasonFrequency.set(normalized, (reasonFrequency.get(normalized) ?? 0) + 1);
  }

  const merged = Array.from(
    new Set(
      [...args.computedRiskReasons, ...args.projectRiskReasons]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

  const informative = merged.filter((reason) => !GENERIC_CUSTOMER_RISK_REASONS.has(reason));
  const base = informative.length > 0 ? informative : merged;

  return base.sort((left, right) => {
    const priorityDiff = riskReasonPriority(right) - riskReasonPriority(left);
    if (priorityDiff !== 0) return priorityDiff;

    const frequencyDiff = (reasonFrequency.get(right) ?? 0) - (reasonFrequency.get(left) ?? 0);
    if (frequencyDiff !== 0) return frequencyDiff;

    return left.localeCompare(right, "zh-CN");
  });
}

function customerOverviewExposureBucket(unpaidAmount: number) {
  if (unpaidAmount >= 100_000_000) return 7;
  if (unpaidAmount >= 50_000_000) return 6;
  if (unpaidAmount >= 20_000_000) return 5;
  if (unpaidAmount >= 10_000_000) return 4;
  if (unpaidAmount >= 5_000_000) return 3;
  if (unpaidAmount >= 2_000_000) return 2;
  if (unpaidAmount >= 1_000_000) return 1;
  return 0;
}

function riskCustomerOverviewScore(item: RiskCustomerRow) {
  const exposureBucket = customerOverviewExposureBucket(item.totalUnpaidAmount);
  const levelScore = riskLevelRank(item.riskLevel);
  const projectScore = Math.min(item.highRiskProjectCount, 9);
  const importantScore = item.isImportantCustomer ? 1 : 0;

  return exposureBucket * 100 + levelScore * 10 + projectScore + importantScore;
}

function canonicalLedgerSheetName(sheetName: string | null | undefined) {
  return String(sheetName ?? "").replace(/-merged-[a-z0-9]+$/i, "");
}

function toNullableNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function almostEqual(left: number, right: number, tolerance = 0.01) {
  return Math.abs(left - right) <= tolerance;
}

function sumNumbers(values: Array<number | null | undefined>) {
  return values.reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}

function getLastDefinedNumber(values: Array<number | null | undefined>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && value !== undefined) {
      return Number(value);
    }
  }
  return null;
}

type LedgerFinancialRowLike = {
  statementAmount?: Prisma.Decimal | number | string | null;
  contractReceivable?: Prisma.Decimal | number | string | null;
  receivedAmount?: Prisma.Decimal | number | string | null;
  cumulativeReceivable?: Prisma.Decimal | number | string | null;
};

type LedgerProfileLike = {
  sheetName: string;
  sheetDataJson?: Prisma.JsonValue | null;
  contractUnpaidTotal?: Prisma.Decimal | number | string | null;
  rows: LedgerFinancialRowLike[];
};

type ProjectAmountSource = "ledgerProfile" | "receivable";

type ProjectFinancialSnapshot = {
  receivableAmount: number;
  contractReceivable: number;
  receivedAmount: number;
  unpaidAmount: number;
  source: ProjectAmountSource;
  sourceDetails: string[];
};

function computeLedgerProfileTotals(profile: LedgerProfileLike) {
  const normalizedRows = profile.rows.map((row) => ({
    statementAmount: toNullableNumber(row.statementAmount),
    contractReceivable: toNullableNumber(row.contractReceivable),
    receivedAmount: toNullableNumber(row.receivedAmount),
    cumulativeReceivable: toNullableNumber(row.cumulativeReceivable),
  }));

  let summaryRowIndex = -1;
  for (let index = 0; index < normalizedRows.length; index += 1) {
    const current = normalizedRows[index];
    const metrics = [
      current.statementAmount,
      current.contractReceivable,
      current.receivedAmount,
    ].filter((value) => value !== null && value !== undefined) as number[];

    if (metrics.length < 2) {
      continue;
    }

    const previousRows = normalizedRows.slice(0, index);
    let checks = 0;
    let matched = 0;
    for (const field of ["statementAmount", "contractReceivable", "receivedAmount"] as const) {
      const currentValue = current[field];
      if (currentValue === null || currentValue === undefined) {
        continue;
      }
      const previousSum = sumNumbers(previousRows.map((row) => row[field]));
      if (previousSum <= 0) {
        continue;
      }
      checks += 1;
      if (almostEqual(currentValue, previousSum)) {
        matched += 1;
      }
    }

    if (checks >= 2 && matched >= 2) {
      summaryRowIndex = index;
    }
  }

  const summaryRow = summaryRowIndex >= 0 ? normalizedRows[summaryRowIndex] : null;
  const receivableAmount = summaryRow?.statementAmount ?? sumNumbers(normalizedRows.map((row) => row.statementAmount));
  const contractReceivable =
    summaryRow?.contractReceivable ??
    sumNumbers(normalizedRows.map((row) => row.contractReceivable)) ??
    receivableAmount;
  const receivedAmount =
    summaryRow?.receivedAmount ?? sumNumbers(normalizedRows.map((row) => row.receivedAmount));
  const contractUnpaidTotal = toNullableNumber(profile.contractUnpaidTotal);
  const unpaidAmount =
    contractUnpaidTotal ??
    getLastDefinedNumber(normalizedRows.map((row) => row.cumulativeReceivable)) ??
    Math.max(contractReceivable - receivedAmount, 0);

  const hasFinancialSignal =
    receivableAmount > 0 || contractReceivable > 0 || receivedAmount > 0 || unpaidAmount > 0;

  return {
    receivableAmount,
    contractReceivable,
    receivedAmount,
    unpaidAmount,
    hasFinancialSignal,
  };
}

function selectPrimaryLedgerProfiles<T extends { sheetName: string }>(profiles: T[]) {
  const byCanonical = new Map<string, T>();
  for (const profile of profiles) {
    const canonicalName = canonicalLedgerSheetName(profile.sheetName);
    const existing = byCanonical.get(canonicalName);
    if (!existing) {
      byCanonical.set(canonicalName, profile);
      continue;
    }

    const existingCanonical = canonicalLedgerSheetName(existing.sheetName);
    const currentCanonical = canonicalLedgerSheetName(profile.sheetName);
    const shouldReplace =
      existing.sheetName !== existingCanonical &&
      profile.sheetName === currentCanonical;

    if (shouldReplace) {
      byCanonical.set(canonicalName, profile);
    }
  }

  return Array.from(byCanonical.values());
}

function buildProjectFinancialSnapshot(project: {
  receivables: Array<{
    amount?: Prisma.Decimal | number | string | null;
    contractReceivable?: Prisma.Decimal | number | string | null;
    receivedAmount?: Prisma.Decimal | number | string | null;
    unpaidAmount?: Prisma.Decimal | number | string | null;
  }>;
  ledgerProfiles?: LedgerProfileLike[];
}): ProjectFinancialSnapshot {
  const receivableSnapshot = {
    receivableAmount: sumNumbers(project.receivables.map((item) => toNullableNumber(item.amount))),
    contractReceivable: sumNumbers(
      project.receivables.map((item) => toNullableNumber(item.contractReceivable ?? item.amount)),
    ),
    receivedAmount: sumNumbers(project.receivables.map((item) => toNullableNumber(item.receivedAmount))),
    unpaidAmount: sumNumbers(project.receivables.map((item) => toNullableNumber(item.unpaidAmount))),
    source: "receivable" as const,
    sourceDetails: project.receivables.length > 0 ? ["receivables"] : [],
  };

  const ledgerProfiles = selectPrimaryLedgerProfiles(project.ledgerProfiles ?? []);
  if (ledgerProfiles.length === 0) {
    return receivableSnapshot;
  }

  const ledgerSnapshots = ledgerProfiles.map((profile) => ({
    sheetName: profile.sheetName,
    ...computeLedgerProfileTotals(profile),
  }));
  const effectiveSnapshots = ledgerSnapshots.filter((item) => item.hasFinancialSignal);

  if (effectiveSnapshots.length === 0) {
    return receivableSnapshot;
  }

  return {
    receivableAmount: sumNumbers(effectiveSnapshots.map((item) => item.receivableAmount)),
    contractReceivable: sumNumbers(effectiveSnapshots.map((item) => item.contractReceivable)),
    receivedAmount: sumNumbers(effectiveSnapshots.map((item) => item.receivedAmount)),
    unpaidAmount: sumNumbers(effectiveSnapshots.map((item) => item.unpaidAmount)),
    source: "ledgerProfile",
    sourceDetails: effectiveSnapshots.map((item) => item.sheetName),
  };
}

function extractRiskReasonText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function toSheetDataRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeCustomerRiskLevel(level: "高风险" | "中风险" | "低风险") {
  if (level === "高风险") return "高风险" as const;
  if (level === "中风险") return "中风险" as const;
  return "低风险" as const;
}

export async function computeCustomerRisk(customer: CustomerRecord) {
  const [receivables, persistedRisks] = await Promise.all([
    listReceivables({ customerId: customer.customerId }),
    listRisks({ customerId: customer.customerId }),
  ]);

  const reasons: string[] = [];
  const actions = new Set<string>();
  let level: "高风险" | "中风险" | "低风险" = "低风险";

  const highRiskBusinessTypes = receivables.filter((item) =>
    ["待起诉", "已诉"].includes(normalizeBusinessType(item.businessType)),
  );
  if (highRiskBusinessTypes.length > 0) {
    reasons.push("存在诉讼或待起诉项目");
    actions.add("跟进诉讼进展");
    actions.add("加快催收");
    level = "高风险";
  }

  const combinedText = [customer.currentStatus, customer.remark, customer.riskRemark]
    .map(extractRiskReasonText)
    .join(" ");
  if (["诉讼", "已起诉"].some((keyword) => combinedText.includes(keyword))) {
    reasons.push("客户当前状态或备注中存在诉讼信息");
    actions.add("跟进诉讼进展");
    level = "高风险";
  }

  if (persistedRisks.some((item) => item.riskType === "诉讼" || item.riskLevel === "高" || item.riskLevel === "重大")) {
    reasons.push("系统中存在高等级风险记录");
    actions.add("加快催收");
    level = "高风险";
  }

  const unpaidProjects = receivables.filter((item) => item.unpaidAmount > 0);
  if (unpaidProjects.length > 0 && level !== "低风险") {
    reasons.push("存在项目未回款");
  }

  if (level === "低风险") {
    if (["停工", "资金紧张", "未回款"].some((keyword) => extractRiskReasonText(customer.currentStatus).includes(keyword))) {
      reasons.push("客户当前状况存在回款或经营压力");
      actions.add("持续跟进回款");
      actions.add("补充客户动态");
      level = "中风险";
    } else if (["风险", "无法支付", "延期"].some((keyword) => extractRiskReasonText(customer.remark).includes(keyword) || extractRiskReasonText(customer.riskRemark).includes(keyword))) {
      reasons.push("客户备注中存在潜在风险提示");
      actions.add("持续跟进回款");
      actions.add("补充客户动态");
      level = "中风险";
    }
  }

  if (reasons.length === 0) {
    reasons.push("当前未发现明显异常");
  }

  if (actions.size === 0) {
    actions.add(level === "低风险" ? "保持常规跟进" : "持续跟进回款");
  }

  return {
    level,
    reasons: Array.from(new Set(reasons)),
    actions: Array.from(actions),
    receivables,
    persistedRisks,
  };
}

function matchRiskKeyword(text: string) {
  return ["风险", "异常", "诉讼", "停工", "拖欠", "违约", "逾期"].some((keyword) => text.includes(keyword));
}

function calcCreditLevel(totalScore: number) {
  if (totalScore >= 95) return "A+";
  if (totalScore >= 90) return "A";
  if (totalScore >= 85) return "A-";
  if (totalScore >= 75) return "B";
  if (totalScore >= 65) return "B-";
  return "C";
}

function getRiskActionByCreditLevel(creditLevel: string) {
  if (creditLevel === "C") return "诉讼";
  if (creditLevel === "B-") return "催款";
  if (creditLevel === "B") return "风险告知";
  return "常规跟进";
}

function getRiskStatusByCreditLevel(creditLevel: string) {
  if (creditLevel === "C") return "诉讼处置";
  if (creditLevel === "B-") return "催款中";
  if (creditLevel === "B") return "风险告知";
  return "正常";
}

function deriveInstitutionalScore(args: {
  customerId: string;
  scoreMonth: string;
  receivables: ReceivableRecord[];
  risks: Array<{
    customerId: string;
    riskType: string;
  }>;
  previousScore?: number | null;
}) {
  const scopedReceivables = args.receivables.filter(
    (item) => item.customerId === args.customerId && (!item.period || item.period === args.scoreMonth),
  );
  const relatedReceivables =
    scopedReceivables.length > 0
      ? scopedReceivables
      : args.receivables.filter((item) => item.customerId === args.customerId);
  const relatedRisks = args.risks.filter((item) => item.customerId === args.customerId);

  let score = 100;
  const reasons: string[] = [];

  const latePeriods = relatedReceivables.filter((item) => (item.overdueDays ?? 0) > 0);
  if (latePeriods.length > 0) {
    score -= Math.min(20, latePeriods.length * 8);
    reasons.push("存在未按期回款");
  }

  const crossMonthReceipts = relatedReceivables.filter(
    (item) =>
      item.receivedDate &&
      item.period &&
      item.receivedDate.slice(0, 7) > item.period.slice(0, 7),
  );
  if (crossMonthReceipts.length > 0) {
    score += 3;
    reasons.push("存在跨月持续回款");
  }

  const prepaymentReceipts = relatedReceivables.filter(
    (item) =>
      item.receivedDate &&
      item.baseDate &&
      new Date(item.receivedDate).getTime() < new Date(item.baseDate).getTime(),
  );
  if (prepaymentReceipts.length > 0) {
    score += 5;
    reasons.push("存在预付款记录");
  }

  if (relatedRisks.some((item) => item.riskType === "诉讼")) {
    score -= 20;
    reasons.push("存在诉讼事项");
  }

  score = Math.max(0, Math.min(100, score));
  const creditLevel = calcCreditLevel(score);
  const riskAction = getRiskActionByCreditLevel(creditLevel);
  const riskStatus = getRiskStatusByCreditLevel(creditLevel);
  const scoreDelta =
    args.previousScore === null || args.previousScore === undefined
      ? null
      : score - args.previousScore;

  const creditRiskScore = Math.max(0, Math.min(40, Math.round(score * 0.4)));
  const businessRiskScore = Math.max(0, Math.min(30, Math.round(score * 0.3)));
  const financialRiskScore = Math.max(0, Math.min(30, score - creditRiskScore - businessRiskScore));

  return {
    creditScore: score,
    creditLevel,
    riskAction,
    riskStatus,
    scoreDelta,
    creditRiskScore,
    businessRiskScore,
    financialRiskScore,
    description: reasons.length > 0 ? reasons.join("；") : "本月暂无明显负向事件，维持常规跟进。",
  };
}

function normalizeCreditScore(row: CreditScoreRecord): CreditScoreRecord {
  const totalScore = row.creditScore ?? row.creditRiskScore + row.businessRiskScore + row.financialRiskScore;
  const creditLevel = row.creditLevel || calcCreditLevel(totalScore);
  return {
    ...row,
    creditScore: totalScore,
    totalScore,
    creditLevel,
    riskAction: row.riskAction ?? getRiskActionByCreditLevel(creditLevel),
    riskStatus: row.riskStatus ?? getRiskStatusByCreditLevel(creditLevel),
    scoreDelta: row.scoreDelta ?? null,
  };
}

function enrichInstitutionalScores(
  rows: CreditScoreRecord[],
  receivables: ReceivableRecord[],
  risks: Array<{
    customerId: string;
    riskType: string;
  }>,
) {
  const grouped = new Map<string, CreditScoreRecord[]>();

  for (const row of rows) {
    const items = grouped.get(row.customerId) ?? [];
    items.push(row);
    grouped.set(row.customerId, items);
  }

  const enriched: CreditScoreRecord[] = [];

  for (const items of grouped.values()) {
    const sorted = [...items].sort((left, right) => left.scoreMonth.localeCompare(right.scoreMonth));
    let previousScore: number | null = null;

    for (const item of sorted) {
      const derived = deriveInstitutionalScore({
        customerId: item.customerId,
        scoreMonth: item.scoreMonth,
        receivables,
        risks,
        previousScore,
      });
      previousScore = derived.creditScore;
      enriched.push(
        normalizeCreditScore({
          ...item,
          creditRiskScore: derived.creditRiskScore,
          businessRiskScore: derived.businessRiskScore,
          financialRiskScore: derived.financialRiskScore,
          totalScore: derived.creditScore,
          creditScore: derived.creditScore,
          creditLevel: derived.creditLevel,
          riskAction: derived.riskAction,
          riskStatus: derived.riskStatus,
          scoreDelta: derived.scoreDelta,
          description: derived.description || item.description,
          keyAttention: ["B", "B-", "C"].includes(derived.creditLevel),
        }),
      );
    }
  }

  return enriched.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeCollectionItem(row: CollectionItemRecord): CollectionItemRecord {
  return {
    ...row,
    maxOverdueDays: row.maxOverdueDays ?? null,
    collectionLevel: row.collectionLevel ?? null,
  };
}

function contractStatusToDb(status: string) {
  if (status === "执行中") return "active";
  if (status === "已完成") return "completed";
  if (status === "已终止") return "terminated";
  if (status === "暂停中") return "suspended";
  return "draft";
}

function contractStatusFromDb(status: string) {
  if (status === "active") return "执行中";
  if (status === "completed") return "已完成";
  if (status === "terminated") return "已终止";
  if (status === "suspended") return "暂停中";
  return "待回款";
}

export async function listCustomers(filters: CustomerFilters = {}) {
  const receivables = await listReceivables();
  const scores = await listCreditScores();
  const risks = await listRisks();

  try {
    const customers = await prisma.customer.findMany({
      where: { isMerged: false },
      orderBy: { updatedAt: "desc" },
    });
    const normalizedCustomers = attachCustomerCodes(
      customers.map((item) =>
        normalizeCustomer({
          id: item.id,
          customerId: item.customerId,
          customerCode: item.customerCode ?? "",
          name: item.name,
          normalizedName: item.normalizedName ?? item.name,
          sourceCustomerName: item.sourceCustomerName ?? "",
          isMerged: item.isMerged,
          mergedIntoCustomerId: item.mergedIntoCustomerId,
          creditStatus: item.creditStatus ?? item.creditStanding ?? "",
          currentStatus: item.currentStatus ?? "",
          customerNature: "",
          hasGuarantee: false,
          creditStanding: item.creditStanding ?? "",
          dueDiligenceCompleted: false,
          unifiedSocialCreditCode: item.unifiedSocialCreditCode ?? "",
          industry: item.industry ?? "",
          salesOwnerName: item.salesOwnerName ?? "",
          contactName: item.contactName ?? "",
          contactPhone: item.contactPhone ?? "",
          currentCreditLevel: item.currentCreditLevel ?? "",
          creditScore: item.latestCreditScore ?? null,
          creditLevel: item.currentCreditLevel ?? "",
          riskAction: "常规跟进",
          riskStatus: "正常",
          creditLimit: item.creditLimit === null ? null : Number(item.creditLimit ?? 0),
          stopSupply: item.stopSupply,
          remark: item.remark ?? "",
          riskRemark: item.riskRemark ?? "",
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }),
      ),
    );

    return normalizedCustomers
      .map((item) =>
        applyCustomerRules(
          item,
          receivables.filter((record) => record.customerId === item.customerId),
          scores.filter((record) => record.customerId === item.customerId),
          risks.filter((record) => record.customerId === item.customerId),
        ),
      )
      .filter((item) => !isNoiseCustomerName(item.name))
      .filter((item) =>
        containsKeyword(filters.keyword ?? "", [
          item.customerCode,
          item.customerId,
          item.name,
          item.unifiedSocialCreditCode,
          item.contactName,
          item.contactPhone,
          item.salesOwnerName,
        ]),
      );
  } catch {
    return attachCustomerCodes(memoryStore.customers)
      .map((item) =>
        applyCustomerRules(
          normalizeCustomer(item),
          receivables.filter((record) => record.customerId === item.customerId),
          scores.filter((record) => record.customerId === item.customerId),
          risks.filter((record) => record.customerId === item.customerId),
        ),
      )
      .filter((item) => !isNoiseCustomerName(item.name))
      .filter((item) =>
        containsKeyword(filters.keyword ?? "", [
          item.customerCode,
          item.customerId,
          item.name,
          item.unifiedSocialCreditCode,
          item.contactName,
          item.contactPhone,
          item.salesOwnerName,
        ]),
      );
  }
}

export async function listCustomerLedger(filters: CustomerLedgerFilters = {}): Promise<CustomerLedgerResponse> {
  const sortBy = filters.sortBy ?? "unpaidAmount";
  const sortOrder = filters.sortOrder ?? "desc";
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const keyword = String(filters.keyword ?? "").trim();

  try {
    const baseCustomers = (await prisma.customer.findMany({
      where: {
        isMerged: false,
      },
      orderBy: { updatedAt: "desc" },
    })).filter((item) => !isNoiseCustomerName(item.name));

    const customerDbIds = baseCustomers.map((item) => item.id);
    const [projects, unclassifiedProfiles] = await Promise.all([
      prisma.project.findMany({
        where: { customerId: { in: customerDbIds } },
        include: {
          receivables: true,
          ledgerProfiles: {
            select: {
              sheetName: true,
              sheetDataJson: true,
              contractUnpaidTotal: true,
              rows: {
                select: {
                  statementAmount: true,
                  contractReceivable: true,
                  receivedAmount: true,
                  cumulativeReceivable: true,
                },
                orderBy: { rowOrder: "asc" },
              },
            },
          },
          _count: {
            select: { ledgerProfiles: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.customerLedgerProfile.findMany({
        where: {
          customerId: { in: customerDbIds },
          projectId: null,
        },
        select: {
          id: true,
          customerId: true,
        },
      }),
    ]);

    const projectMapByCustomer = new Map<string, typeof projects>();
    for (const project of projects) {
      const current = projectMapByCustomer.get(project.customerId) ?? [];
      current.push(project);
      projectMapByCustomer.set(project.customerId, current);
    }

    const unclassifiedCountByCustomer = new Map<string, number>();
    for (const profile of unclassifiedProfiles) {
      unclassifiedCountByCustomer.set(
        profile.customerId,
        (unclassifiedCountByCustomer.get(profile.customerId) ?? 0) + 1,
      );
    }

    const rows = await Promise.all(
      baseCustomers.map(async (customer) => {
        const customerProjects = (projectMapByCustomer.get(customer.id) ?? []).filter(
          (project) => !isNoiseProjectName(project.name),
        );
        const lightweightCustomer = normalizeCustomer({
          id: customer.id,
          customerId: customer.customerId,
          customerCode: customer.customerCode ?? "",
          name: customer.name,
          normalizedName: customer.normalizedName ?? customer.name,
          sourceCustomerName: customer.sourceCustomerName ?? "",
          isMerged: customer.isMerged,
          mergedIntoCustomerId: customer.mergedIntoCustomerId,
          creditStatus: customer.creditStatus ?? customer.creditStanding ?? "",
          currentStatus: customer.currentStatus ?? "",
          customerNature: customer.customerNature ?? "",
          hasGuarantee: customer.hasGuarantee ?? false,
          creditStanding: customer.creditStanding ?? "",
          dueDiligenceCompleted: customer.dueDiligenceCompleted ?? false,
          unifiedSocialCreditCode: customer.unifiedSocialCreditCode ?? "",
          industry: customer.industry ?? "",
          salesOwnerName: customer.salesOwnerName ?? "",
          contactName: customer.contactName ?? "",
          contactPhone: customer.contactPhone ?? "",
          currentCreditLevel: customer.currentCreditLevel ?? "",
          creditScore: customer.latestCreditScore === null ? null : Number(customer.latestCreditScore ?? 0),
          creditLevel: customer.currentCreditLevel ?? "",
          riskAction: "常规跟进",
          riskStatus: "正常",
          creditLimit: customer.creditLimit === null ? null : Number(customer.creditLimit ?? 0),
          stopSupply: customer.stopSupply,
          remark: customer.remark ?? "",
          riskRemark: customer.riskRemark ?? "",
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        });
        const computedRisk = await computeCustomerRisk(lightweightCustomer);

        const projects: CustomerLedgerProjectRow[] = customerProjects.map((project) => {
          const financials = buildProjectFinancialSnapshot(project);
          const primaryLedgerProfiles = selectPrimaryLedgerProfiles(project.ledgerProfiles ?? []);
          const primarySheetData =
            toSheetDataRecord(
              primaryLedgerProfiles.find((profile) => Boolean(profile.sheetDataJson))?.sheetDataJson ?? null,
            );
          const ruleResults = evaluateProjectExecutableRiskRules({
            receivableAmount: financials.receivableAmount,
            contractReceivable: financials.contractReceivable,
            receivedAmount: financials.receivedAmount,
            unpaidAmount: financials.unpaidAmount,
            sheetData: primarySheetData,
          });
          const projectRisk = summarizeProjectExecutableRiskRules(ruleResults);
          const projectBelonging = summarizeText(
            [
              project.projectBelonging,
              project.projectAlias,
              project.sourceCustomerName,
              project.name,
            ],
            "待补数据",
            1,
          );
          return {
            projectId: project.id,
            projectName: project.name,
            projectAlias: project.projectAlias ?? null,
            normalizedProjectName: project.normalizedProjectName ?? project.name,
            sourceCustomerName: project.sourceCustomerName ?? null,
            projectBelonging,
            receivableAmount: financials.receivableAmount,
            contractReceivable: financials.contractReceivable,
            receivedAmount: financials.receivedAmount,
            unpaidAmount: financials.unpaidAmount,
            remarkRaw: project.remark ?? null,
            creditStatusRaw: project.creditStatus ?? customer.creditStatus ?? customer.creditStanding ?? null,
            currentStatusRaw: project.currentStatus ?? customer.currentStatus ?? null,
            remarkSummary: summarizeText([
              project.remark,
              ...project.receivables.map((item) => item.remark),
            ]),
            creditStatusSummary: summarizeText([project.creditStatus, customer.creditStatus, customer.creditStanding]),
            currentStatusSummary: summarizeText([project.currentStatus, customer.currentStatus]),
            businessType:
              project.receivables.find((item) => normalizeBusinessType(item.businessType) === "已诉")?.businessType ??
              project.receivables.find((item) => normalizeBusinessType(item.businessType) === "待起诉")?.businessType ??
              project.receivables.find((item) => item.businessType)?.businessType ??
              "",
            timeNode:
              project.receivables.find((item) => item.timeNode)?.timeNode ??
              project.receivables.find((item) => item.statementDate)?.statementDate?.toISOString().slice(0, 10) ??
              "",
            ledgerArchiveCount: project._count.ledgerProfiles,
            hasLedgerArchive: project._count.ledgerProfiles > 0,
            riskLevel: projectRisk.riskLevel,
            riskReasons: projectRisk.reasons,
            riskActions: projectRisk.actions,
            triggeredRules: projectRisk.triggeredRules,
            ruleResults,
          };
        });

        const totalReceivableAmount = projects.reduce((sum, item) => sum + item.receivableAmount, 0);
        const totalContractReceivable = projects.reduce((sum, item) => sum + item.contractReceivable, 0);
        const totalReceivedAmount = projects.reduce((sum, item) => sum + item.receivedAmount, 0);
        const totalUnpaidAmount = projects.reduce((sum, item) => sum + item.unpaidAmount, 0);
        const customerRuleLevel =
          [...projects].sort((left, right) => riskLevelRank(right.riskLevel) - riskLevelRank(left.riskLevel))[0]
            ?.riskLevel ?? "低风险";
        const legacyRiskLevel = normalizeCustomerRiskLevel(computedRisk.level);
        const customerRiskLevel =
          riskLevelRank(customerRuleLevel) > riskLevelRank(legacyRiskLevel) ? customerRuleLevel : legacyRiskLevel;
        const customerRiskReasons = buildCustomerRiskReasons({
          computedRiskReasons: computedRisk.reasons,
          projectRiskReasons: projects.flatMap((item) => item.riskReasons),
        });
        const customerRiskActions = Array.from(
          new Set([...computedRisk.actions, ...projects.flatMap((item) => item.riskActions)]),
        );
        const customerTriggeredRules = Array.from(
          new Set(projects.flatMap((item) => item.triggeredRules)),
        );

        return {
          customerId: customer.customerId,
          customerCode: customer.customerCode ?? "",
          customerName: customer.name,
          customerType: inferCustomerEntityType(customer.name, customer.customerNature),
          normalizedName: customer.normalizedName ?? customer.name,
          projectCount: projects.length,
          totalReceivableAmount,
          totalContractReceivable,
          totalReceivedAmount,
          totalUnpaidAmount,
          projectNamesPreview: summarizeText(projects.map((item) => item.projectName), "暂无项目", 3),
          projectBelongingSummary: summarizeText(projects.map((item) => item.projectBelonging)),
          remarkSummary: summarizeText([customer.remark, ...projects.map((item) => item.remarkSummary)]),
          creditStatusSummary: summarizeText([customer.creditStatus, customer.creditStanding]),
          currentStatusSummary: summarizeText([customer.currentStatus]),
          riskLevel: customerRiskLevel,
          riskReasons: customerRiskReasons,
          riskActions: customerRiskActions,
          triggeredRules: customerTriggeredRules,
          hasUnclassifiedArchives: (unclassifiedCountByCustomer.get(customer.id) ?? 0) > 0,
          unclassifiedArchiveCount: unclassifiedCountByCustomer.get(customer.id) ?? 0,
          projects,
        };
      }),
    );

    const filtered = rows.filter((row) => {
      const keywordMatch =
        customerMatchesLedgerKeyword(filters.keyword ?? "", row) ||
        row.projects.some((project) => projectMatchesLedgerKeyword(filters.keyword ?? "", project));
      const matchesType = !filters.customerType || row.customerType === filters.customerType;
      const matchesRisk = !filters.riskLevel || row.riskLevel === filters.riskLevel;
      const matchesUnclassified =
        filters.hasUnclassifiedArchives === undefined ||
        row.hasUnclassifiedArchives === filters.hasUnclassifiedArchives;
      return keywordMatch && matchesType && matchesRisk && matchesUnclassified;
    });

    const sorted = filtered.sort((left, right) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "receivableAmount") {
        return (left.totalReceivableAmount - right.totalReceivableAmount) * direction;
      }
      if (sortBy === "riskLevel") {
        return (riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)) * direction;
      }
      if (sortBy === "projectCount") {
        return (left.projectCount - right.projectCount) * direction;
      }
      return (left.totalUnpaidAmount - right.totalUnpaidAmount) * direction;
    });

    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

    return {
      summary: {
        customerCount: filtered.length,
        projectCount: filtered.reduce((sum, item) => sum + item.projectCount, 0),
        totalReceivableAmount: filtered.reduce((sum, item) => sum + item.totalReceivableAmount, 0),
        totalContractReceivable: filtered.reduce((sum, item) => sum + item.totalContractReceivable, 0),
        totalReceivedAmount: filtered.reduce((sum, item) => sum + item.totalReceivedAmount, 0),
        totalUnpaidAmount: filtered.reduce((sum, item) => sum + item.totalUnpaidAmount, 0),
        totalUnclassifiedArchiveCount: filtered.reduce((sum, item) => sum + item.unclassifiedArchiveCount, 0),
      },
      customers: paged,
    };
  } catch {
    const customers = await listCustomers({});
    const projects = await listProjectsByCustomer();
    const rows = await Promise.all(
      customers.map(async (customer) => {
        const customerProjects = projects.filter(
          (item) => item.customerId === customer.customerId && !isNoiseProjectName(item.projectName),
        );
        const computedRisk = await computeCustomerRisk(customer);
        const mappedProjects: CustomerLedgerProjectRow[] = customerProjects.map((project) => {
          const ruleResults = evaluateProjectExecutableRiskRules({
            receivableAmount: project.receivableAmount,
            contractReceivable: project.receivableAmount,
            receivedAmount: project.receivedAmount,
            unpaidAmount: project.unpaidAmount,
            sheetData: null,
          });
          const projectRisk = summarizeProjectExecutableRiskRules(ruleResults);

          return {
            projectId: project.id,
            projectName: project.projectName,
            projectAlias: project.projectAlias ?? null,
            normalizedProjectName: project.normalizedProjectName ?? project.projectName,
            sourceCustomerName: project.sourceCustomerName ?? null,
            projectBelonging: summarizeText([project.projectBelonging, project.projectAlias, project.sourceCustomerName, project.projectName], "待补数据", 1),
            receivableAmount: project.receivableAmount,
            contractReceivable: project.receivableAmount,
            receivedAmount: project.receivedAmount,
            unpaidAmount: project.unpaidAmount,
            remarkRaw: project.remark ?? null,
            creditStatusRaw: project.creditStatus ?? customer.creditStatus ?? customer.creditStanding ?? null,
            currentStatusRaw: project.currentStatus ?? customer.currentStatus ?? null,
            remarkSummary: summarizeText([project.remark]),
            creditStatusSummary: summarizeText([project.creditStatus, customer.creditStatus, customer.creditStanding]),
            currentStatusSummary: summarizeText([project.currentStatus, customer.currentStatus]),
            businessType: project.businessType ?? "",
            timeNode: "",
            ledgerArchiveCount: 0,
            hasLedgerArchive: false,
            riskLevel: projectRisk.riskLevel,
            riskReasons: projectRisk.reasons,
            riskActions: projectRisk.actions,
            triggeredRules: projectRisk.triggeredRules,
            ruleResults,
          };
        });
        const customerRuleLevel =
          [...mappedProjects].sort((left, right) => riskLevelRank(right.riskLevel) - riskLevelRank(left.riskLevel))[0]
            ?.riskLevel ?? "低风险";
        const legacyRiskLevel = normalizeCustomerRiskLevel(computedRisk.level);
        const customerRiskLevel =
          riskLevelRank(customerRuleLevel) > riskLevelRank(legacyRiskLevel) ? customerRuleLevel : legacyRiskLevel;
        const customerRiskReasons = buildCustomerRiskReasons({
          computedRiskReasons: computedRisk.reasons,
          projectRiskReasons: mappedProjects.flatMap((item) => item.riskReasons),
        });
        const customerRiskActions = Array.from(
          new Set([...computedRisk.actions, ...mappedProjects.flatMap((item) => item.riskActions)]),
        );
        const customerTriggeredRules = Array.from(
          new Set(mappedProjects.flatMap((item) => item.triggeredRules)),
        );

        return {
          customerId: customer.customerId,
          customerCode: customer.customerCode ?? "",
          customerName: customer.name,
          customerType: inferCustomerEntityType(customer.name, customer.customerNature),
          normalizedName: customer.normalizedName ?? customer.name,
          projectCount: mappedProjects.length,
          totalReceivableAmount: mappedProjects.reduce((sum, item) => sum + item.receivableAmount, 0),
          totalContractReceivable: mappedProjects.reduce((sum, item) => sum + item.contractReceivable, 0),
          totalReceivedAmount: mappedProjects.reduce((sum, item) => sum + item.receivedAmount, 0),
          totalUnpaidAmount: mappedProjects.reduce((sum, item) => sum + item.unpaidAmount, 0),
          projectNamesPreview: summarizeText(mappedProjects.map((item) => item.projectName), "暂无项目", 3),
          projectBelongingSummary: summarizeText(mappedProjects.map((item) => item.projectBelonging)),
          remarkSummary: summarizeText([customer.remark, ...mappedProjects.map((item) => item.remarkSummary)]),
          creditStatusSummary: summarizeText([customer.creditStatus, customer.creditStanding]),
          currentStatusSummary: summarizeText([customer.currentStatus]),
          riskLevel: customerRiskLevel,
          riskReasons: customerRiskReasons,
          riskActions: customerRiskActions,
          triggeredRules: customerTriggeredRules,
          hasUnclassifiedArchives: false,
          unclassifiedArchiveCount: 0,
          projects: mappedProjects,
        };
      }),
    );

    const filtered = rows.filter((row) => {
      const keywordMatch =
        customerMatchesLedgerKeyword(filters.keyword ?? "", row) ||
        row.projects.some((project) => projectMatchesLedgerKeyword(filters.keyword ?? "", project));
      const matchesType = !filters.customerType || row.customerType === filters.customerType;
      const matchesRisk = !filters.riskLevel || row.riskLevel === filters.riskLevel;
      const matchesUnclassified =
        filters.hasUnclassifiedArchives === undefined ||
        row.hasUnclassifiedArchives === filters.hasUnclassifiedArchives;
      return keywordMatch && matchesType && matchesRisk && matchesUnclassified;
    });

    const sorted = filtered.sort((left, right) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "receivableAmount") {
        return (left.totalReceivableAmount - right.totalReceivableAmount) * direction;
      }
      if (sortBy === "riskLevel") {
        return (riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)) * direction;
      }
      if (sortBy === "projectCount") {
        return (left.projectCount - right.projectCount) * direction;
      }
      return (left.totalUnpaidAmount - right.totalUnpaidAmount) * direction;
    });

    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

    return {
      summary: {
        customerCount: filtered.length,
        projectCount: filtered.reduce((sum, item) => sum + item.projectCount, 0),
        totalReceivableAmount: filtered.reduce((sum, item) => sum + item.totalReceivableAmount, 0),
        totalContractReceivable: filtered.reduce((sum, item) => sum + item.totalContractReceivable, 0),
        totalReceivedAmount: filtered.reduce((sum, item) => sum + item.totalReceivedAmount, 0),
        totalUnpaidAmount: filtered.reduce((sum, item) => sum + item.totalUnpaidAmount, 0),
        totalUnclassifiedArchiveCount: 0,
      },
      customers: paged,
    };
  }
}

function buildImportanceMap(customers: CustomerRecord[]) {
  const map = new Map<string, { isImportantCustomer: boolean; updatedAt?: string }>();
  for (const customer of customers) {
    map.set(customer.customerId, {
      isImportantCustomer: Boolean(customer.keyAttentionCustomer || customer.highRiskCustomer),
      updatedAt: customer.updatedAt,
    });
  }
  return map;
}

function mapLedgerCustomerToRiskCustomer(
  row: CustomerLedgerCustomerRow,
  importanceMap: Map<string, { isImportantCustomer: boolean; updatedAt?: string }>,
): RiskCustomerRow {
  const meta = importanceMap.get(row.customerId);
  const highRiskProjectCount = row.projects.filter((project) =>
    ["高风险", "极高风险"].includes(project.riskLevel),
  ).length;
  const hasLitigationProject = row.projects.some((project) =>
    ["待起诉", "已诉", "诉"].includes(normalizeBusinessType(project.businessType)),
  );
  const hasUnclosedProjects = row.projects.some((project) => !project.hasLedgerArchive) || row.hasUnclassifiedArchives;

  return {
    customerId: row.customerId,
    customerName: row.customerName,
    customerType: row.customerType,
    riskLevel: row.riskLevel,
    riskReasons: row.riskReasons,
    riskActions: row.riskActions,
    totalReceivableAmount: row.totalReceivableAmount,
    totalReceivedAmount: row.totalReceivedAmount,
    totalUnpaidAmount: row.totalUnpaidAmount,
    projectCount: row.projectCount,
    highRiskProjectCount,
    hasLitigationProject,
    hasUnclosedProjects,
    hasUnclassifiedArchives: row.hasUnclassifiedArchives,
    isImportantCustomer: meta?.isImportantCustomer ?? false,
    triggeredRules: row.triggeredRules,
    remarkSummary: row.remarkSummary,
    creditStatusSummary: row.creditStatusSummary,
    currentStatusSummary: row.currentStatusSummary,
    updatedAt: meta?.updatedAt,
  };
}

function mapLedgerProjectToRiskProject(
  customer: CustomerLedgerCustomerRow,
  project: CustomerLedgerProjectRow,
): RiskProjectRow {
  const collectionRate =
    project.contractReceivable > 0 ? Number((project.receivedAmount / project.contractReceivable).toFixed(4)) : null;

  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    customerType: customer.customerType,
    projectId: project.projectId,
    projectName: project.projectName,
    projectBelonging: project.projectBelonging,
    projectBelongingCategory: categorizeProjectBelonging(project.projectBelonging),
    businessType: project.businessType,
    riskLevel: project.riskLevel,
    riskReasons: project.riskReasons,
    riskActions: project.riskActions,
    receivableAmount: project.receivableAmount,
    contractReceivable: project.contractReceivable,
    receivedAmount: project.receivedAmount,
    unpaidAmount: project.unpaidAmount,
    collectionRate,
    triggeredRules: project.triggeredRules,
    isUnclosed: !project.hasLedgerArchive,
    hasLedgerArchive: project.hasLedgerArchive,
    hasUnclassifiedArchives: customer.hasUnclassifiedArchives,
    remarkSummary: project.remarkSummary,
    creditStatusSummary: project.creditStatusSummary,
    currentStatusSummary: project.currentStatusSummary,
  };
}

export async function getRiskOverview(): Promise<RiskOverviewData> {
  const recentAlertSince = new Date();
  recentAlertSince.setDate(recentAlertSince.getDate() - 7);

  const [ledger, customers, newAlertCount] = await Promise.all([
    listCustomerLedger({ page: 1, pageSize: 5000 }),
    listCustomers({}),
    process.env.DATABASE_URL
      ? prisma.riskRecord.count({
          where: {
            status: "open",
            detectedAt: {
              gte: recentAlertSince,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  const importanceMap = buildImportanceMap(customers);
  const riskCustomers = ledger.customers.map((item) => mapLedgerCustomerToRiskCustomer(item, importanceMap));
  const filteredRiskCustomers = riskCustomers.filter((item) => !isNoiseRiskSubjectName(item.customerName));
  const riskProjects = ledger.customers
    .filter((customer) => !isNoiseRiskSubjectName(customer.customerName))
    .flatMap((customer) =>
    customer.projects.map((project) => mapLedgerProjectToRiskProject(customer, project)),
  );

  const riskReasonDistribution = new Map<string, number>();
  for (const item of [...filteredRiskCustomers.flatMap((customer) => customer.riskReasons), ...riskProjects.flatMap((project) => project.riskReasons)]) {
    if (!item) continue;
    riskReasonDistribution.set(item, (riskReasonDistribution.get(item) ?? 0) + 1);
  }

  const customerTypeDistribution = new Map<string, number>();
  for (const item of filteredRiskCustomers) {
    customerTypeDistribution.set(item.customerType, (customerTypeDistribution.get(item.customerType) ?? 0) + 1);
  }

  const riskLevelDistribution = new Map<"低风险" | "中风险" | "高风险" | "极高风险", number>();
  for (const item of riskProjects) {
    riskLevelDistribution.set(item.riskLevel, (riskLevelDistribution.get(item.riskLevel) ?? 0) + 1);
  }

  const topCustomers = [...filteredRiskCustomers]
    .filter((item) => item.riskLevel !== "低风险")
    .sort((left, right) => {
      const scoreDiff = riskCustomerOverviewScore(right) - riskCustomerOverviewScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      if (right.totalUnpaidAmount !== left.totalUnpaidAmount) {
        return right.totalUnpaidAmount - left.totalUnpaidAmount;
      }
      if (right.highRiskProjectCount !== left.highRiskProjectCount) {
        return right.highRiskProjectCount - left.highRiskProjectCount;
      }
      return riskLevelRank(right.riskLevel) - riskLevelRank(left.riskLevel);
    })
    .slice(0, 10);

  const topProjects = [...riskProjects]
    .filter((item) => item.riskLevel !== "低风险")
    .sort((left, right) => {
      const levelDiff = riskLevelRank(right.riskLevel) - riskLevelRank(left.riskLevel);
      if (levelDiff !== 0) return levelDiff;
      return right.unpaidAmount - left.unpaidAmount;
    })
    .slice(0, 10);

  return {
    metrics: {
      highRiskCustomerCount: filteredRiskCustomers.filter((item) => ["高风险", "极高风险"].includes(item.riskLevel)).length,
      highRiskProjectCount: riskProjects.filter((item) => ["高风险", "极高风险"].includes(item.riskLevel)).length,
      extremeRiskProjectCount: riskProjects.filter((item) => item.riskLevel === "极高风险").length,
      totalUnpaidAmount: riskProjects.reduce((sum, item) => sum + item.unpaidAmount, 0),
      largeExposureProjectCount: riskProjects.filter((item) => item.triggeredRules.includes("R-011")).length,
      litigationProjectCount: riskProjects.filter((item) =>
        ["待起诉", "已诉", "诉"].includes(normalizeBusinessType(item.businessType)),
      ).length,
      unclosedProjectCount: riskProjects.filter((item) => item.isUnclosed).length,
      newAlertCount: typeof newAlertCount === "number" ? newAlertCount : 0,
    },
    distributions: {
      riskLevel: (["低风险", "中风险", "高风险", "极高风险"] as const).map((label) => ({
        label,
        count: riskLevelDistribution.get(label) ?? 0,
      })),
      customerType: (["公司", "个人", "自运", "其他"] as const).map((label) => ({
        label,
        count: customerTypeDistribution.get(label) ?? 0,
      })),
      riskReason: Array.from(riskReasonDistribution.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)
        .map(([label, count]) => ({ label, count })),
    },
    topCustomers,
    topProjects,
  };
}

export async function listRiskCustomers(filters: RiskCustomerFilters = {}): Promise<RiskCustomerResponse> {
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const sortBy = filters.sortBy ?? "unpaidAmount";
  const sortOrder = filters.sortOrder ?? "desc";

  const [ledger, customers] = await Promise.all([
    listCustomerLedger({ page: 1, pageSize: 5000 }),
    listCustomers({}),
  ]);

  const importanceMap = buildImportanceMap(customers);
  const rows = ledger.customers
    .map((item) => mapLedgerCustomerToRiskCustomer(item, importanceMap))
    .filter((item) => !isNoiseRiskSubjectName(item.customerName))
    .filter((item) => item.riskLevel !== "低风险");

  const filtered = rows.filter((item) => {
    const keywordMatch = containsKeyword(filters.keyword ?? "", [
      item.customerId,
      item.customerName,
      ...item.riskReasons,
      item.currentStatusSummary,
      item.creditStatusSummary,
      item.remarkSummary,
    ]);
    const matchesRisk = !filters.riskLevel || item.riskLevel === filters.riskLevel;
    const matchesType = !filters.customerType || item.customerType === filters.customerType;
    const matchesImportant =
      filters.isImportantCustomer === undefined || item.isImportantCustomer === filters.isImportantCustomer;
    const matchesUnclosed =
      filters.hasUnclosedProjects === undefined || item.hasUnclosedProjects === filters.hasUnclosedProjects;
    return keywordMatch && matchesRisk && matchesType && matchesImportant && matchesUnclosed;
  });

  const sorted = filtered.sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "riskLevel") {
      return (riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)) * direction;
    }
    if (sortBy === "highRiskProjectCount") {
      return (left.highRiskProjectCount - right.highRiskProjectCount) * direction;
    }
    if (sortBy === "projectCount") {
      return (left.projectCount - right.projectCount) * direction;
    }
    return (left.totalUnpaidAmount - right.totalUnpaidAmount) * direction;
  });

  return {
    summary: {
      customerCount: filtered.length,
      totalUnpaidAmount: filtered.reduce((sum, item) => sum + item.totalUnpaidAmount, 0),
      highRiskCustomerCount: filtered.filter((item) => item.riskLevel === "高风险").length,
      extremeRiskCustomerCount: filtered.filter((item) => item.riskLevel === "极高风险").length,
    },
    customers: sorted.slice((page - 1) * pageSize, page * pageSize),
  };
}

export async function listRiskProjects(filters: RiskProjectFilters = {}): Promise<RiskProjectResponse> {
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(filters.pageSize ?? 100) || 100));
  const sortBy = filters.sortBy ?? "unpaidAmount";
  const sortOrder = filters.sortOrder ?? "desc";

  const ledger = await listCustomerLedger({ page: 1, pageSize: 5000 });
  const rows = ledger.customers
    .filter((customer) => !isNoiseRiskSubjectName(customer.customerName))
    .flatMap((customer) => customer.projects.map((project) => mapLedgerProjectToRiskProject(customer, project)))
    .filter((item) => item.riskLevel !== "低风险");

  const filtered = rows.filter((item) => {
    const keywordMatch = containsKeyword(filters.keyword ?? "", [
      item.customerName,
      item.projectName,
      item.projectBelonging,
      ...item.riskReasons,
      item.currentStatusSummary,
      item.creditStatusSummary,
      item.remarkSummary,
    ]);
    const matchesRisk = !filters.riskLevel || item.riskLevel === filters.riskLevel;
    const matchesProjectBelonging =
      !filters.projectBelongingCategory || item.projectBelongingCategory === filters.projectBelongingCategory;
    const matchesBusinessType = !filters.businessType || normalizeBusinessType(item.businessType) === normalizeBusinessType(filters.businessType);
    const matchesLedger = filters.hasLedgerArchive === undefined || item.hasLedgerArchive === filters.hasLedgerArchive;
    const matchesUnclosed = filters.isUnclosed === undefined || item.isUnclosed === filters.isUnclosed;
    return keywordMatch && matchesRisk && matchesProjectBelonging && matchesBusinessType && matchesLedger && matchesUnclosed;
  });

  const sorted = filtered.sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "riskLevel") {
      return (riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)) * direction;
    }
    if (sortBy === "collectionRate") {
      return ((left.collectionRate ?? 0) - (right.collectionRate ?? 0)) * direction;
    }
    if (sortBy === "receivableAmount") {
      return (left.receivableAmount - right.receivableAmount) * direction;
    }
    return (left.unpaidAmount - right.unpaidAmount) * direction;
  });

  return {
    summary: {
      projectCount: filtered.length,
      totalUnpaidAmount: filtered.reduce((sum, item) => sum + item.unpaidAmount, 0),
      highRiskProjectCount: filtered.filter((item) => item.riskLevel === "高风险").length,
      extremeRiskProjectCount: filtered.filter((item) => item.riskLevel === "极高风险").length,
      projectBelongingCategories: (["央企", "国企", "民营", "项目类", "未标注"] as const).map((label) => ({
        label,
        count: filtered.filter((item) => item.projectBelongingCategory === label).length,
      })),
    },
    projects: sorted.slice((page - 1) * pageSize, page * pageSize),
  };
}

export async function getCustomerById(id: string) {
  try {
    const exact = await prisma.customer.findFirst({
      where: {
        OR: [{ id }, { customerId: id }, { customerCode: id }],
      },
      include: {
        mergedIntoCustomer: true,
      },
    });

    if (exact?.mergedIntoCustomer) {
      const target = exact.mergedIntoCustomer;
      return normalizeCustomer({
        id: target.id,
        customerId: target.customerId,
        customerCode: target.customerCode ?? "",
        name: target.name,
        normalizedName: target.normalizedName ?? target.name,
        sourceCustomerName: target.sourceCustomerName ?? "",
        isMerged: target.isMerged,
        mergedIntoCustomerId: target.mergedIntoCustomerId,
        creditStatus: target.creditStatus ?? target.creditStanding ?? "",
        currentStatus: target.currentStatus ?? "",
        customerNature: "",
        hasGuarantee: false,
        creditStanding: target.creditStanding ?? "",
        dueDiligenceCompleted: false,
        unifiedSocialCreditCode: target.unifiedSocialCreditCode ?? "",
        industry: target.industry ?? "",
        salesOwnerName: target.salesOwnerName ?? "",
        contactName: target.contactName ?? "",
        contactPhone: target.contactPhone ?? "",
        currentCreditLevel: target.currentCreditLevel ?? "",
        creditScore: target.latestCreditScore ?? null,
        creditLevel: target.currentCreditLevel ?? "",
        riskAction: "常规跟进",
        riskStatus: "正常",
        creditLimit: target.creditLimit === null ? null : Number(target.creditLimit ?? 0),
        stopSupply: target.stopSupply,
        remark: target.remark ?? "",
        riskRemark: target.riskRemark ?? "",
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
      });
    }
  } catch {
    // Fallback below.
  }

  const customers = await listCustomers();
  return customers.find((item) => item.id === id || item.customerId === id || item.customerCode === id) ?? null;
}

export async function createCustomer(payload: CustomerPayload) {
  const customerCode =
    normalizeCustomerCode(payload.customerCode) ??
    (() => {
      try {
        return generateNextCustomerCode(memoryStore.customers.map((item) => item.customerCode));
      } catch {
        return generateNextCustomerCode([]);
      }
    })();
  try {
    const existingCodes = (await prisma.customer.findMany({ select: { customerCode: true } })).map(
      (item) => item.customerCode,
    );
    const nextCustomerCode =
      normalizeCustomerCode(payload.customerCode) ?? generateNextCustomerCode(existingCodes);
    const created = await prisma.customer.create({
      data: {
        customerId: payload.customerId,
        customerCode: nextCustomerCode,
        name: payload.name,
        creditStatus: payload.creditStatus || null,
        currentStatus: payload.currentStatus || null,
        unifiedSocialCreditCode: payload.unifiedSocialCreditCode || null,
        industry: payload.industry || null,
        salesOwnerName: payload.salesOwnerName || null,
        contactName: payload.contactName || null,
        contactPhone: payload.contactPhone || null,
        currentCreditLevel: payload.currentCreditLevel || null,
        latestCreditScore: payload.creditScore ?? null,
        creditLimit: payload.creditLimit ?? null,
        stopSupply: payload.stopSupply,
        remark: payload.remark || null,
        riskRemark: payload.riskRemark || null,
      },
    });

    return normalizeCustomer({
      id: created.id,
      customerId: created.customerId,
      customerCode: created.customerCode ?? nextCustomerCode,
      name: created.name,
      creditStatus: payload.creditStatus ?? payload.creditStanding ?? "",
      currentStatus: payload.currentStatus ?? "",
      customerNature: payload.customerNature ?? "",
      hasGuarantee: payload.hasGuarantee ?? false,
      creditStanding: payload.creditStanding ?? "",
      dueDiligenceCompleted: payload.dueDiligenceCompleted ?? false,
      unifiedSocialCreditCode: created.unifiedSocialCreditCode ?? "",
      industry: created.industry ?? "",
      salesOwnerName: created.salesOwnerName ?? "",
      contactName: created.contactName ?? "",
      contactPhone: created.contactPhone ?? "",
      currentCreditLevel: created.currentCreditLevel ?? "",
      creditScore: created.latestCreditScore ?? payload.creditScore ?? null,
      creditLevel: payload.creditLevel ?? created.currentCreditLevel ?? "",
      riskAction: payload.riskAction ?? "常规跟进",
      riskStatus: payload.riskStatus ?? "正常",
      creditLimit: created.creditLimit === null ? null : Number(created.creditLimit ?? 0),
      stopSupply: created.stopSupply,
      remark: created.remark ?? "",
      riskRemark: created.riskRemark ?? "",
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch {
    const record = buildCustomerRecord({ ...payload, customerCode });
    memoryStore.customers.unshift(record);
    return record;
  }
}

export async function updateCustomer(id: string, payload: CustomerPayload) {
  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        customerId: payload.customerId,
        customerCode:
          normalizeCustomerCode(payload.customerCode) ??
          existing?.customerCode ??
          generateNextCustomerCode(
            (
              await prisma.customer.findMany({
                select: { customerCode: true },
              })
            ).map((item) => item.customerCode),
          ),
        name: payload.name,
        creditStatus: payload.creditStatus || null,
        currentStatus: payload.currentStatus || null,
        unifiedSocialCreditCode: payload.unifiedSocialCreditCode || null,
        industry: payload.industry || null,
        salesOwnerName: payload.salesOwnerName || null,
        contactName: payload.contactName || null,
        contactPhone: payload.contactPhone || null,
        currentCreditLevel: payload.currentCreditLevel || null,
        latestCreditScore: payload.creditScore ?? null,
        creditLimit: payload.creditLimit ?? null,
        stopSupply: payload.stopSupply,
        remark: payload.remark || null,
        riskRemark: payload.riskRemark || null,
      },
    });

    return normalizeCustomer({
      id: updated.id,
      customerId: updated.customerId,
      customerCode: updated.customerCode ?? payload.customerCode,
      name: updated.name,
      creditStatus: payload.creditStatus ?? payload.creditStanding ?? "",
      currentStatus: payload.currentStatus ?? "",
      customerNature: payload.customerNature ?? "",
      hasGuarantee: payload.hasGuarantee ?? false,
      creditStanding: payload.creditStanding ?? "",
      dueDiligenceCompleted: payload.dueDiligenceCompleted ?? false,
      unifiedSocialCreditCode: updated.unifiedSocialCreditCode ?? "",
      industry: updated.industry ?? "",
      salesOwnerName: updated.salesOwnerName ?? "",
      contactName: updated.contactName ?? "",
      contactPhone: updated.contactPhone ?? "",
      currentCreditLevel: updated.currentCreditLevel ?? "",
      creditScore: updated.latestCreditScore ?? payload.creditScore ?? null,
      creditLevel: payload.creditLevel ?? updated.currentCreditLevel ?? "",
      riskAction: payload.riskAction ?? "常规跟进",
      riskStatus: payload.riskStatus ?? "正常",
      creditLimit: updated.creditLimit === null ? null : Number(updated.creditLimit ?? 0),
      stopSupply: updated.stopSupply,
      remark: updated.remark ?? "",
      riskRemark: updated.riskRemark ?? "",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.customers.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("客户不存在");
    }
    const next = buildCustomerRecord(
      {
        ...payload,
        customerCode:
          normalizeCustomerCode(payload.customerCode) ??
          memoryStore.customers[index].customerCode ??
          generateNextCustomerCode(memoryStore.customers.map((item) => item.customerCode)),
      },
      memoryStore.customers[index],
    );
    memoryStore.customers[index] = next;
    return next;
  }
}

export async function listReceivables(filters: ReceivableFilters = {}) {
  try {
    const rows = await prisma.accountReceivable.findMany({
      include: { customer: true, project: true },
      orderBy: { updatedAt: "desc" },
    });

    return applyReceivablePortfolioRules(
      rows.map((item) => {
        const raw = item as unknown as Record<string, unknown>;
        return normalizeReceivable({
          id: item.id,
          receivableNo: item.receivableNo,
          customerId: item.customer.customerId,
          customerCode: item.customer.customerCode ?? "",
          customerName: item.customer.name,
          salesOwnerName: item.salesOwnerName ?? "",
          projectName: item.project?.name ?? item.projectName ?? "",
          contractReceivable:
            typeof raw.contractReceivable === "number"
              ? raw.contractReceivable
              : Number(item.amount),
          cumulativeReceivable:
            typeof raw.cumulativeReceivable === "number"
              ? raw.cumulativeReceivable
              : Number(item.amount),
          statementDate:
            raw.statementDate instanceof Date
              ? raw.statementDate.toISOString().slice(0, 10)
              : null,
          businessType: typeof raw.businessType === "string" ? raw.businessType : "",
          timeNode: typeof raw.timeNode === "string" ? raw.timeNode : "",
          remark: typeof raw.remark === "string" ? raw.remark : "",
          extraFields:
            raw.extraFields && typeof raw.extraFields === "object"
              ? (raw.extraFields as Record<string, unknown>)
              : null,
          period: typeof raw.period === "string" ? raw.period : "",
          paymentTerm: typeof raw.paymentTerm === "string" ? raw.paymentTerm : null,
          baseDate:
            raw.baseDate instanceof Date
              ? raw.baseDate.toISOString().slice(0, 10)
              : null,
          amount: Number(item.amount),
          receivedAmount: Number(item.receivedAmount ?? 0),
          unpaidAmount: Number(item.unpaidAmount ?? 0),
          monthlyReceivedAmount: Number(item.monthlyReceivedAmount ?? 0),
          paymentRate: 0,
          billingPeriodDays: item.billingPeriodDays ?? null,
          dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
          receivedDate:
            raw.receivedDate instanceof Date
              ? raw.receivedDate.toISOString().slice(0, 10)
              : null,
          isSettled: typeof raw.isSettled === "boolean" ? raw.isSettled : false,
          overdueDays: item.overdueDays ?? null,
          agingBucket: item.agingBucket ?? null,
          riskStatus: item.riskStatus ?? "正常",
          receivableStatus: item.receivableStatus,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        });
      }),
    )
      .filter((item) => applyReceivableFilters(item, filters));
  } catch {
    return applyReceivablePortfolioRules(
      memoryStore.receivables.map((item) => normalizeReceivable(item)),
    ).filter((item) => applyReceivableFilters(item, filters));
  }
}

function applyReceivableFilters(item: ReceivableRecord, filters: ReceivableFilters) {
  const matchesKeyword = containsKeyword(filters.keyword ?? "", [
    item.customerCode,
    item.customerName,
    item.projectName,
    item.receivableNo,
    item.salesOwnerName,
    item.businessType,
    item.remark,
  ]);
  const matchesCustomer = !filters.customerId || item.customerId === filters.customerId;
  const matchesOwner = !filters.salesOwnerName || item.salesOwnerName === filters.salesOwnerName;
  const matchesRisk = !filters.riskStatus || item.riskStatus === filters.riskStatus;
  const matchesBusinessType =
    !filters.businessType || normalizeBusinessType(item.businessType) === normalizeBusinessType(filters.businessType);

  return matchesKeyword && matchesCustomer && matchesOwner && matchesRisk && matchesBusinessType;
}

export async function getReceivableById(id: string) {
  const items = await listReceivables();
  return items.find((item) => item.id === id || item.receivableNo === id) ?? null;
}

export async function createReceivable(payload: ReceivablePayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  try {
    const data = {
      receivableNo: `AR-${Date.now()}`,
      customer: { connect: { customerId: payload.customerId } },
      project:
        payload.projectName
          ? {
              connectOrCreate: {
                where: {
                  customerId_name: {
                    customerId: customer.id,
                    name: payload.projectName,
                  },
                },
                create: {
                  customerId: customer.id,
                  name: payload.projectName,
                  status: payload.businessType || payload.receivableStatus || "进行中",
                  remark: payload.remark || null,
                },
              },
            }
          : undefined,
      projectName: payload.projectName || null,
      contractReceivable: payload.contractReceivable,
      cumulativeReceivable: payload.cumulativeReceivable,
      statementDate: payload.statementDate ? new Date(payload.statementDate) : null,
      businessType: payload.businessType || null,
      timeNode: payload.timeNode || null,
      period: payload.period || null,
      paymentTerm: payload.paymentTerm || null,
      baseDate: payload.baseDate ? new Date(payload.baseDate) : null,
      amount: payload.amount,
      receivedAmount: payload.receivedAmount,
      receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : null,
      unpaidAmount: Math.max(payload.amount - payload.receivedAmount, 0),
      monthlyReceivedAmount: payload.monthlyReceivedAmount,
      salesOwnerName: payload.salesOwnerName || null,
      billingPeriodDays: payload.billingPeriodDays,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      isSettled: payload.receivedAmount >= payload.amount && payload.amount > 0,
      overdueDays: payload.overdueDays,
      agingBucket: payload.agingBucket || null,
      riskStatus: payload.riskStatus || null,
      receivableStatus: payload.receivableStatus,
      remark: payload.remark || null,
    } as never;
    const created = await prisma.accountReceivable.create({
      data,
      include: { customer: true, project: true },
    });

    return normalizeReceivable({
      id: created.id,
      receivableNo: created.receivableNo,
      customerId: created.customer.customerId,
      customerCode: created.customer.customerCode ?? "",
      customerName: created.customer.name,
      salesOwnerName: created.salesOwnerName ?? "",
      projectName: created.project?.name ?? created.projectName ?? "",
      contractReceivable: payload.contractReceivable,
      cumulativeReceivable: payload.cumulativeReceivable,
      statementDate: payload.statementDate ?? null,
      businessType: payload.businessType,
      timeNode: payload.timeNode,
      remark: payload.remark,
      period: payload.period,
      paymentTerm: payload.paymentTerm ?? null,
      baseDate: payload.baseDate ?? null,
      amount: Number(created.amount),
      receivedAmount: Number(created.receivedAmount ?? 0),
      unpaidAmount: Number(created.unpaidAmount ?? 0),
      monthlyReceivedAmount: Number(created.monthlyReceivedAmount ?? 0),
      paymentRate: 0,
      billingPeriodDays: created.billingPeriodDays ?? null,
      dueDate: created.dueDate?.toISOString().slice(0, 10) ?? null,
      receivedDate: payload.receivedDate ?? null,
      isSettled: false,
      overdueDays: created.overdueDays ?? null,
      agingBucket: created.agingBucket ?? null,
      riskStatus: created.riskStatus ?? "正常",
      receivableStatus: created.receivableStatus,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch {
    const record = buildReceivableRecord(payload, customer.name);
    memoryStore.receivables.unshift(record);
    return normalizeReceivable(record);
  }
}

export async function updateReceivable(id: string, payload: ReceivablePayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  try {
    const data = {
      customer: { connect: { customerId: payload.customerId } },
      project:
        payload.projectName
          ? {
              connectOrCreate: {
                where: {
                  customerId_name: {
                    customerId: customer.id,
                    name: payload.projectName,
                  },
                },
                create: {
                  customerId: customer.id,
                  name: payload.projectName,
                  status: payload.businessType || payload.receivableStatus || "进行中",
                  remark: payload.remark || null,
                },
              },
            }
          : undefined,
      projectName: payload.projectName || null,
      contractReceivable: payload.contractReceivable,
      cumulativeReceivable: payload.cumulativeReceivable,
      statementDate: payload.statementDate ? new Date(payload.statementDate) : null,
      businessType: payload.businessType || null,
      timeNode: payload.timeNode || null,
      period: payload.period || null,
      paymentTerm: payload.paymentTerm || null,
      baseDate: payload.baseDate ? new Date(payload.baseDate) : null,
      amount: payload.amount,
      receivedAmount: payload.receivedAmount,
      receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : null,
      unpaidAmount: Math.max(payload.amount - payload.receivedAmount, 0),
      monthlyReceivedAmount: payload.monthlyReceivedAmount,
      salesOwnerName: payload.salesOwnerName || null,
      billingPeriodDays: payload.billingPeriodDays,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      isSettled: payload.receivedAmount >= payload.amount && payload.amount > 0,
      overdueDays: payload.overdueDays,
      agingBucket: payload.agingBucket || null,
      riskStatus: payload.riskStatus || null,
      receivableStatus: payload.receivableStatus,
      remark: payload.remark || null,
    } as never;
    const updated = await prisma.accountReceivable.update({
      where: { id },
      data,
      include: { customer: true, project: true },
    });

    return normalizeReceivable({
      id: updated.id,
      receivableNo: updated.receivableNo,
      customerId: updated.customer.customerId,
      customerCode: updated.customer.customerCode ?? "",
      customerName: updated.customer.name,
      salesOwnerName: updated.salesOwnerName ?? "",
      projectName: updated.project?.name ?? updated.projectName ?? "",
      contractReceivable: payload.contractReceivable,
      cumulativeReceivable: payload.cumulativeReceivable,
      statementDate: payload.statementDate ?? null,
      businessType: payload.businessType,
      timeNode: payload.timeNode,
      remark: payload.remark,
      period: payload.period,
      paymentTerm: payload.paymentTerm ?? null,
      baseDate: payload.baseDate ?? null,
      amount: Number(updated.amount),
      receivedAmount: Number(updated.receivedAmount ?? 0),
      unpaidAmount: Number(updated.unpaidAmount ?? 0),
      monthlyReceivedAmount: Number(updated.monthlyReceivedAmount ?? 0),
      paymentRate: 0,
      billingPeriodDays: updated.billingPeriodDays ?? null,
      dueDate: updated.dueDate?.toISOString().slice(0, 10) ?? null,
      receivedDate: payload.receivedDate ?? null,
      isSettled: false,
      overdueDays: updated.overdueDays ?? null,
      agingBucket: updated.agingBucket ?? null,
      riskStatus: updated.riskStatus ?? "正常",
      receivableStatus: updated.receivableStatus,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.receivables.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("应收账款不存在");
    }
    const next = buildReceivableRecord(payload, customer.name, memoryStore.receivables[index]);
    memoryStore.receivables[index] = next;
    return normalizeReceivable(next);
  }
}

export async function listProjectsByCustomer(customerId?: string) {
  try {
    const rows = await prisma.project.findMany({
      where: customerId
        ? {
            customer: {
              customerId,
            },
          }
        : undefined,
      include: {
        customer: true,
        receivables: true,
        ledgerProfiles: {
          select: {
            sheetName: true,
            contractUnpaidTotal: true,
            rows: {
              select: {
                statementAmount: true,
                contractReceivable: true,
                receivedAmount: true,
                cumulativeReceivable: true,
              },
              orderBy: { rowOrder: "asc" },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((item) => {
      const financials = buildProjectFinancialSnapshot(item);
      return ({
      id: item.id,
      customerId: item.customer.customerId,
      customerCode: item.customer.customerCode ?? "",
      customerName: item.customer.name,
      projectName: item.name,
      normalizedProjectName: item.normalizedProjectName ?? item.name,
      projectAlias: item.projectAlias ?? null,
      projectBelonging: item.projectBelonging ?? null,
      creditStatus: item.creditStatus ?? null,
      currentStatus: item.currentStatus ?? null,
      sourceCustomerName: item.sourceCustomerName ?? null,
      derivedFromCustomerName: item.derivedFromCustomerName,
      projectStatus: item.status ?? "进行中",
      businessType:
        item.receivables.find((row) => normalizeBusinessType(row.businessType) === "已诉")?.businessType ??
        item.receivables.find((row) => normalizeBusinessType(row.businessType) === "待起诉")?.businessType ??
        item.receivables.find((row) => normalizeBusinessType(row.businessType) === "老款")?.businessType ??
        item.receivables.find((row) => normalizeBusinessType(row.businessType) === "尾款")?.businessType ??
        item.receivables.find((row) => row.businessType)?.businessType ??
        "",
      paymentRate:
        financials.receivableAmount > 0
          ? Number(
              (
                financials.receivedAmount /
                financials.receivableAmount
              ).toFixed(4),
            )
          : 0,
      isOverdue: item.receivables.some(
        (row) => Number(row.unpaidAmount ?? 0) > 0 && Boolean(row.timeNode ?? row.statementDate),
      ),
      tags: Array.from(
        new Set(
          item.receivables
            .map((row) => normalizeBusinessType(row.businessType))
            .filter(Boolean),
        ),
      ),
      remark: item.remark ?? "",
      receivableAmount: financials.receivableAmount,
      receivedAmount: financials.receivedAmount,
      unpaidAmount: financials.unpaidAmount,
    })});
  } catch {
    // Fall back to development dataset mode when DATABASE_URL is unavailable.
  }

  const receivables = await listReceivables(customerId ? { customerId } : {});
  const projectMap = new Map<string, {
    id: string;
    customerId: string;
    customerCode?: string;
    customerName: string;
    projectName: string;
    normalizedProjectName?: string;
    projectAlias?: string | null;
    projectBelonging?: string | null;
    creditStatus?: string | null;
    currentStatus?: string | null;
    sourceCustomerName?: string | null;
    derivedFromCustomerName?: boolean;
    projectStatus: string;
    businessType?: string;
    paymentRate?: number;
    isOverdue?: boolean;
    tags?: string[];
    remark: string;
    receivableAmount: number;
    receivedAmount: number;
    unpaidAmount: number;
  }>();

  for (const item of receivables) {
    if (isNoiseCustomerName(item.customerName) || isNoiseProjectName(item.projectName)) {
      continue;
    }
    const key = `${item.customerId}::${item.projectName}`;
    const current = projectMap.get(key);
    if (!current) {
      projectMap.set(key, {
        id: `project-${key}`,
        customerId: item.customerId,
        customerCode: item.customerCode,
        customerName: item.customerName,
        projectName: item.projectName || "待补数据",
        normalizedProjectName: normalizeProjectName(item.projectName || "待补数据"),
        projectAlias: null,
        projectBelonging: null,
        creditStatus: null,
        currentStatus: null,
        sourceCustomerName: null,
        derivedFromCustomerName: false,
        projectStatus: item.isSettled ? "已结清" : item.businessType || item.receivableStatus || "进行中",
        businessType: item.businessType || "",
        paymentRate: item.amount > 0 ? Number((item.receivedAmount / item.amount).toFixed(4)) : 0,
        isOverdue: item.unpaidAmount > 0 && Boolean(item.timeNode),
        tags: item.businessType ? [item.businessType] : [],
        remark: item.remark || "",
        receivableAmount: item.amount,
        receivedAmount: item.receivedAmount,
        unpaidAmount: item.unpaidAmount,
      });
      continue;
    }

    current.receivableAmount += item.amount;
    current.receivedAmount += item.receivedAmount;
    current.unpaidAmount += item.unpaidAmount;
    if (!current.remark && item.remark) {
      current.remark = item.remark;
    }
    if (!current.businessType && item.businessType) {
      current.businessType = item.businessType;
    }
    current.paymentRate = current.receivableAmount > 0 ? Number((current.receivedAmount / current.receivableAmount).toFixed(4)) : 0;
    current.isOverdue = current.unpaidAmount > 0 && Boolean(item.timeNode || current.isOverdue);
    current.tags = Array.from(new Set([...(current.tags ?? []), ...(item.businessType ? [item.businessType] : [])]));
    if (item.businessType && current.projectStatus === "进行中") {
      current.projectStatus = item.businessType;
    }
  }

  return Array.from(projectMap.values()).sort((left, right) => right.unpaidAmount - left.unpaidAmount);
}

export async function getCustomerSummary(customerId: string): Promise<CustomerSummaryRecord | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return null;
  }

  try {
    const dbCustomer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customer.id }, { customerId: customer.customerId }, { customerCode: customer.customerCode || undefined }],
      },
      select: { id: true },
    });

    if (dbCustomer) {
      const projects = await prisma.project.findMany({
        where: { customerId: dbCustomer.id },
        include: {
          receivables: true,
          ledgerProfiles: {
            select: {
              sheetName: true,
              contractUnpaidTotal: true,
              rows: {
                select: {
                  statementAmount: true,
                  contractReceivable: true,
                  receivedAmount: true,
                  cumulativeReceivable: true,
                },
                orderBy: { rowOrder: "asc" },
              },
            },
          },
        },
      });
      const computedRisk = await computeCustomerRisk(customer);
      const totalReceivable = projects.reduce(
        (sum, project) => sum + buildProjectFinancialSnapshot(project).receivableAmount,
        0,
      );
      const totalReceived = projects.reduce(
        (sum, project) => sum + buildProjectFinancialSnapshot(project).receivedAmount,
        0,
      );
      const totalUnpaid = projects.reduce(
        (sum, project) => sum + buildProjectFinancialSnapshot(project).unpaidAmount,
        0,
      );

      return {
        totalReceivable,
        totalReceived,
        totalUnpaid,
        projectCount: projects.length,
        riskConclusion: computedRisk.level,
        riskReasons: computedRisk.reasons,
        riskActions: computedRisk.actions,
      };
    }
  } catch {
    // fallback below
  }

  const projects = await listProjectsByCustomer(customer.customerId);
  const computedRisk = await computeCustomerRisk(customer);
  return {
    totalReceivable: projects.reduce((sum, item) => sum + item.receivableAmount, 0),
    totalReceived: projects.reduce((sum, item) => sum + item.receivedAmount, 0),
    totalUnpaid: projects.reduce((sum, item) => sum + item.unpaidAmount, 0),
    projectCount: projects.length,
    riskConclusion: computedRisk.level,
    riskReasons: computedRisk.reasons,
    riskActions: computedRisk.actions,
  };
}

export async function getCustomerFullProfile(customerId: string): Promise<CustomerFullProfileRecord | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return null;
  }

  try {
    const dbCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: customer.id },
          { customerId: customer.customerId },
          { customerCode: customer.customerCode || undefined },
        ],
      },
      select: {
        id: true,
        customerId: true,
        customerCode: true,
        name: true,
        creditStatus: true,
        currentStatus: true,
        remark: true,
      },
    });

    if (dbCustomer) {
      const [projects, computedRisk, mergeMappings] = await Promise.all([
        prisma.project.findMany({
          where: { customerId: dbCustomer.id },
          include: {
            receivables: {
              orderBy: { updatedAt: "desc" },
            },
            ledgerProfiles: {
              select: {
                sheetName: true,
                contractUnpaidTotal: true,
                rows: {
                  select: {
                    statementAmount: true,
                    contractReceivable: true,
                    receivedAmount: true,
                    cumulativeReceivable: true,
                  },
                  orderBy: { rowOrder: "asc" },
                },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
        computeCustomerRisk(customer),
        prisma.customerMergeMapping.findMany({
          where: { targetCustomerId: dbCustomer.id },
          orderBy: { sourceCustomerName: "asc" },
          select: { sourceCustomerName: true },
        }),
      ]);

      return {
        customer: {
          id: customer.id,
          customerId: dbCustomer.customerId,
          customerCode: dbCustomer.customerCode ?? "",
          name: dbCustomer.name,
          creditStatus: dbCustomer.creditStatus ?? "",
          currentStatus: dbCustomer.currentStatus ?? "",
          remark: dbCustomer.remark ?? "",
        },
        traceability: {
          mergedSourceNames: mergeMappings.map((item) => item.sourceCustomerName),
        },
        summary: {
          totalReceivable: projects.reduce(
            (sum, project) => sum + buildProjectFinancialSnapshot(project).receivableAmount,
            0,
          ),
          totalReceived: projects.reduce(
            (sum, project) => sum + buildProjectFinancialSnapshot(project).receivedAmount,
            0,
          ),
          totalUnpaid: projects.reduce(
            (sum, project) => sum + buildProjectFinancialSnapshot(project).unpaidAmount,
            0,
          ),
          projectCount: projects.length,
        },
        projects: projects.map((project) => {
          const financials = buildProjectFinancialSnapshot(project);
          const preferredBusinessType =
            project.receivables.find((item) => normalizeBusinessType(item.businessType) === "已诉")?.businessType ??
            project.receivables.find((item) => normalizeBusinessType(item.businessType) === "待起诉")?.businessType ??
            project.receivables.find((item) => normalizeBusinessType(item.businessType) === "尾款")?.businessType ??
            project.receivables.find((item) => item.businessType)?.businessType ??
            "";

          return {
            id: project.id,
            projectName: project.name,
            normalizedProjectName: project.normalizedProjectName ?? project.name,
            projectAlias: project.projectAlias ?? null,
            sourceCustomerName: project.sourceCustomerName ?? null,
            derivedFromCustomerName: project.derivedFromCustomerName,
            receivableAmount: financials.receivableAmount,
            receivedAmount: financials.receivedAmount,
            unpaidAmount: financials.unpaidAmount,
            businessType: preferredBusinessType,
            timeNode:
              project.receivables.find((item) => item.timeNode)?.timeNode ??
              project.receivables.find((item) => item.statementDate)?.statementDate?.toISOString().slice(0, 10) ??
              "",
            remark:
              project.receivables.find((item) => item.remark)?.remark ??
              project.remark ??
              "",
          };
        }),
        risk: {
          conclusion: computedRisk.level,
          reasons: computedRisk.reasons,
          actions: computedRisk.actions,
          creditStatus: dbCustomer.creditStatus ?? "",
          currentStatus: dbCustomer.currentStatus ?? "",
          remark: dbCustomer.remark ?? "",
        },
      };
    }
  } catch {
    // fallback below
  }

  const [summary, projects, computedRisk] = await Promise.all([
    getCustomerSummary(customer.customerId),
    listProjectsByCustomer(customer.customerId),
    computeCustomerRisk(customer),
  ]);

  return {
    customer: {
      id: customer.id,
      customerId: customer.customerId,
      customerCode: customer.customerCode ?? "",
      name: customer.name,
      creditStatus: customer.creditStatus ?? "",
      currentStatus: customer.currentStatus ?? "",
      remark: customer.remark ?? "",
    },
    traceability: {
      mergedSourceNames: [],
    },
    summary: {
      totalReceivable: summary?.totalReceivable ?? 0,
      totalReceived: summary?.totalReceived ?? 0,
      totalUnpaid: summary?.totalUnpaid ?? 0,
      projectCount: summary?.projectCount ?? projects.length,
    },
    projects: projects.map((project) => ({
      id: project.id,
      projectName: project.projectName,
      receivableAmount: project.receivableAmount,
      receivedAmount: project.receivedAmount,
      unpaidAmount: project.unpaidAmount,
      businessType: project.businessType ?? "",
      timeNode: "",
      remark: project.remark ?? "",
    })),
    risk: {
      conclusion: computedRisk.level,
      reasons: computedRisk.reasons,
      actions: computedRisk.actions,
      creditStatus: customer.creditStatus ?? "",
      currentStatus: customer.currentStatus ?? "",
      remark: customer.remark ?? "",
    },
  };
}

export async function getCustomerLedgerArchive(customerId: string): Promise<CustomerLedgerArchiveRecord | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return null;
  }

  try {
    const dbCustomer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customer.id }, { customerId: customer.customerId }, { customerCode: customer.customerCode || undefined }],
      },
      select: {
        id: true,
        customerId: true,
        customerCode: true,
        name: true,
      },
    });

    if (dbCustomer) {
      const profiles = await prisma.customerLedgerProfile.findMany({
        where: { customerId: dbCustomer.id },
        include: {
          rows: {
            orderBy: { rowOrder: "asc" },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { sheetName: "asc" }],
      });

      return {
        customer: {
          id: customer.id,
          customerId: dbCustomer.customerId,
          customerCode: dbCustomer.customerCode ?? "",
          name: dbCustomer.name,
        },
        archives: profiles.map((profile) => ({
          id: profile.id,
          projectId: profile.projectId ?? null,
          sheetName: profile.sheetName,
          workbookSource: profile.workbookSource ?? undefined,
          projectName: profile.projectName ?? "",
          settlementClause: profile.settlementClause ?? "",
          sheetData: (profile.sheetDataJson as Record<string, unknown> | null | undefined) ?? null,
          summary: {
            contractUnpaidTotal: profile.contractUnpaidTotal === null ? null : Number(profile.contractUnpaidTotal),
            uninvoicedTotal: profile.uninvoicedTotal === null ? null : Number(profile.uninvoicedTotal),
            extraSummary: (profile.extraSummary as Record<string, unknown> | null | undefined) ?? null,
          },
          rows: profile.rows.map((row) => ({
            id: row.id,
            rowOrder: row.rowOrder,
            statementDate: row.statementDate ?? null,
            quantity: row.quantity === null ? null : Number(row.quantity),
            statementAmount: row.statementAmount === null ? null : Number(row.statementAmount),
            contractReceivable: row.contractReceivable === null ? null : Number(row.contractReceivable),
            receivedDate: row.receivedDate ?? null,
            receivedAmount: row.receivedAmount === null ? null : Number(row.receivedAmount),
            cumulativeReceivable: row.cumulativeReceivable === null ? null : Number(row.cumulativeReceivable),
            invoiceDate: row.invoiceDate ?? null,
            invoiceQuantity: row.invoiceQuantity === null ? null : Number(row.invoiceQuantity),
            invoiceAmount: row.invoiceAmount === null ? null : Number(row.invoiceAmount),
            remark: row.remark ?? "",
            extraFields: (row.extraFields as Record<string, unknown> | null | undefined) ?? null,
          })),
        })),
      };
    }
  } catch {
    // Fallback below
  }

  const projects = await listProjectsByCustomer(customer.customerId);
  return buildDevelopmentLedgerArchives(
    {
      id: customer.id,
      customerId: customer.customerId,
      customerCode: customer.customerCode ?? "",
      name: customer.name,
    },
    projects,
  );
}

export async function updateCustomerLedgerArchive(
  customerId: string,
  payload: {
    sheets: Array<{
      id: string;
      sheetData: Record<string, unknown>;
    }>;
  },
) {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const sheet of payload.sheets) {
    await prisma.customerLedgerProfile.updateMany({
      where: {
        id: sheet.id,
        customer: {
          OR: [{ id: customer.id }, { customerId: customer.customerId }],
        },
      },
      data: {
        sheetDataJson: toJsonInput(sheet.sheetData),
      },
    });
    updated += 1;
  }

  return { updated };
}

type ImportedCustomerSeed = {
  customerName: string;
  creditStatus?: string | null;
  currentStatus?: string | null;
  remark?: string | null;
};

type ImportedProjectSeed = {
  customerName: string;
  projectName: string;
  projectBelonging?: string | null;
  creditStatus?: string | null;
  currentStatus?: string | null;
  projectStatus?: string | null;
  remark?: string | null;
};

type ImportedReceivableSeed = {
  customerName: string;
  projectName: string;
  projectBelonging?: string | null;
  receivableAmount?: number | null;
  contractReceivable?: number | null;
  receivedAmount?: number | null;
  unpaidAmount?: number | null;
  cumulativeReceivable?: number | null;
  statementDate?: string | null;
  receivedDate?: string | null;
  businessType?: string | null;
  currentStatus?: string | null;
  creditStatus?: string | null;
  timeNode?: string | null;
  remark?: string | null;
  extraFields?: Record<string, unknown> | null;
};

type ImportedRiskSeed = {
  customerName: string;
  projectName?: string | null;
  riskType: string;
  riskLevel: string;
  source?: string | null;
  remark?: string | null;
};

type ImportedLedgerRowSeed = {
  rowOrder: number;
  sourceRowNumber?: number | null;
  statementDate?: string | null;
  quantity?: number | null;
  statementAmount?: number | null;
  contractReceivable?: number | null;
  receivedDate?: string | null;
  receivedAmount?: number | null;
  cumulativeReceivable?: number | null;
  invoiceDate?: string | null;
  invoiceQuantity?: number | null;
  invoiceAmount?: number | null;
  remark?: string | null;
  extraFields?: Record<string, unknown> | null;
};

type ImportedLedgerProfileSeed = {
  sheetName: string;
  workbookSource?: string | null;
  customerName?: string | null;
  projectName?: string | null;
  settlementClause?: string | null;
  sheetData?: Record<string, unknown> | null;
  summary?: {
    contractUnpaidTotal?: number | null;
    uninvoicedTotal?: number | null;
    extraSummary?: Record<string, unknown> | null;
  } | null;
  rows: ImportedLedgerRowSeed[];
};

type ExcelImportPayload = {
  sourceFileName?: string;
  customers: ImportedCustomerSeed[];
  projects: ImportedProjectSeed[];
  receivables: ImportedReceivableSeed[];
  risks: ImportedRiskSeed[];
  ledgerProfiles?: ImportedLedgerProfileSeed[];
};

function buildImportCustomerId(customerName: string) {
  return `IMP-${createHash("sha1").update(customerName).digest("hex").slice(0, 12).toUpperCase()}`;
}

function normalizeImportedCustomerName(value: string | null | undefined) {
  return normalizeCustomerSourceName(value);
}

function fitDbText(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxLength);
}

function toJsonInput(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function toNullableDecimal(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeImportedRiskLevel(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (text === "高风险" || text === "高") return "高";
  if (text === "中风险" || text === "中") return "中";
  return "高";
}

function deriveRisksFromImportedReceivables(receivables: ImportedReceivableSeed[]): ImportedRiskSeed[] {
  const riskMap = new Map<string, ImportedRiskSeed>();

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
      if (currentStatus.includes("停工")) {
        riskType = "经营异常";
      } else if (currentStatus.includes("资金紧张")) {
        riskType = "财务异常";
      } else {
        riskType = "付款逾期";
      }
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

function getBusinessTypePriority(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value);
  if (normalized === "已诉") return 4;
  if (normalized === "待起诉") return 3;
  if (normalized === "老款") return 2;
  if (normalized === "尾款") return 1;
  return 0;
}

function consolidateImportedReceivables(receivables: ImportedReceivableSeed[]) {
  const ledger = new Map<string, ImportedReceivableSeed>();

  for (const row of receivables) {
    const customerName = normalizeImportedCustomerName(row.customerName);
    const projectName = String(row.projectName ?? "").trim();
    if (!customerName || !projectName) {
      continue;
    }

    const key = `${customerName}::${projectName}`;
    const current = ledger.get(key);
    if (!current) {
      ledger.set(key, { ...row, businessType: normalizeBusinessType(row.businessType) });
      continue;
    }

    const currentBusinessType = normalizeBusinessType(current.businessType);
    const nextBusinessType = normalizeBusinessType(row.businessType);
    const preferredBusinessType =
      getBusinessTypePriority(nextBusinessType) >= getBusinessTypePriority(currentBusinessType)
        ? nextBusinessType
        : currentBusinessType;

    ledger.set(key, {
      ...current,
      receivableAmount: Number(current.receivableAmount ?? 0) + Number(row.receivableAmount ?? 0),
      contractReceivable: Number(current.contractReceivable ?? 0) + Number(row.contractReceivable ?? row.receivableAmount ?? 0),
      receivedAmount: Number(current.receivedAmount ?? 0) + Number(row.receivedAmount ?? 0),
      unpaidAmount:
        Number(current.unpaidAmount ?? Math.max(Number(current.receivableAmount ?? 0) - Number(current.receivedAmount ?? 0), 0)) +
        Number(row.unpaidAmount ?? Math.max(Number(row.receivableAmount ?? 0) - Number(row.receivedAmount ?? 0), 0)),
      cumulativeReceivable: Math.max(
        Number(current.cumulativeReceivable ?? 0),
        Number(row.cumulativeReceivable ?? 0),
      ),
      statementDate: current.statementDate || row.statementDate || null,
        receivedDate: row.receivedDate || current.receivedDate || null,
        businessType: preferredBusinessType,
        currentStatus: current.currentStatus || row.currentStatus || null,
        creditStatus: current.creditStatus || row.creditStatus || null,
        projectBelonging: current.projectBelonging || row.projectBelonging || null,
        timeNode: current.timeNode || row.timeNode || null,
        remark: current.remark || row.remark || null,
        extraFields: {
          ...(current.extraFields ?? {}),
          ...(row.extraFields ?? {}),
        },
      });
  }

  return Array.from(ledger.values());
}

export async function importExcelData(payload: ExcelImportPayload) {
  const now = new Date().toISOString();
  const effectiveReceivables = consolidateImportedReceivables(payload.receivables);
  const derivedRisks = deriveRisksFromImportedReceivables(effectiveReceivables);
  const effectiveRisks = payload.risks.length > 0 ? payload.risks : derivedRisks;
  const effectiveLedgerProfiles = payload.ledgerProfiles ?? [];
  const effectiveCustomersMap = new Map<string, ImportedCustomerSeed>();

  for (const seed of payload.customers) {
    const identity = deriveCustomerProjectIdentity({ customerName: seed.customerName });
    const normalizedName = normalizeImportedCustomerName(identity.baseCustomerName);
    if (!normalizedName || isNoiseCustomerName(normalizedName)) continue;
    effectiveCustomersMap.set(normalizedName, {
      ...seed,
      customerName: normalizedName,
    });
  }

  for (const row of effectiveReceivables) {
    const identity = deriveCustomerProjectIdentity({
      customerName: row.customerName,
      unitName: row.customerName,
      projectName: row.projectName,
    });
    const normalizedName = normalizeImportedCustomerName(identity.baseCustomerName);
    if (!normalizedName || isNoiseCustomerName(normalizedName) || isNoiseProjectName(identity.preferredProjectName)) {
      continue;
    }
    const existing = effectiveCustomersMap.get(normalizedName);
    effectiveCustomersMap.set(normalizedName, {
      customerName: normalizedName,
      creditStatus: row.creditStatus ?? existing?.creditStatus ?? null,
      currentStatus: row.currentStatus ?? existing?.currentStatus ?? null,
      remark: row.remark ?? existing?.remark ?? null,
    });
  }

  for (const profile of effectiveLedgerProfiles) {
    const identity = deriveCustomerProjectIdentity({
      customerName: profile.customerName,
      projectName: profile.projectName,
    });
    const normalizedName = normalizeImportedCustomerName(identity.baseCustomerName);
    if (!normalizedName || isNoiseCustomerName(normalizedName)) continue;
    const existing = effectiveCustomersMap.get(normalizedName);
    effectiveCustomersMap.set(normalizedName, {
      customerName: normalizedName,
      creditStatus: existing?.creditStatus ?? null,
      currentStatus: existing?.currentStatus ?? null,
      remark: existing?.remark ?? null,
    });
  }

  const effectiveCustomers = Array.from(effectiveCustomersMap.values());
  const customerSeedsByName = new Map(effectiveCustomers.map((seed) => [seed.customerName, seed] as const));

  if (process.env.DATABASE_URL) {
    try {
      const tx = prisma;
      const customerByName = new Map<string, { id: string; customerId: string; customerCode: string | null }>();
      const projectByKey = new Map<string, { id: string; customerId: string; name: string }>();
      let newCustomers = 0;
      let updatedCustomers = 0;

      for (const seed of effectiveCustomers) {
        const identity = deriveCustomerProjectIdentity({ customerName: seed.customerName });
        const name = normalizeImportedCustomerName(identity.baseCustomerName);
        if (!name || isNoiseCustomerName(name)) continue;
        const existed = await tx.customer.findUnique({
          where: { name },
          select: { id: true },
        });

        const created = await tx.customer.upsert({
          where: { name },
          update: {
            normalizedName: fitDbText(name, 200),
            sourceCustomerName: fitDbText(seed.customerName, 200),
            creditStatus: fitDbText(seed.creditStatus, 100),
            currentStatus: fitDbText(seed.currentStatus, 200),
            creditStanding: fitDbText(seed.creditStatus, 100),
            remark: seed.remark || undefined,
          },
          create: {
            customerId: buildImportCustomerId(name),
            customerCode: null,
            name,
            normalizedName: fitDbText(name, 200),
            sourceCustomerName: fitDbText(seed.customerName, 200),
            creditStatus: fitDbText(seed.creditStatus, 100),
            currentStatus: fitDbText(seed.currentStatus, 200),
            creditStanding: fitDbText(seed.creditStatus, 100),
            remark: seed.remark || null,
          },
          select: {
            id: true,
            customerId: true,
            customerCode: true,
          },
        });

        if (existed) {
          updatedCustomers += 1;
        } else {
          newCustomers += 1;
        }
        customerByName.set(name, created);
      }

      for (const seed of payload.projects) {
        const identity = deriveCustomerProjectIdentity({
          customerName: seed.customerName,
          projectName: seed.projectName,
        });
        const normalizedCustomerName = normalizeImportedCustomerName(identity.baseCustomerName);
        const projectName = identity.preferredProjectName;
        const customer = customerByName.get(normalizedCustomerName);
        if (
          !customer ||
          !projectName ||
          isNoiseCustomerName(normalizedCustomerName) ||
          isNoiseProjectName(projectName)
        ) continue;
        const projectMeta = buildProjectNormalization({
          projectName,
          projectAlias: identity.projectAlias,
        });
        const projectContext = buildProjectContextValues({
          projectName,
          projectAlias: identity.projectAlias,
          sourceCustomerName: seed.customerName,
          seedProjectBelonging: seed.projectBelonging,
          seedCreditStatus: seed.creditStatus,
          seedCurrentStatus: seed.currentStatus,
          customerCreditStatus: customerSeedsByName.get(normalizedCustomerName)?.creditStatus ?? null,
          customerCurrentStatus: customerSeedsByName.get(normalizedCustomerName)?.currentStatus ?? null,
        });
        const projectRemark = seed.remark || undefined;

        const created = await tx.project.upsert({
          where: {
            customerId_name: {
              customerId: customer.id,
              name: projectName,
            },
          },
          update: {
            normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
            projectAlias: fitDbText(identity.projectAlias, 200),
            sourceCustomerName: fitDbText(seed.customerName, 200),
            derivedFromCustomerName: Boolean(identity.projectAlias),
            status: fitDbText(seed.projectStatus, 100) || undefined,
            ...(projectContext.projectBelonging ? { projectBelonging: projectContext.projectBelonging } : {}),
            ...(projectContext.creditStatus ? { creditStatus: projectContext.creditStatus } : {}),
            ...(projectContext.currentStatus ? { currentStatus: projectContext.currentStatus } : {}),
            ...(projectRemark ? { remark: projectRemark } : {}),
          },
          create: {
            customerId: customer.id,
            name: projectName,
            normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
            projectAlias: fitDbText(identity.projectAlias, 200),
            projectBelonging: projectContext.projectBelonging,
            creditStatus: projectContext.creditStatus,
            currentStatus: projectContext.currentStatus,
            sourceCustomerName: fitDbText(seed.customerName, 200),
            derivedFromCustomerName: Boolean(identity.projectAlias),
            status: fitDbText(seed.projectStatus, 100) || "进行中",
            remark: seed.remark || null,
          },
          select: {
            id: true,
            customerId: true,
            name: true,
          },
        });

        projectByKey.set(`${normalizedCustomerName}::${projectName}`, created);
      }

      for (const seed of effectiveReceivables) {
        const identity = deriveCustomerProjectIdentity({
          customerName: seed.customerName,
          unitName: seed.customerName,
          projectName: seed.projectName,
        });
        const normalizedCustomerName = normalizeImportedCustomerName(identity.baseCustomerName);
        const projectName = identity.preferredProjectName;
        const customer = customerByName.get(normalizedCustomerName);
        if (
          !customer ||
          !projectName ||
          isNoiseCustomerName(normalizedCustomerName) ||
          isNoiseProjectName(projectName)
        ) continue;
        const projectMeta = buildProjectNormalization({
          projectName,
          projectAlias: identity.projectAlias,
        });
        const seededCustomer = customerSeedsByName.get(normalizedCustomerName);
        const projectContext = buildProjectContextValues({
          projectName,
          projectAlias: identity.projectAlias,
          sourceCustomerName: seed.customerName,
          seedProjectBelonging: seed.projectBelonging,
          seedCreditStatus: seed.creditStatus,
          seedCurrentStatus: seed.currentStatus,
          customerCreditStatus: seededCustomer?.creditStatus ?? null,
          customerCurrentStatus: seededCustomer?.currentStatus ?? null,
        });

        const project =
          projectByKey.get(`${normalizedCustomerName}::${projectName}`) ??
          (await tx.project.upsert({
            where: {
              customerId_name: {
                customerId: customer.id,
                name: projectName,
              },
            },
            update: {
              normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
              projectAlias: fitDbText(identity.projectAlias, 200),
              sourceCustomerName: fitDbText(seed.customerName, 200),
              derivedFromCustomerName: Boolean(identity.projectAlias),
              ...(projectContext.projectBelonging ? { projectBelonging: projectContext.projectBelonging } : {}),
              ...(projectContext.creditStatus ? { creditStatus: projectContext.creditStatus } : {}),
              ...(projectContext.currentStatus ? { currentStatus: projectContext.currentStatus } : {}),
            },
            create: {
              customerId: customer.id,
              name: projectName,
              normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
              projectAlias: fitDbText(identity.projectAlias, 200),
              projectBelonging: projectContext.projectBelonging,
              creditStatus: projectContext.creditStatus,
              currentStatus: projectContext.currentStatus,
              sourceCustomerName: fitDbText(seed.customerName, 200),
              derivedFromCustomerName: Boolean(identity.projectAlias),
              status: fitDbText(seed.businessType, 100) || "进行中",
              remark: seed.remark || null,
            },
            select: {
              id: true,
              customerId: true,
              name: true,
            },
          }));

        projectByKey.set(`${normalizedCustomerName}::${projectName}`, project);

        const receivableAmount = Number(seed.receivableAmount ?? 0);
        const receivedAmount = Number(seed.receivedAmount ?? 0);
        const existingReceivable = await tx.accountReceivable.findUnique({
          where: {
            customerId_projectId: {
              customerId: customer.id,
              projectId: project.id,
            },
          },
          select: {
            id: true,
            extraFields: true,
          },
        });
        const mergedExtraFields = {
          ...((existingReceivable?.extraFields as Record<string, unknown> | null | undefined) ?? {}),
          ...((seed.extraFields ?? {}) as Record<string, unknown>),
        };
        const extraFieldsInput =
          Object.keys(mergedExtraFields).length > 0
            ? (mergedExtraFields as Prisma.InputJsonValue)
            : undefined;

        await tx.accountReceivable.upsert({
          where: {
            customerId_projectId: {
              customerId: customer.id,
              projectId: project.id,
            },
          },
          update: {
            projectName,
            contractReceivable: Number(seed.contractReceivable ?? receivableAmount),
            cumulativeReceivable: Number(seed.cumulativeReceivable ?? receivableAmount),
            statementDate: seed.statementDate ? new Date(seed.statementDate) : null,
            receivedDate: seed.receivedDate ? new Date(seed.receivedDate) : null,
            businessType: fitDbText(normalizeBusinessType(seed.businessType), 50),
            timeNode: fitDbText(seed.timeNode, 50),
            remark: seed.remark || null,
            extraFields: extraFieldsInput,
            period: seed.statementDate ? seed.statementDate.slice(0, 7) : null,
            baseDate: seed.statementDate ? new Date(seed.statementDate) : null,
            amount: receivableAmount,
            receivedAmount,
            unpaidAmount: Number(seed.unpaidAmount ?? Math.max(receivableAmount - receivedAmount, 0)),
            monthlyReceivedAmount: receivedAmount,
            receivableStatus: receivedAmount >= receivableAmount && receivableAmount > 0 ? "已结清" : "回款中",
            riskStatus:
              normalizeBusinessType(seed.businessType) === "待起诉" ||
              normalizeBusinessType(seed.businessType) === "已诉"
                ? "高风险"
                : "正常",
            isSettled: receivedAmount >= receivableAmount && receivableAmount > 0,
          },
          create: {
            receivableNo: `AR-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            customerId: customer.id,
            projectId: project.id,
            projectName,
            contractReceivable: Number(seed.contractReceivable ?? receivableAmount),
            cumulativeReceivable: Number(seed.cumulativeReceivable ?? receivableAmount),
            statementDate: seed.statementDate ? new Date(seed.statementDate) : null,
            receivedDate: seed.receivedDate ? new Date(seed.receivedDate) : null,
            businessType: fitDbText(normalizeBusinessType(seed.businessType), 50),
            timeNode: fitDbText(seed.timeNode, 50),
            remark: seed.remark || null,
            extraFields: extraFieldsInput,
            period: seed.statementDate ? seed.statementDate.slice(0, 7) : null,
            baseDate: seed.statementDate ? new Date(seed.statementDate) : null,
            amount: receivableAmount,
            receivedAmount,
            unpaidAmount: Number(seed.unpaidAmount ?? Math.max(receivableAmount - receivedAmount, 0)),
            monthlyReceivedAmount: receivedAmount,
            receivableStatus: receivedAmount >= receivableAmount && receivableAmount > 0 ? "已结清" : "回款中",
            riskStatus:
              normalizeBusinessType(seed.businessType) === "待起诉" ||
              normalizeBusinessType(seed.businessType) === "已诉"
                ? "高风险"
                : "正常",
            isSettled: receivedAmount >= receivableAmount && receivableAmount > 0,
          },
        });
      }

      for (const profileSeed of effectiveLedgerProfiles) {
        const identity = deriveCustomerProjectIdentity({
          customerName: profileSeed.customerName,
          projectName: profileSeed.projectName,
        });
        const normalizedCustomerName = normalizeImportedCustomerName(identity.baseCustomerName);
        if (!normalizedCustomerName || isNoiseCustomerName(normalizedCustomerName)) continue;

        let customer = customerByName.get(normalizedCustomerName);
        if (!customer) {
          const createdCustomer = await tx.customer.upsert({
            where: { name: normalizedCustomerName },
            update: {},
            create: {
              customerId: buildImportCustomerId(normalizedCustomerName),
              customerCode: null,
              name: normalizedCustomerName,
              normalizedName: fitDbText(normalizedCustomerName, 200),
              sourceCustomerName: fitDbText(profileSeed.customerName, 200),
            },
            select: {
              id: true,
              customerId: true,
              customerCode: true,
            },
          });
          customer = createdCustomer;
          customerByName.set(normalizedCustomerName, createdCustomer);
        }

        const projectName = identity.preferredProjectName;
        const projectMeta = buildProjectNormalization({
          projectName,
          projectAlias: identity.projectAlias,
        });
        const project =
          projectName.length > 0 && !isNoiseProjectName(projectName)
            ? projectByKey.get(`${normalizedCustomerName}::${projectName}`) ??
              (await tx.project.upsert({
                where: {
                  customerId_name: {
                    customerId: customer.id,
                    name: projectName,
                  },
                },
                update: {
                  normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
                  projectAlias: fitDbText(identity.projectAlias, 200),
                  sourceCustomerName: fitDbText(profileSeed.customerName, 200),
                  derivedFromCustomerName: Boolean(identity.projectAlias),
                },
                create: {
                  customerId: customer.id,
                  name: projectName,
                  normalizedProjectName: fitDbText(projectMeta.normalizedProjectName, 200),
                  projectAlias: fitDbText(identity.projectAlias, 200),
                  sourceCustomerName: fitDbText(profileSeed.customerName, 200),
                  derivedFromCustomerName: Boolean(identity.projectAlias),
                  status: "进行中",
                },
                select: {
                  id: true,
                  customerId: true,
                  name: true,
                },
              }))
            : null;

        if (project) {
          projectByKey.set(`${normalizedCustomerName}::${projectName}`, project);
        }

        const profile = await tx.customerLedgerProfile.upsert({
          where: {
            customerId_sheetName: {
              customerId: customer.id,
              sheetName: profileSeed.sheetName,
            },
          },
          update: {
            projectId: project?.id ?? null,
            workbookSource: fitDbText(payload.sourceFileName ?? profileSeed.workbookSource, 255),
            customerName: normalizedCustomerName,
            projectName: fitDbText(projectName, 200),
            settlementClause: profileSeed.settlementClause || null,
            contractUnpaidTotal: toNullableDecimal(profileSeed.summary?.contractUnpaidTotal),
            uninvoicedTotal: toNullableDecimal(profileSeed.summary?.uninvoicedTotal),
            extraSummary: profileSeed.summary?.extraSummary
              ? toJsonInput(profileSeed.summary.extraSummary)
              : undefined,
            sheetDataJson: profileSeed.sheetData ? toJsonInput(profileSeed.sheetData) : undefined,
          },
          create: {
            customerId: customer.id,
            projectId: project?.id ?? null,
            sheetName: profileSeed.sheetName,
            workbookSource: fitDbText(payload.sourceFileName ?? profileSeed.workbookSource, 255),
            customerName: normalizedCustomerName,
            projectName: fitDbText(projectName, 200),
            settlementClause: profileSeed.settlementClause || null,
            contractUnpaidTotal: toNullableDecimal(profileSeed.summary?.contractUnpaidTotal),
            uninvoicedTotal: toNullableDecimal(profileSeed.summary?.uninvoicedTotal),
            extraSummary: profileSeed.summary?.extraSummary
              ? toJsonInput(profileSeed.summary.extraSummary)
              : undefined,
            sheetDataJson: profileSeed.sheetData ? toJsonInput(profileSeed.sheetData) : undefined,
          },
          select: {
            id: true,
          },
        });

        await tx.customerLedgerRow.deleteMany({
          where: { profileId: profile.id },
        });

        if (profileSeed.rows.length > 0) {
          await tx.customerLedgerRow.createMany({
            data: profileSeed.rows.map((row) => ({
              profileId: profile.id,
              rowOrder: row.rowOrder,
              statementDate: row.statementDate || null,
              quantity: toNullableDecimal(row.quantity),
              statementAmount: toNullableDecimal(row.statementAmount),
              contractReceivable: toNullableDecimal(row.contractReceivable),
              receivedDate: row.receivedDate || null,
              receivedAmount: toNullableDecimal(row.receivedAmount),
              cumulativeReceivable: toNullableDecimal(row.cumulativeReceivable),
              invoiceDate: row.invoiceDate || null,
              invoiceQuantity: toNullableDecimal(row.invoiceQuantity),
              invoiceAmount: toNullableDecimal(row.invoiceAmount),
              remark: row.remark || null,
              extraFields: row.extraFields ? toJsonInput(row.extraFields) : undefined,
            })),
          });
        }
      }

      for (const seed of effectiveRisks) {
        const identity = deriveCustomerProjectIdentity({
          customerName: seed.customerName,
          projectName: seed.projectName,
        });
        const normalizedCustomerName = normalizeImportedCustomerName(identity.baseCustomerName);
        const customer = customerByName.get(normalizedCustomerName);
        if (!customer) continue;
        const projectName = identity.preferredProjectName;
        const project = projectName
          ? projectByKey.get(`${normalizedCustomerName}::${projectName}`) ?? null
          : null;
        const riskType = seed.riskType === "待起诉" ? "诉讼" : seed.riskType;
        const source = riskSourceToDb("Excel导入");
        const existingRisk = await tx.riskRecord.findFirst({
          where: {
            customerId: customer.id,
            projectId: project?.id ?? undefined,
            riskType,
            source: source as never,
          },
          select: { id: true },
        });

        if (existingRisk) {
          await tx.riskRecord.update({
            where: { id: existingRisk.id },
            data: {
              title: riskType,
              description: seed.remark || undefined,
              remark: seed.remark || undefined,
              status: "open",
              handled: false,
            },
          });
          continue;
        }

        await tx.riskRecord.create({
          data: {
            customerId: customer.id,
            projectId: project?.id ?? null,
            riskCode: null,
            riskType,
            riskLevel: riskLevelToDb(normalizeImportedRiskLevel(seed.riskLevel)) as never,
            source: source as never,
            title: riskType,
            description: seed.remark || null,
            remark: seed.remark || null,
            handled: false,
            status: "open",
          },
        });
      }

      const dbSummary = {
        customers: effectiveCustomers.length,
        projects: payload.projects.length,
        receivables: effectiveReceivables.length,
        risks: effectiveRisks.length,
        ledgerProfiles: effectiveLedgerProfiles.length,
        customerCount: await tx.customer.count(),
        projectCount: await tx.project.count(),
        receivableCount: await tx.accountReceivable.count(),
        riskCount: await tx.riskRecord.count(),
        newCustomers,
        updatedCustomers,
      };

      return dbSummary;
    } catch (error) {
      console.error("[importExcelData] database import failed", error);
      // Fall through to development dataset mode if the database is not ready.
    }
  }

  const customersByName = new Map(memoryStore.customers.map((item) => [item.name, item]));
  const importedCustomers: CustomerRecord[] = [];

  for (const seed of effectiveCustomers) {
    const name = normalizeImportedCustomerName(seed.customerName);
    if (!name) continue;

    const existing = customersByName.get(name);
    const customerPayload: CustomerPayload = {
      customerId: existing?.customerId ?? buildImportCustomerId(name),
      customerCode: existing?.customerCode ?? "",
      name,
      creditStatus: seed.creditStatus ?? existing?.creditStatus ?? existing?.creditStanding ?? "",
      currentStatus: seed.currentStatus ?? existing?.currentStatus ?? "",
      customerNature: existing?.customerNature ?? "",
      hasGuarantee: existing?.hasGuarantee ?? false,
      creditStanding: seed.creditStatus ?? existing?.creditStanding ?? "",
      dueDiligenceCompleted: existing?.dueDiligenceCompleted ?? false,
      unifiedSocialCreditCode: existing?.unifiedSocialCreditCode ?? "",
      industry: existing?.industry ?? "",
      contactName: existing?.contactName ?? "",
      contactPhone: existing?.contactPhone ?? "",
      salesOwnerName: existing?.salesOwnerName ?? "",
      currentCreditLevel: existing?.currentCreditLevel ?? "",
      creditScore: existing?.creditScore ?? null,
      creditLevel: existing?.creditLevel ?? existing?.currentCreditLevel ?? "",
      riskAction: existing?.riskAction ?? "常规跟进",
      riskStatus: existing?.riskStatus ?? "正常",
      scoreDelta: existing?.scoreDelta ?? null,
      creditLimit: existing?.creditLimit ?? null,
      stopSupply: existing?.stopSupply ?? false,
      remark: seed.remark ?? existing?.remark ?? "",
      riskRemark: existing?.riskRemark ?? "",
    };

    const record = buildCustomerRecord(customerPayload, existing);
    const normalized = normalizeCustomer(record);
    customersByName.set(name, normalized);
    importedCustomers.push(normalized);
  }

  memoryStore.customers = attachCustomerCodes(Array.from(customersByName.values())).map(normalizeCustomer);

  const customerIdByName = new Map(memoryStore.customers.map((item) => [item.name, item.customerId]));
  const customerCodeByName = new Map(memoryStore.customers.map((item) => [item.name, item.customerCode]));
  const customerOwnerByName = new Map(memoryStore.customers.map((item) => [item.name, item.salesOwnerName ?? ""]));

  const contractMap = new Map(
    memoryStore.contracts.map((item) => [`${item.customerId}::${item.projectName}`, item]),
  );

  for (const project of payload.projects) {
    const normalizedCustomerName = normalizeImportedCustomerName(project.customerName);
    const projectName = String(project.projectName ?? "").trim();
    const customerId = customerIdByName.get(normalizedCustomerName);
    if (!customerId || !projectName) continue;
    const key = `${customerId}::${projectName}`;
    const existing = contractMap.get(key);
    const next: ContractRecord = normalizeContract({
      id: existing?.id ?? `contract-import-${Date.now()}-${contractMap.size}`,
      contractId: existing?.contractId ?? `PJ-${Date.now()}-${contractMap.size}`,
      customerId,
      customerCode: customerCodeByName.get(normalizedCustomerName) ?? "",
      customerName: normalizedCustomerName,
      projectName,
      contractNo: existing?.contractNo ?? "",
      amount: existing?.amount ?? 0,
      signedAt: existing?.signedAt ?? null,
      billingPeriodDays: existing?.billingPeriodDays ?? null,
      salesOwnerName: existing?.salesOwnerName ?? customerOwnerByName.get(normalizedCustomerName) ?? "",
      projectStatus: project.projectStatus ?? existing?.projectStatus ?? "进行中",
      remark: project.remark ?? existing?.remark ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    contractMap.set(key, next);
  }

  memoryStore.contracts = Array.from(contractMap.values());

  const receivableMap = new Map(
    memoryStore.receivables.map((item) => [
      `${item.customerId}::${item.projectName}`,
      item,
    ]),
  );

  for (const row of effectiveReceivables) {
    const normalizedCustomerName = normalizeImportedCustomerName(row.customerName);
    const customerId = customerIdByName.get(normalizedCustomerName);
    if (!customerId || !row.projectName) continue;
    const statementDate = row.statementDate ?? null;
    const period = statementDate ? statementDate.slice(0, 7) : "";
    const key = `${customerId}::${row.projectName}`;
    const existing = receivableMap.get(key);
    const amount = Number(row.receivableAmount ?? 0);
    const receivedAmount = Number(row.receivedAmount ?? 0);

    const payloadRecord: ReceivablePayload = {
      customerId,
      projectName: row.projectName,
      contractReceivable: Number(row.contractReceivable ?? amount),
      cumulativeReceivable: Number(row.cumulativeReceivable ?? amount),
      statementDate,
      businessType: normalizeBusinessType(row.businessType),
      timeNode: row.timeNode ?? period,
      remark: row.remark ?? "",
      extraFields: row.extraFields ?? null,
      period,
      paymentTerm: existing?.paymentTerm ?? null,
      baseDate: existing?.baseDate ?? statementDate,
      amount,
      receivedAmount,
      monthlyReceivedAmount: receivedAmount,
      salesOwnerName: existing?.salesOwnerName ?? customerOwnerByName.get(normalizedCustomerName) ?? "",
      billingPeriodDays: existing?.billingPeriodDays ?? null,
      dueDate: existing?.dueDate ?? null,
      receivedDate: row.receivedDate ?? null,
      overdueDays: existing?.overdueDays ?? null,
      agingBucket: existing?.agingBucket ?? null,
      riskStatus:
        normalizeBusinessType(row.businessType) === "待起诉" || normalizeBusinessType(row.businessType) === "已诉"
          ? "高风险"
          : existing?.riskStatus ?? "正常",
      receivableStatus: receivedAmount >= amount && amount > 0 ? "已结清" : existing?.receivableStatus ?? "回款中",
    };

    const next = normalizeReceivable(
      buildReceivableRecord(payloadRecord, normalizedCustomerName, existing),
    );
    receivableMap.set(key, next);
  }

  memoryStore.receivables = Array.from(receivableMap.values());

  const riskMap = new Map(
    memoryStore.risks.map((item) => [`${item.customerId}::${item.riskType}::${item.riskTime}`, item]),
  );

  for (const row of effectiveRisks) {
    const normalizedCustomerName = normalizeImportedCustomerName(row.customerName);
    const customerId = customerIdByName.get(normalizedCustomerName);
    if (!customerId) continue;
    const riskTime = new Date().toISOString().slice(0, 10);
    const key = `${customerId}::${row.riskType}::${riskTime}`;
    const existing = riskMap.get(key);
    const next = normalizeRisk({
      id: existing?.id ?? `risk-import-${Date.now()}-${riskMap.size}`,
      customerId,
      customerCode: customerCodeByName.get(normalizedCustomerName) ?? "",
      customerName: normalizedCustomerName,
      riskType: (row.riskType === "待起诉" ? "诉讼" : row.riskType) as RiskRecordItem["riskType"],
      riskTime,
      riskSource: "Excel导入",
      riskLevel: normalizeImportedRiskLevel(row.riskLevel) as RiskRecordItem["riskLevel"],
      handled: false,
      handlingAction: "",
      followUpRecord: "",
      riskStatus: "待处理",
      remark: [row.projectName, row.remark].filter(Boolean).join(" / "),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    riskMap.set(key, next);
  }

  memoryStore.risks = Array.from(riskMap.values());

  return {
    customers: effectiveCustomers.length,
    projects: payload.projects.length,
    receivables: effectiveReceivables.length,
    risks: effectiveRisks.length,
    ledgerProfiles: effectiveLedgerProfiles.length,
    customerCount: memoryStore.customers.length,
    projectCount: memoryStore.contracts.length,
    receivableCount: memoryStore.receivables.length,
    riskCount: memoryStore.risks.length,
    newCustomers: effectiveCustomers.length,
    updatedCustomers: 0,
  };
}

export async function enrichImportedProjectContext(projects: ImportedProjectSeed[]) {
  if (!process.env.DATABASE_URL || projects.length === 0) {
    return { updatedProjects: 0 };
  }

  let updatedProjects = 0;

  for (const seed of projects) {
    const identity = deriveCustomerProjectIdentity({
      customerName: seed.customerName,
      projectName: seed.projectName,
    });
    const normalizedCustomerName = normalizeImportedCustomerName(identity.baseCustomerName);
    const projectName = identity.preferredProjectName;
    if (!normalizedCustomerName || !projectName) continue;

    const customer = await prisma.customer.findUnique({
      where: { name: normalizedCustomerName },
      select: { id: true, creditStatus: true, creditStanding: true, currentStatus: true },
    });
    if (!customer) continue;

    const projectContext = buildProjectContextValues({
      projectName,
      projectAlias: identity.projectAlias,
      sourceCustomerName: seed.customerName,
      seedProjectBelonging: seed.projectBelonging,
      seedCreditStatus: seed.creditStatus,
      seedCurrentStatus: seed.currentStatus,
      customerCreditStatus: customer.creditStatus,
      customerCreditStanding: customer.creditStanding,
      customerCurrentStatus: customer.currentStatus,
    });
    const remark = seed.remark || null;

    if (!projectContext.projectBelonging && !projectContext.creditStatus && !projectContext.currentStatus && !remark) {
      continue;
    }

    await prisma.project.updateMany({
      where: {
        customerId: customer.id,
        name: projectName,
      },
      data: {
        ...(projectContext.projectBelonging ? { projectBelonging: projectContext.projectBelonging } : {}),
        ...(projectContext.creditStatus ? { creditStatus: projectContext.creditStatus } : {}),
        ...(projectContext.currentStatus ? { currentStatus: projectContext.currentStatus } : {}),
        ...(remark ? { remark } : {}),
      },
    });

    updatedProjects += 1;
  }

  return { updatedProjects };
}

type ImportLogPayload = {
  fileName: string;
  totalCount?: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
  errors?: Array<{
    rowRef?: string | null;
    message: string;
    rawPayload?: unknown;
  }>;
};

export async function createImportLog(payload: ImportLogPayload) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const runtimeClient = prisma as unknown as {
      importLog: {
        create: (args: {
          data: {
            fileName: string;
            totalCount: number;
            successCount: number;
            failureCount: number;
            errorMessage: string | null;
            source: string;
            errors?:
              | {
                  create: Array<{
                    rowRef: string | null;
                    message: string;
                    rawPayload?: unknown;
                  }>;
                }
              | undefined;
          };
        }) => Promise<unknown>;
      };
    };

    return await runtimeClient.importLog.create({
      data: {
        fileName: payload.fileName,
        totalCount: payload.totalCount ?? payload.successCount + payload.failureCount,
        successCount: payload.successCount,
        failureCount: payload.failureCount,
        errorMessage: payload.errorMessage || null,
        source: "Excel导入",
        errors:
          payload.errors && payload.errors.length > 0
            ? {
                create: payload.errors.map((item) => ({
                  rowRef: item.rowRef || null,
                  message: item.message,
                  rawPayload: item.rawPayload,
                })),
              }
            : undefined,
      },
    });
  } catch (error) {
    console.error("[createImportLog] failed", error);
    return null;
  }
}

export async function getDashboardOverview(): Promise<DashboardOverviewData> {
  const [customers, receivables, highRiskCustomers, keyAttentionCustomers, risks, scores] = await Promise.all([
    listCustomers(),
    listReceivables(),
    listHighRiskCustomers(),
    listKeyAttentionCustomers(),
    listRisks(),
    listCreditScores(),
  ]);

  const overview = buildRuleAwareDashboardOverview(customers, receivables);
  const litigationCustomers = new Set(
    risks.filter((item) => item.riskType === "诉讼").map((item) => item.customerId),
  ).size;
  const scoreDownCustomers = new Set(
    scores.filter((item) => (item.scoreDelta ?? 0) < 0).map((item) => item.customerId),
  ).size;

  return {
    ...overview,
    stats: overview.stats.map((item) => {
      if (item.label === "高风险客户数") {
        return { ...item, value: String(highRiskCustomers.length) };
      }
      if (item.label === "重点关注客户数") {
        return { ...item, value: String(keyAttentionCustomers.length) };
      }
      if (item.label === "诉讼客户数") {
        return { ...item, value: String(litigationCustomers) };
      }
      if (item.label === "评分下降客户") {
        return { ...item, value: String(scoreDownCustomers) };
      }
      return item;
    }),
    focusSummary: {
      ...overview.focusSummary,
      highRiskCustomers: highRiskCustomers.length,
      keyAttentionCustomers: keyAttentionCustomers.length,
      litigationCustomers,
      scoreDownCustomers,
    },
  };
}

function buildHighRiskReasons(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string[] {
  const reasons: string[] = [];
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );
  const overduePeriods = customerReceivables.filter((item) => (item.overdueDays ?? 0) > 0).length;

  // High-risk customer logic:
  // First version uses currently available data only and stays tolerant of missing fields.
  if (customerRisks.some((item) => item.riskType === "诉讼")) {
    reasons.push("存在诉讼记录");
  }
  if (customerRisks.some((item) => !item.handled)) {
    reasons.push("存在未处理风险记录");
  }
  if (maxOverdueDays > 60) {
    reasons.push(`最长逾期 ${maxOverdueDays} 天`);
  } else if (maxOverdueDays > 30) {
    reasons.push(`存在逾期超过 30 天的期间账款`);
  }
  if (overduePeriods > 0) {
    reasons.push(`共有 ${overduePeriods} 个期间账款已逾期`);
  }
  if (customer.keyAttentionCustomer) {
    reasons.push("被标记为重点关注");
  }
  if (customerRisks.some((item) => item.riskLevel === "重大")) {
    reasons.push("存在重大风险记录");
  }

  return Array.from(new Set(reasons));
}

function buildHighRiskLevel(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): "高" | "重大" {
  if (
    customerReceivables.some((item) => (item.overdueDays ?? 0) > 60) ||
    customerRisks.some((item) => item.riskLevel === "重大" || item.riskType === "失信被执行人")
  ) {
    return "重大";
  }

  return "高";
}

function buildRiskTags(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string[] {
  const tags: string[] = [];
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );

  // Risk tag logic:
  // Tags are derived from the same high-risk judgment inputs for concise UI display.
  if (customerRisks.some((item) => item.riskType === "诉讼")) {
    tags.push("诉讼风险");
  }
  if (maxOverdueDays > 60) {
    tags.push("严重逾期");
  } else if (maxOverdueDays > 30) {
    tags.push("逾期风险");
  }
  if (customerRisks.some((item) => !item.handled)) {
    tags.push("未闭环风险");
  }
  if (customer.keyAttentionCustomer) {
    tags.push("重点关注");
  }

  return Array.from(new Set(tags));
}

function buildManagementHighRiskSummary(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string {
  // Management summary:
  // Short, conclusion-oriented wording for dashboard, modal, detail page and leadership reporting.
  const hasLawsuit = customerRisks.some((item) => item.riskType === "诉讼");
  const hasUnhandledRisk = customerRisks.some((item) => !item.handled);
  const hasMajorRisk = customerRisks.some((item) => item.riskLevel === "重大");
  const overduePeriods = customerReceivables.filter((item) => (item.overdueDays ?? 0) > 0);
  const maxOverdueDays = overduePeriods.reduce((max, item) => Math.max(max, item.overdueDays ?? 0), 0);
  const isKeyAttention = Boolean(customer.keyAttentionCustomer);

  if (hasMajorRisk && hasLawsuit) {
    return "该客户已出现重大风险并伴随诉讼事项，整体风险暴露较高，建议列入重点管控名单并持续跟踪处置进展。";
  }

  if (hasLawsuit && hasUnhandledRisk) {
    return "该客户目前存在诉讼事项，且仍有风险未完成处置，建议管理层重点关注后续回款和法律进展。";
  }

  if (maxOverdueDays > 60) {
    return `该客户已有期间账款逾期超过60天，且未完全结清，建议管理层优先关注回款覆盖和后续合作风险。`;
  }

  if (maxOverdueDays > 30) {
    return `该客户当前存在超过30天的逾期期间账款，建议尽快明确回款计划并持续跟踪执行情况。`;
  }

  if (isKeyAttention) {
    return "该客户已被纳入重点关注范围，建议结合现有应收、风险和业务合作情况，持续跟进变化。";
  }

  if (hasUnhandledRisk) {
    return "该客户存在尚未闭环的风险事项，建议继续跟踪处理进度，并评估对回款和合作的影响。";
  }

  if (overduePeriods.length > 0) {
    return `该客户当前共有 ${overduePeriods.length} 个期间账款已逾期，建议管理层持续关注回款进度和后续到期压力。`;
  }

  return "该客户已被系统识别为高风险对象，建议结合应收、风险事件和回款情况做进一步复核。";
}

function buildCollectionHighRiskSummary(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string {
  // Collection summary:
  // Same judgment logic, but expressed as concrete follow-up guidance for business/finance teams.
  const hasLawsuit = customerRisks.some((item) => item.riskType === "诉讼");
  const hasUnhandledRisk = customerRisks.some((item) => !item.handled);
  const hasMajorRisk = customerRisks.some((item) => item.riskLevel === "重大");
  const overduePeriods = customerReceivables.filter((item) => (item.overdueDays ?? 0) > 0);
  const maxOverdueDays = overduePeriods.reduce((max, item) => Math.max(max, item.overdueDays ?? 0), 0);

  if (hasLawsuit) {
    return "建议优先核实诉讼进展和当前回款安排，必要时与法务、业务同步制定回收方案。";
  }
  if (hasMajorRisk && hasUnhandledRisk) {
    return "建议尽快完成风险事项闭环，明确责任人、时间节点和下一步跟进动作。";
  }
  if (maxOverdueDays > 60) {
    return "建议优先处理逾期超过60天的期间账款，按先进先出原则确认回款覆盖顺序，并同步业务与法务跟进。";
  }
  if (maxOverdueDays > 30) {
    return "建议尽快跟进超过30天的逾期期间账款，明确最近回款节点，并滚动更新未结清清单。";
  }
  if (hasUnhandledRisk) {
    return "建议逐项清理未闭环风险，明确处理进度，并评估是否影响后续合作与回款。";
  }
  if (overduePeriods.length > 0) {
    return "建议围绕已逾期期间账款制定专项跟进计划，优先覆盖最早到期且未结清的账款。";
  }

  return "建议结合客户应收、风险事件和内部跟进记录，尽快形成下一步催收与复核安排。";
}

function toHighRiskRecord(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): HighRiskCustomerRecord {
  const highRiskReasons = buildHighRiskReasons(customer, customerRisks, customerReceivables);
  const riskTags = buildRiskTags(customer, customerRisks, customerReceivables);

  return {
    customerId: customer.customerId,
    customerCode: customer.customerCode || customer.customerId,
    customerName: customer.name,
    currentCreditLevel: customer.currentCreditLevel || "待评定",
    receivableBalance: customer.receivableBalance ?? 0,
    riskLevel: buildHighRiskLevel(customer, customerRisks, customerReceivables),
    managementSummary: buildManagementHighRiskSummary(customer, customerRisks, customerReceivables),
    collectionSummary: buildCollectionHighRiskSummary(customer, customerRisks, customerReceivables),
    riskTags,
    // Remark field source:
    // Prefer dedicated riskRemark; fall back to existing customer remark for compatibility.
    riskRemark: customer.riskRemark || customer.remark || "暂无备注",
    keyAttention: Boolean(customer.keyAttentionCustomer),
    salesOwnerName: customer.salesOwnerName || "待分配",
    highRiskReasons,
  };
}

export async function listHighRiskCustomers(
  filters: HighRiskCustomerFilters = {},
): Promise<HighRiskCustomerRecord[]> {
  const [customers, risks, receivables] = await Promise.all([listCustomers(), listRisks(), listReceivables()]);

  return customers
    .filter((item) => item.highRiskCustomer)
    .map((customer) =>
      toHighRiskRecord(
        customer,
        risks
          .filter((risk) => risk.customerId === customer.customerId)
          .map((risk) => ({
            riskType: risk.riskType,
            riskLevel: risk.riskLevel,
            handled: risk.handled,
          })),
        receivables.filter((record) => record.customerId === customer.customerId),
      ),
    )
    .filter((item) => {
      const keywordMatch = containsKeyword(filters.keyword ?? "", [
        item.customerCode,
        item.customerName,
        item.salesOwnerName,
        item.managementSummary,
        item.collectionSummary,
        item.riskRemark,
      ]);
      const levelMatch = !filters.riskLevel || item.riskLevel === filters.riskLevel;
      const ownerMatch = !filters.salesOwnerName || item.salesOwnerName === filters.salesOwnerName;

      return keywordMatch && levelMatch && ownerMatch;
    })
    .sort((left, right) => right.receivableBalance - left.receivableBalance);
}

export async function getHighRiskCustomerById(customerId: string) {
  const items = await listHighRiskCustomers();
  return items.find((item) => item.customerId === customerId || item.customerCode === customerId) ?? null;
}

function buildKeyAttentionReasons(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string[] {
  const reasons: string[] = [];
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );

  // Key-attention logic:
  // First version focuses on "continuous attention and early intervention" and stays tolerant of incomplete data.
  if (customer.keyAttentionCustomer) {
    reasons.push("已被标记为重点关注");
  }
  if (!customer.highRiskCustomer && customerRisks.length > 0) {
    reasons.push("存在风险事件，需持续跟进");
  }
  if (!customer.highRiskCustomer && maxOverdueDays > 0 && maxOverdueDays <= 30) {
    reasons.push("存在轻微逾期，建议提前干预");
  }
  if (!customer.highRiskCustomer && maxOverdueDays > 30 && maxOverdueDays <= 60) {
    reasons.push("存在中度逾期，需持续跟进");
  }
  if (!customer.highRiskCustomer && customerRisks.some((item) => !item.handled)) {
    reasons.push("存在未闭环风险事项");
  }
  if ((customer.receivableBalance ?? 0) >= 500_000) {
    reasons.push("当前应收余额较高");
  }

  return Array.from(new Set(reasons));
}

function buildKeyAttentionLevel(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): "持续关注" | "重点跟进" {
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );
  if (
    customer.keyAttentionCustomer ||
    customerRisks.some((item) => !item.handled) ||
    maxOverdueDays > 30 ||
    (customer.receivableBalance ?? 0) >= 1_000_000
  ) {
    return "重点跟进";
  }

  return "持续关注";
}

function buildAttentionTags(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string[] {
  const tags: string[] = [];
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );

  // Attention tag logic:
  // Use softer wording than high risk and emphasize continuous follow-up and early intervention.
  if (customer.keyAttentionCustomer) {
    tags.push("持续关注");
  }
  if (!customer.highRiskCustomer && customerRisks.length > 0) {
    tags.push("风险苗头");
  }
  if (maxOverdueDays > 30) {
    tags.push("中度逾期");
  } else if (maxOverdueDays > 0) {
    tags.push("轻微逾期");
  }
  if ((customer.receivableBalance ?? 0) >= 500_000) {
    tags.push("回款关注");
  }
  if (customerRisks.some((item) => !item.handled)) {
    tags.push("待跟进事项");
  }
  return Array.from(new Set(tags));
}

function buildManagementKeyAttentionSummary(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string {
  // Management summary logic:
  // Concise leadership-facing wording that focuses on "keep watching and intervene early".
  const hasUnhandledRisk = customerRisks.some((item) => !item.handled);
  const hasRiskEvent = customerRisks.length > 0;
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );
  const hasHighBalance = (customer.receivableBalance ?? 0) >= 500_000;
  if (customer.keyAttentionCustomer && hasUnhandledRisk) {
    return "该客户已纳入重点关注范围，且仍有事项未完成闭环，建议保持管理层跟踪并提前干预。";
  }

  if (hasRiskEvent && hasHighBalance) {
    return "该客户已出现风险苗头，且当前应收余额较高，建议持续关注回款节奏并提前研判变化。";
  }

  if (maxOverdueDays > 30 && hasHighBalance) {
    return "该客户已出现中度逾期，且当前未收余额不低，建议保持管理层跟踪并提前推动回款安排。";
  }

  if (maxOverdueDays > 0) {
    return "该客户已出现轻微逾期，建议持续跟踪期间回款覆盖情况，防止风险继续累积。";
  }

  if (hasUnhandledRisk) {
    return "该客户存在待持续跟进的风险事项，建议明确责任人和跟进节奏，防止风险进一步累积。";
  }

  if (hasHighBalance) {
    return "该客户当前应收余额较高，建议纳入持续关注名单，提前做好回款安排和节奏管理。";
  }

  return "该客户目前未达到高风险层级，但已出现需要持续关注的信号，建议保持跟进并提前干预。";
}

function buildCollectionKeyAttentionSummary(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): string {
  // Collection summary logic:
  // Same judgment inputs, but expressed as concrete next steps for business/finance execution teams.
  const hasUnhandledRisk = customerRisks.some((item) => !item.handled);
  const hasRiskEvent = customerRisks.length > 0;
  const maxOverdueDays = customerReceivables.reduce(
    (max, item) => Math.max(max, item.overdueDays ?? 0),
    0,
  );
  const hasHighBalance = (customer.receivableBalance ?? 0) >= 500_000;
  if (customer.keyAttentionCustomer && hasUnhandledRisk) {
    return "建议按周跟进未闭环事项，补齐处理进度，并同步更新业务和财务的后续安排。";
  }

  if (hasRiskEvent && hasHighBalance) {
    return "建议围绕大额应收制定跟进计划，先确认回款节点，再持续跟踪风险事项变化。";
  }

  if (maxOverdueDays > 30 && hasHighBalance) {
    return "建议优先跟进已逾期期间账款，按先进先出原则确认本次回款覆盖范围，并同步客户下一笔回款计划。";
  }

  if (maxOverdueDays > 0) {
    return "建议持续跟踪轻微逾期期间账款，优先覆盖最早到期但未结清的记录。";
  }

  if (hasUnhandledRisk) {
    return "建议逐项推进待处理事项，明确责任人与时间节点，并持续回看执行结果。";
  }

  if (hasHighBalance) {
    return "建议对大额应收客户保持滚动跟踪，提前确认下一笔回款计划。";
  }

  return "建议维持常态化跟进频率，结合业务往来和回款表现，及时调整后续关注动作。";
}

function toKeyAttentionRecord(
  customer: CustomerRecord,
  customerRisks: Array<{ riskType: string; riskLevel: string; handled: boolean }>,
  customerReceivables: ReceivableRecord[],
): KeyAttentionCustomerRecord {
  const attentionReasons = buildKeyAttentionReasons(customer, customerRisks, customerReceivables);

  return {
    customerId: customer.customerId,
    customerCode: customer.customerCode || customer.customerId,
    customerName: customer.name,
    currentCreditLevel: customer.currentCreditLevel || "待评定",
    receivableBalance: customer.receivableBalance ?? 0,
    attentionLevel: buildKeyAttentionLevel(customer, customerRisks, customerReceivables),
    attentionTags: buildAttentionTags(customer, customerRisks, customerReceivables),
    managementSummary: buildManagementKeyAttentionSummary(customer, customerRisks, customerReceivables),
    collectionSummary: buildCollectionKeyAttentionSummary(customer, customerRisks, customerReceivables),
    // Remark field source:
    // Prefer dedicated riskRemark; fall back to existing customer remark for compatibility.
    riskRemark: customer.riskRemark || customer.remark || "暂无备注",
    keyAttention: Boolean(customer.keyAttentionCustomer),
    salesOwnerName: customer.salesOwnerName || "待分配",
    attentionReasons,
  };
}

export async function listKeyAttentionCustomers(
  filters: KeyAttentionCustomerFilters = {},
): Promise<KeyAttentionCustomerRecord[]> {
  const [customers, risks, receivables] = await Promise.all([listCustomers(), listRisks(), listReceivables()]);

  return customers
    .filter((customer) => {
      const customerRisks = risks.filter((risk) => risk.customerId === customer.customerId);
      return buildKeyAttentionReasons(
        customer,
        customerRisks.map((risk) => ({
          riskType: risk.riskType,
          riskLevel: risk.riskLevel,
          handled: risk.handled,
        })),
        receivables.filter((record) => record.customerId === customer.customerId),
      ).length > 0;
    })
    .map((customer) =>
      toKeyAttentionRecord(
        customer,
        risks
          .filter((risk) => risk.customerId === customer.customerId)
          .map((risk) => ({
            riskType: risk.riskType,
            riskLevel: risk.riskLevel,
            handled: risk.handled,
          })),
        receivables.filter((record) => record.customerId === customer.customerId),
      ),
    )
    .filter((item) => {
      const keywordMatch = containsKeyword(filters.keyword ?? "", [
        item.customerCode,
        item.customerName,
        item.salesOwnerName,
        item.managementSummary,
        item.collectionSummary,
        item.riskRemark,
      ]);
      const levelMatch = !filters.attentionLevel || item.attentionLevel === filters.attentionLevel;
      const ownerMatch = !filters.salesOwnerName || item.salesOwnerName === filters.salesOwnerName;

      return keywordMatch && levelMatch && ownerMatch;
    })
    .sort((left, right) => right.receivableBalance - left.receivableBalance);
}

export async function getKeyAttentionCustomerById(customerId: string) {
  const items = await listKeyAttentionCustomers();
  return items.find((item) => item.customerId === customerId || item.customerCode === customerId) ?? null;
}

export async function listContracts(filters: ContractFilters = {}) {
  try {
    const rows = await prisma.contract.findMany({
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
    });

    return rows
      .map((item) =>
        normalizeContract({
          id: item.id,
          contractId: item.contractBusinessId ?? item.id,
          customerId: item.customer.customerId,
          customerCode: item.customer.customerCode ?? "",
          customerName: item.customer.name,
          projectName: item.title,
          contractNo: item.contractNo,
          amount: Number(item.amount ?? 0),
          signedAt: item.signedAt?.toISOString().slice(0, 10) ?? null,
          billingPeriodDays: item.billingPeriodDays ?? null,
          salesOwnerName: item.salesOwnerName ?? "",
          projectStatus: contractStatusFromDb(item.contractStatus),
          remark: item.remark ?? "",
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }),
      )
      .filter((item) =>
        containsKeyword(filters.keyword ?? "", [
          item.contractId,
          item.customerCode,
          item.customerId,
          item.customerName,
          item.projectName,
          item.contractNo,
          item.salesOwnerName,
        ]) &&
        (!filters.customerId || item.customerId === filters.customerId) &&
        (!filters.projectStatus || item.projectStatus === filters.projectStatus),
      );
  } catch {
    return memoryStore.contracts.filter(
      (item) =>
        containsKeyword(filters.keyword ?? "", [
          item.contractId,
          item.customerCode,
          item.customerId,
          item.customerName,
          item.projectName,
          item.contractNo,
          item.salesOwnerName,
        ]) &&
        (!filters.customerId || item.customerId === filters.customerId) &&
        (!filters.projectStatus || item.projectStatus === filters.projectStatus),
    );
  }
}

export async function getContractById(id: string) {
  const items = await listContracts();
  return items.find((item) => item.id === id || item.contractId === id) ?? null;
}

export async function createContract(payload: ContractPayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  try {
    const created = await prisma.contract.create({
      data: {
        contractNo: payload.contractNo,
        contractBusinessId: payload.contractId,
        customer: { connect: { customerId: payload.customerId } },
        title: payload.projectName,
        amount: payload.amount,
        signedAt: payload.signedAt ? new Date(payload.signedAt) : null,
        billingPeriodDays: payload.billingPeriodDays,
        salesOwnerName: payload.salesOwnerName || null,
        contractStatus: contractStatusToDb(payload.projectStatus) as never,
        remark: payload.remark || null,
      },
      include: { customer: true },
    });

    return normalizeContract({
      id: created.id,
      contractId: created.contractBusinessId ?? created.id,
      customerId: created.customer.customerId,
      customerCode: created.customer.customerCode ?? "",
      customerName: created.customer.name,
      projectName: created.title,
      contractNo: created.contractNo,
      amount: Number(created.amount ?? 0),
      signedAt: created.signedAt?.toISOString().slice(0, 10) ?? null,
      billingPeriodDays: created.billingPeriodDays ?? null,
      salesOwnerName: created.salesOwnerName ?? "",
      projectStatus: contractStatusFromDb(created.contractStatus),
      remark: created.remark ?? "",
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch {
    const now = new Date().toISOString();
    const record = normalizeContract({
      id: `contract-dev-${Date.now()}`,
      customerCode: customer.customerCode,
      customerName: customer.name,
      createdAt: now,
      updatedAt: now,
      ...payload,
    });
    memoryStore.contracts.unshift(record);
    return record;
  }
}

export async function updateContract(id: string, payload: ContractPayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  try {
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        contractNo: payload.contractNo,
        contractBusinessId: payload.contractId,
        customer: { connect: { customerId: payload.customerId } },
        title: payload.projectName,
        amount: payload.amount,
        signedAt: payload.signedAt ? new Date(payload.signedAt) : null,
        billingPeriodDays: payload.billingPeriodDays,
        salesOwnerName: payload.salesOwnerName || null,
        contractStatus: contractStatusToDb(payload.projectStatus) as never,
        remark: payload.remark || null,
      },
      include: { customer: true },
    });

    return normalizeContract({
      id: updated.id,
      contractId: updated.contractBusinessId ?? updated.id,
      customerId: updated.customer.customerId,
      customerCode: updated.customer.customerCode ?? "",
      customerName: updated.customer.name,
      projectName: updated.title,
      contractNo: updated.contractNo,
      amount: Number(updated.amount ?? 0),
      signedAt: updated.signedAt?.toISOString().slice(0, 10) ?? null,
      billingPeriodDays: updated.billingPeriodDays ?? null,
      salesOwnerName: updated.salesOwnerName ?? "",
      projectStatus: contractStatusFromDb(updated.contractStatus),
      remark: updated.remark ?? "",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.contracts.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("合同不存在");
    }
    memoryStore.contracts[index] = normalizeContract({
      ...memoryStore.contracts[index],
      ...payload,
      customerCode: customer.customerCode,
      customerName: customer.name,
      updatedAt: new Date().toISOString(),
    });
    return memoryStore.contracts[index];
  }
}

function riskLevelToDb(level: string) {
  if (level === "低") return "low";
  if (level === "中") return "medium";
  if (level === "高") return "high";
  return "critical";
}

function riskLevelFromDb(level: string) {
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  return "重大";
}

function riskSourceToDb(source: string) {
  if (source === "人工录入") return "manual";
  if (source === "系统计算") return "system";
  if (source === "Excel导入") return "excel";
  return "tianyancha";
}

function riskSourceFromDb(source: string) {
  if (source === "manual") return "人工录入";
  if (source === "system") return "系统计算";
  if (source === "excel") return "Excel导入";
  return "天眼查同步";
}

export async function listRisks(filters: RiskFilters = {}) {
  try {
    const rows = await prisma.riskRecord.findMany({
      include: { customer: true },
      orderBy: { detectedAt: "desc" },
    });

    return rows
      .map((item) =>
        normalizeRisk({
          id: item.id,
          customerId: item.customer.customerId,
          customerCode: item.customer.customerCode ?? "",
          customerName: item.customer.name,
          riskType: item.riskType as RiskRecordItem["riskType"],
          riskTime: (item.eventAt ?? item.detectedAt).toISOString().slice(0, 10),
          riskSource: riskSourceFromDb(item.source),
          riskLevel: riskLevelFromDb(item.riskLevel),
          handled: item.handled,
          handlingAction: "",
          followUpRecord: "",
          riskStatus: item.status,
          remark: item.remark ?? item.description ?? "",
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }),
      )
      .filter(
        (item) =>
          containsKeyword(filters.keyword ?? "", [
            item.customerCode,
            item.customerName,
            item.riskType,
            item.remark,
          ]) &&
          (!filters.customerId || item.customerId === filters.customerId) &&
          (!filters.riskType || item.riskType === filters.riskType) &&
          (!filters.riskLevel || item.riskLevel === filters.riskLevel),
      );
  } catch {
    return memoryStore.risks.filter(
      (item) =>
        containsKeyword(filters.keyword ?? "", [
          item.customerCode,
          item.customerName,
          item.riskType,
          item.remark,
        ]) &&
        (!filters.customerId || item.customerId === filters.customerId) &&
        (!filters.riskType || item.riskType === filters.riskType) &&
        (!filters.riskLevel || item.riskLevel === filters.riskLevel),
    );
  }
}

export async function getRiskById(id: string) {
  const items = await listRisks();
  return items.find((item) => item.id === id) ?? null;
}

export async function createRisk(payload: RiskPayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }
  const riskDate = payload.riskTime ? new Date(payload.riskTime) : new Date();

  try {
    const created = await prisma.riskRecord.create({
      data: {
        customer: { connect: { customerId: payload.customerId } },
        riskType: payload.riskType,
        riskLevel: riskLevelToDb(payload.riskLevel) as never,
        source: riskSourceToDb(payload.riskSource) as never,
        title: payload.riskType,
        description: payload.remark || null,
        handled: payload.handled,
        eventAt: riskDate,
        detectedAt: riskDate,
        sourceDetail: payload.followUpRecord || null,
        remark: payload.remark || null,
        status: payload.handled ? "closed" : "open",
      },
      include: { customer: true },
    });

    return normalizeRisk({
      id: created.id,
      customerId: created.customer.customerId,
      customerCode: created.customer.customerCode ?? "",
      customerName: created.customer.name,
      riskType: created.riskType as RiskRecordItem["riskType"],
      riskTime: (created.eventAt ?? created.detectedAt).toISOString().slice(0, 10),
      riskSource: riskSourceFromDb(created.source),
      riskLevel: riskLevelFromDb(created.riskLevel),
      handled: created.handled,
      handlingAction: payload.handlingAction ?? "",
      followUpRecord: payload.followUpRecord ?? created.sourceDetail ?? "",
      riskStatus: created.status,
      remark: created.remark ?? created.description ?? "",
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch {
    const now = new Date().toISOString();
    const record = normalizeRisk({
      id: `risk-dev-${Date.now()}`,
      customerCode: customer.customerCode,
      customerName: customer.name,
      createdAt: now,
      updatedAt: now,
      ...payload,
    });
    memoryStore.risks.unshift(record);
    return record;
  }
}

export async function updateRisk(id: string, payload: RiskPayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }
  const riskDate = payload.riskTime ? new Date(payload.riskTime) : new Date();

  try {
    const updated = await prisma.riskRecord.update({
      where: { id },
      data: {
        customer: { connect: { customerId: payload.customerId } },
        riskType: payload.riskType,
        riskLevel: riskLevelToDb(payload.riskLevel) as never,
        source: riskSourceToDb(payload.riskSource) as never,
        title: payload.riskType,
        description: payload.remark || null,
        handled: payload.handled,
        eventAt: riskDate,
        detectedAt: riskDate,
        sourceDetail: payload.followUpRecord || null,
        remark: payload.remark || null,
        status: payload.handled ? "closed" : "open",
      },
      include: { customer: true },
    });

    return normalizeRisk({
      id: updated.id,
      customerId: updated.customer.customerId,
      customerCode: updated.customer.customerCode ?? "",
      customerName: updated.customer.name,
      riskType: updated.riskType as RiskRecordItem["riskType"],
      riskTime: (updated.eventAt ?? updated.detectedAt).toISOString().slice(0, 10),
      riskSource: riskSourceFromDb(updated.source),
      riskLevel: riskLevelFromDb(updated.riskLevel),
      handled: updated.handled,
      handlingAction: payload.handlingAction ?? "",
      followUpRecord: payload.followUpRecord ?? updated.sourceDetail ?? "",
      riskStatus: updated.status,
      remark: updated.remark ?? updated.description ?? "",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.risks.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("风险记录不存在");
    }
    memoryStore.risks[index] = normalizeRisk({
      ...memoryStore.risks[index],
      ...payload,
      customerCode: customer.customerCode,
      customerName: customer.name,
      updatedAt: new Date().toISOString(),
    });
    return memoryStore.risks[index];
  }
}

export async function listCreditScores(filters: CreditScoreFilters = {}) {
  const [receivables, risks] = await Promise.all([listReceivables(), listRisks()]);
  try {
    const rows = await prisma.creditScore.findMany({
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
    });

    return enrichInstitutionalScores(
      rows.map((item) => {
        const raw = item as unknown as Record<string, unknown>;
        const fallbackLevel = item.scoreLevel ?? calcCreditLevel(item.score);

        return {
          id: item.id,
          customerId: item.customer.customerId,
          customerCode: item.customer.customerCode ?? "",
          customerName: item.customer.name,
          creditRiskScore: item.creditRiskScore,
          businessRiskScore: item.businessRiskScore,
          financialRiskScore: item.financialRiskScore,
          totalScore: item.score,
          creditScore: item.score,
          creditLevel: fallbackLevel,
          riskAction:
            typeof raw.riskAction === "string"
              ? raw.riskAction
              : getRiskActionByCreditLevel(fallbackLevel),
          riskStatus:
            typeof raw.riskStatus === "string"
              ? raw.riskStatus
              : getRiskStatusByCreditLevel(fallbackLevel),
          scoreDelta: typeof raw.scoreDelta === "number" ? raw.scoreDelta : null,
          scoreDate: item.updatedAt.toISOString().slice(0, 10),
          scoreMonth: item.scoreMonth,
          description: item.scoreReason ?? "",
          keyAttention: item.keyAttention,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        };
      }),
      receivables,
      risks,
    )
      .filter(
        (item) =>
          (!filters.scoreMonth || item.scoreMonth === filters.scoreMonth) &&
          (!filters.creditLevel || item.creditLevel === filters.creditLevel),
      );
  } catch {
    return enrichInstitutionalScores(memoryStore.creditScores, receivables, risks)
      .filter(
        (item) =>
          (!filters.scoreMonth || item.scoreMonth === filters.scoreMonth) &&
          (!filters.creditLevel || item.creditLevel === filters.creditLevel),
      );
  }
}

export async function getCreditScoreById(id: string) {
  const items = await listCreditScores();
  return items.find((item) => item.id === id) ?? null;
}

export async function createCreditScore(payload: CreditScorePayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  const totalScore =
    payload.creditRiskScore + payload.businessRiskScore + payload.financialRiskScore;
  const creditLevel = calcCreditLevel(totalScore);
  const riskAction = getRiskActionByCreditLevel(creditLevel);
  const riskStatus = getRiskStatusByCreditLevel(creditLevel);

  try {
    const created = await prisma.creditScore.create({
      data: {
        customer: { connect: { customerId: payload.customerId } },
        scoreMonth: payload.scoreMonth,
        creditRiskScore: payload.creditRiskScore,
        businessRiskScore: payload.businessRiskScore,
        financialRiskScore: payload.financialRiskScore,
        score: totalScore,
        scoreLevel: creditLevel,
        scoreReason: payload.description || null,
        keyAttention: ["B", "B-", "C"].includes(creditLevel),
      },
      include: { customer: true },
    });

    return normalizeCreditScore({
      id: created.id,
      customerId: created.customer.customerId,
      customerCode: created.customer.customerCode ?? "",
      customerName: created.customer.name,
      creditRiskScore: created.creditRiskScore,
      businessRiskScore: created.businessRiskScore,
      financialRiskScore: created.financialRiskScore,
      totalScore: created.score,
      creditScore: created.score,
      creditLevel: created.scoreLevel ?? creditLevel,
      riskAction,
      riskStatus,
      scoreDelta: null,
      scoreDate: created.updatedAt.toISOString().slice(0, 10),
      scoreMonth: created.scoreMonth,
      description: created.scoreReason ?? "",
      keyAttention: ["B", "B-", "C"].includes(creditLevel),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch {
    const now = new Date().toISOString();
    const record = normalizeCreditScore({
      id: `score-dev-${Date.now()}`,
      customerCode: customer.customerCode,
      customerName: customer.name,
      totalScore,
      creditScore: totalScore,
      creditLevel,
      riskAction,
      riskStatus,
      scoreDelta: null,
      keyAttention: ["B", "B-", "C"].includes(creditLevel),
      createdAt: now,
      updatedAt: now,
      ...payload,
    });
    memoryStore.creditScores.unshift(record);
    return record;
  }
}

export async function updateCreditScore(id: string, payload: CreditScorePayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  const totalScore =
    payload.creditRiskScore + payload.businessRiskScore + payload.financialRiskScore;
  const creditLevel = calcCreditLevel(totalScore);
  const riskAction = getRiskActionByCreditLevel(creditLevel);
  const riskStatus = getRiskStatusByCreditLevel(creditLevel);

  try {
    const updated = await prisma.creditScore.update({
      where: { id },
      data: {
        customer: { connect: { customerId: payload.customerId } },
        scoreMonth: payload.scoreMonth,
        creditRiskScore: payload.creditRiskScore,
        businessRiskScore: payload.businessRiskScore,
        financialRiskScore: payload.financialRiskScore,
        score: totalScore,
        scoreLevel: creditLevel,
        scoreReason: payload.description || null,
        keyAttention: ["B", "B-", "C"].includes(creditLevel),
      },
      include: { customer: true },
    });

    return normalizeCreditScore({
      id: updated.id,
      customerId: updated.customer.customerId,
      customerCode: updated.customer.customerCode ?? "",
      customerName: updated.customer.name,
      creditRiskScore: updated.creditRiskScore,
      businessRiskScore: updated.businessRiskScore,
      financialRiskScore: updated.financialRiskScore,
      totalScore: updated.score,
      creditScore: updated.score,
      creditLevel: updated.scoreLevel ?? creditLevel,
      riskAction,
      riskStatus,
      scoreDelta: null,
      scoreDate: updated.updatedAt.toISOString().slice(0, 10),
      scoreMonth: updated.scoreMonth,
      description: updated.scoreReason ?? "",
      keyAttention: ["B", "B-", "C"].includes(creditLevel),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.creditScores.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("评分记录不存在");
    }
    const next = normalizeCreditScore({
      ...memoryStore.creditScores[index],
      ...payload,
      customerCode: customer.customerCode,
      customerName: customer.name,
      updatedAt: new Date().toISOString(),
      totalScore,
      creditScore: totalScore,
      creditLevel,
      riskAction,
      riskStatus,
      scoreDelta: null,
    });
    memoryStore.creditScores[index] = next;
    return next;
  }
}

export async function listCollectionItems() {
  try {
    const rows = await prisma.collectionTask.findMany({
      include: {
        customer: true,
        receivable: true,
        assignedTo: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((item) =>
      normalizeCollectionItem({
        id: item.id,
        customerId: item.customer.customerId,
        customerCode: item.customer.customerCode ?? "",
        customerName: item.customer.name,
        unpaidAmount: Number(item.receivable?.unpaidAmount ?? 0),
        currentCreditLevel: item.customer.currentCreditLevel ?? "",
        maxOverdueDays: item.receivable?.overdueDays ?? null,
        collectionLevel: item.collectionLevel ?? null,
        currentMeasure: item.currentMeasure ?? "",
        ownerName: item.assignedTo?.fullName ?? "",
        followUpStatus: item.taskStatus,
        handoffToLegal: item.handoffToLegal,
        openclawSummary: item.openclawSummary ?? "",
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }),
    );
  } catch {
    return memoryStore.collections.map(normalizeCollectionItem);
  }
}

export async function getCollectionItemById(id: string) {
  const items = await listCollectionItems();
  return items.find((item) => item.id === id) ?? null;
}

export async function updateCollectionItem(id: string, payload: CollectionItemPayload) {
  const customer = await getCustomerById(payload.customerId);
  if (!customer) {
    throw new Error("客户不存在，请先创建客户");
  }

  try {
    const updated = await prisma.collectionTask.update({
      where: { id },
      data: {
        customer: { connect: { customerId: payload.customerId } },
        collectionLevel: payload.collectionLevel || null,
        currentMeasure: payload.currentMeasure || null,
        taskStatus: (payload.followUpStatus || "pending") as never,
        handoffToLegal: payload.handoffToLegal,
        openclawSummary: payload.openclawSummary || null,
      },
      include: { customer: true, receivable: true, assignedTo: true },
    });

    return normalizeCollectionItem({
      id: updated.id,
      customerId: updated.customer.customerId,
      customerCode: updated.customer.customerCode ?? "",
      customerName: updated.customer.name,
      unpaidAmount: Number(updated.receivable?.unpaidAmount ?? 0),
      currentCreditLevel: updated.customer.currentCreditLevel ?? "",
      maxOverdueDays: updated.receivable?.overdueDays ?? null,
      collectionLevel: updated.collectionLevel ?? null,
      currentMeasure: updated.currentMeasure ?? "",
      ownerName: payload.ownerName || updated.assignedTo?.fullName || "",
      followUpStatus: payload.followUpStatus || updated.taskStatus,
      handoffToLegal: updated.handoffToLegal,
      openclawSummary: updated.openclawSummary ?? "",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    const index = memoryStore.collections.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("催收记录不存在");
    }
    const next = normalizeCollectionItem({
      ...memoryStore.collections[index],
      ...payload,
      customerCode: customer.customerCode,
      customerName: customer.name,
      currentCreditLevel:
        memoryStore.collections[index].currentCreditLevel || customer.currentCreditLevel,
      updatedAt: new Date().toISOString(),
    });
    memoryStore.collections[index] = next;
    return next;
  }
}

export function listReportEntries(): ReportEntry[] {
  return reportEntries;
}
