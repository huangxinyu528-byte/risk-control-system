import type {
  CreditScoreRecord,
  CustomerRecord,
  DashboardOverviewData,
  ExecutableRiskLevel,
  ExecutableRiskRuleResult,
  PageStat,
  ReceivableRecord,
} from "@/lib/types";
import { formatCurrency } from "@/lib/format";

type HighRiskSignal = {
  riskType: string;
  riskLevel: string;
};

type CreditUtilizationStatus = "正常" | "预警" | "风险" | "超额度" | "未启用";

type SpreadsheetCell = {
  text?: string | number | null;
};

type SpreadsheetRow = {
  cells?: Record<string, SpreadsheetCell | undefined>;
};

type SpreadsheetSheetData = {
  rows?: Record<string, SpreadsheetRow | undefined>;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOnlyString(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function executableRiskLevelRank(level: ExecutableRiskLevel) {
  if (level === "极高风险") return 4;
  if (level === "高风险") return 3;
  if (level === "中风险") return 2;
  return 1;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function excelSerialToDate(serial: number) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 24 * 60 * 60 * 1000);
}

function parseMonthToken(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 30000 || value > 60000) {
      return null;
    }
    return monthKey(excelSerialToDate(value));
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (/^\d{5}$/.test(text)) {
    return monthKey(excelSerialToDate(Number(text)));
  }

  const normalized = text
    .replace(/[年月/.]/g, "-")
    .replace(/日/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const fullMatch = normalized.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (fullMatch) {
    const year = Number(fullMatch[1]);
    const month = Number(fullMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseDateToken(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 30000 || value > 60000) {
      return null;
    }
    return excelSerialToDate(value);
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (/^\d{5}$/.test(text)) {
    return excelSerialToDate(Number(text));
  }

  const normalized = text
    .replace(/[年月/.]/g, "-")
    .replace(/日/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmountToken(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .replace(/[,\s]/g, "")
    .replace(/[￥¥]/g, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function getSheetCellText(sheetData: Record<string, unknown> | null | undefined, rowIndex: number, colIndex: number) {
  const rows = (sheetData as SpreadsheetSheetData | null | undefined)?.rows ?? {};
  const cell = rows[String(rowIndex)]?.cells?.[String(colIndex)];
  if (!cell || cell.text === null || cell.text === undefined || cell.text === "") {
    return null;
  }
  return String(cell.text).trim();
}

function collectColumnValuesBelowHeader(
  sheetData: Record<string, unknown> | null | undefined,
  headerKeywords: string[],
) {
  const rows = (sheetData as SpreadsheetSheetData | null | undefined)?.rows ?? {};
  const collected: string[] = [];

  for (const [rowKey, rowValue] of Object.entries(rows)) {
    const rowIndex = Number(rowKey);
    const cells = rowValue?.cells ?? {};
    for (const [colKey, cell] of Object.entries(cells)) {
      const text = String(cell?.text ?? "").trim();
      if (!text) continue;
      if (!headerKeywords.some((keyword) => text.includes(keyword))) continue;

      const colIndex = Number(colKey);
      let blankCount = 0;
      for (let cursor = rowIndex + 1; cursor <= rowIndex + 48; cursor += 1) {
        const value = getSheetCellText(sheetData, cursor, colIndex);
        if (!value) {
          blankCount += 1;
          if (blankCount >= 3) break;
          continue;
        }
        blankCount = 0;
        collected.push(value);
      }
    }
  }

  return collected;
}

export function evaluateCollectionRateRisk(args: {
  receivedAmount: number;
  contractReceivable: number;
}): ExecutableRiskRuleResult | null {
  const contractReceivable = Number(args.contractReceivable ?? 0);
  const receivedAmount = Number(args.receivedAmount ?? 0);

  if (!Number.isFinite(contractReceivable) || contractReceivable <= 0) {
    return null;
  }

  const ratio = receivedAmount / contractReceivable;
  if (ratio >= 0.8) {
    return null;
  }

  let riskLevel: ExecutableRiskLevel = "中风险";
  let action = "持续跟进回款";
  if (ratio < 0.2) {
    riskLevel = "极高风险";
    action = "立即升级跟进并评估法律/保全措施";
  } else if (ratio < 0.5) {
    riskLevel = "高风险";
    action = "加快催收并核对应收节点";
  }

  return {
    ruleCode: "R-002",
    matched: true,
    riskLevel,
    reason: "项目回款比例偏低",
    detail: `已收金额占按合同应收金额比例仅为 ${(ratio * 100).toFixed(1)}%`,
    action,
  };
}

export function evaluateHighExposureRisk(args: {
  receivableAmount: number;
  unpaidAmount: number;
}): ExecutableRiskRuleResult | null {
  const receivableAmount = Number(args.receivableAmount ?? 0);
  const unpaidAmount = Number(args.unpaidAmount ?? 0);

  if (receivableAmount < 10_000_000 || unpaidAmount < 1_000_000) {
    return null;
  }

  const ratio = receivableAmount > 0 ? unpaidAmount / receivableAmount : 0;
  let riskLevel: ExecutableRiskLevel = "高风险";
  let action = "优先催收并纳入重点项目跟进";

  if (
    (receivableAmount >= 100_000_000 && unpaidAmount >= 10_000_000) ||
    (receivableAmount >= 50_000_000 && unpaidAmount >= 10_000_000 && ratio >= 0.3)
  ) {
    riskLevel = "极高风险";
    action = "立即升级管理层关注并评估风险处置方案";
  }

  return {
    ruleCode: "R-011",
    matched: true,
    riskLevel,
    reason: "项目金额和未收金额同时较大",
    detail: `项目应收 ${formatCurrency(receivableAmount)}，未收 ${formatCurrency(unpaidAmount)}，风险敞口较高`,
    action,
  };
}

export function evaluateDueMonthRisk(args: {
  contractReceivable: number;
  receivedAmount: number;
  unpaidAmount: number;
  sheetData?: Record<string, unknown> | null;
}): ExecutableRiskRuleResult | null {
  const contractReceivable = Number(args.contractReceivable ?? 0);
  const receivedAmount = Number(args.receivedAmount ?? 0);
  const unpaidAmount = Number(args.unpaidAmount ?? 0);
  if (unpaidAmount <= 0 || !args.sheetData) {
    return null;
  }

  const rawDueMonths = collectColumnValuesBelowHeader(args.sheetData, ["应回款月份", "应付款月份", "回款月份", "付款期间"]);
  const rawReceiptDates = collectColumnValuesBelowHeader(args.sheetData, ["实际收款时间", "实际收款日期", "收款时间", "收款日期"]);
  const rawReceiptAmounts = collectColumnValuesBelowHeader(args.sheetData, ["回款金额", "实际收款金额", "收款金额"]);
  const parsedDueMonths = Array.from(new Set(rawDueMonths.map(parseMonthToken).filter(Boolean))) as string[];
  if (parsedDueMonths.length === 0) {
    return null;
  }

  const parsedReceiptMonths = Array.from(
    new Set(
      rawReceiptDates
        .map(parseDateToken)
        .filter((value): value is Date => Boolean(value))
        .map(monthKey),
    ),
  );
  const receiptAmountTotal = rawReceiptAmounts
    .map(parseAmountToken)
    .filter((value): value is number => value !== null && value > 0)
    .reduce((sum, value) => sum + value, 0);

  const now = new Date();
  const currentMonth = monthKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const dueReached = parsedDueMonths.filter((item) => item <= currentMonth);
  if (dueReached.length === 0) {
    return null;
  }

  const receiptMonthsReached = parsedReceiptMonths.filter((item) => item <= currentMonth);
  const dueNodeCount = dueReached.length;
  const receiptNodeCount = receiptMonthsReached.length;
  const observedCollected = Math.max(receivedAmount, receiptAmountTotal, 0);
  const dueProgressRatio = parsedDueMonths.length > 0 ? dueNodeCount / parsedDueMonths.length : 0;
  const collectionRatio = contractReceivable > 0 ? observedCollected / contractReceivable : 0;
  const missingReceiptEvidence = receiptNodeCount === 0 && receiptAmountTotal <= 0;
  const laggingReceiptNodes = receiptNodeCount < dueNodeCount;
  const dueProgressAhead = dueProgressRatio - collectionRatio >= 0.15;

  if (!missingReceiptEvidence && !laggingReceiptNodes && !dueProgressAhead) {
    return null;
  }

  const highRisk =
    dueNodeCount >= 2 &&
    (unpaidAmount >= 1_000_000 || missingReceiptEvidence || dueProgressRatio - collectionRatio >= 0.3);

  const detailParts = [`已到期应回款节点 ${dueNodeCount} 个`];
  if (receiptNodeCount > 0) {
    detailParts.push(`已记录实际收款节点 ${receiptNodeCount} 个`);
  }
  if (receiptAmountTotal > 0) {
    detailParts.push(`右侧辅助区记录回款 ${formatCurrency(receiptAmountTotal)}`);
  }
  detailParts.push(`当前未收 ${formatCurrency(unpaidAmount)}`);

  return {
    ruleCode: "R-009",
    matched: true,
    riskLevel: highRisk ? "高风险" : "中风险",
    reason: "应回款月份已到但回款未按计划落实",
    detail: `${detailParts.join("，")}，最早到期节点 ${dueReached[0]}`,
    action: highRisk ? "重点核对应回款节点并升级催收处理" : "核对回款节点并持续催收",
  };
}

export function evaluateProjectExecutableRiskRules(args: {
  receivableAmount: number;
  contractReceivable: number;
  receivedAmount: number;
  unpaidAmount: number;
  sheetData?: Record<string, unknown> | null;
}) {
  return [
    evaluateCollectionRateRisk({
      receivedAmount: args.receivedAmount,
      contractReceivable: args.contractReceivable,
    }),
    evaluateHighExposureRisk({
      receivableAmount: args.receivableAmount,
      unpaidAmount: args.unpaidAmount,
    }),
    evaluateDueMonthRisk({
      contractReceivable: args.contractReceivable,
      receivedAmount: args.receivedAmount,
      unpaidAmount: args.unpaidAmount,
      sheetData: args.sheetData,
    }),
  ].filter(Boolean) as ExecutableRiskRuleResult[];
}

export function summarizeProjectExecutableRiskRules(
  results: ExecutableRiskRuleResult[],
): {
  riskLevel: ExecutableRiskLevel;
  reasons: string[];
  actions: string[];
  triggeredRules: Array<ExecutableRiskRuleResult["ruleCode"]>;
} {
  if (results.length === 0) {
    return {
      riskLevel: "低风险",
      reasons: [],
      actions: [],
      triggeredRules: [],
    };
  }

  const topLevel = [...results].sort(
    (left, right) => executableRiskLevelRank(right.riskLevel) - executableRiskLevelRank(left.riskLevel),
  )[0]?.riskLevel ?? "低风险";

  return {
    riskLevel: topLevel,
    reasons: Array.from(new Set(results.map((item) => item.reason))),
    actions: Array.from(new Set(results.map((item) => item.action))),
    triggeredRules: Array.from(new Set(results.map((item) => item.ruleCode))),
  };
}

function normalizePaymentTermLabel(item: ReceivableRecord) {
  if (item.paymentTerm) {
    return item.paymentTerm;
  }

  if (item.billingPeriodDays) {
    return `${item.billingPeriodDays}天`;
  }

  return null;
}

export function calculateDueDate(baseDate: string | null, paymentTerm: string | null) {
  const normalizedBaseDate = parseDateOnly(baseDate);
  if (!normalizedBaseDate || !paymentTerm) {
    return null;
  }

  if (paymentTerm === "次月10号") {
    return toDateOnlyString(new Date(normalizedBaseDate.getFullYear(), normalizedBaseDate.getMonth() + 1, 10));
  }
  if (paymentTerm === "次月20号") {
    return toDateOnlyString(new Date(normalizedBaseDate.getFullYear(), normalizedBaseDate.getMonth() + 1, 20));
  }
  if (paymentTerm === "次月月底") {
    return toDateOnlyString(endOfMonth(new Date(normalizedBaseDate.getFullYear(), normalizedBaseDate.getMonth() + 2, 0)));
  }

  const match = paymentTerm.match(/^(\d+)天$/);
  if (match) {
    return toDateOnlyString(addDays(normalizedBaseDate, Number(match[1])));
  }

  return null;
}

function calculateOverdueDays(dueDate: string | null, isSettled: boolean) {
  if (!dueDate || isSettled) {
    return null;
  }

  const normalizedDueDate = parseDateOnly(dueDate);
  if (!normalizedDueDate) {
    return null;
  }

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueOnly = new Date(
    normalizedDueDate.getFullYear(),
    normalizedDueDate.getMonth(),
    normalizedDueDate.getDate(),
  );
  const diff = Math.floor((todayOnly.getTime() - dueOnly.getTime()) / (24 * 60 * 60 * 1000));

  return Math.max(diff, 0);
}

function calculateAgingBucket(dueDate: string | null, overdueDays: number | null) {
  if (!dueDate || overdueDays === null) {
    return null;
  }

  if (overdueDays <= 0) {
    return "未到期";
  }
  if (overdueDays <= 30) {
    return "1-30天";
  }
  if (overdueDays <= 60) {
    return "31-60天";
  }
  return "60+天";
}

function getReceivableRiskStatus(item: ReceivableRecord, overdueDays: number | null) {
  if (item.riskStatus === "诉讼") {
    return "诉讼";
  }

  if (overdueDays === null) {
    return item.riskStatus || "待补数据";
  }

  if (overdueDays <= 0) {
    return "正常";
  }
  if (overdueDays <= 30) {
    return "轻微风险";
  }
  if (overdueDays <= 60) {
    return "中风险";
  }
  return "高风险";
}

function getReceivableStatus(item: ReceivableRecord, isSettled: boolean, overdueDays: number | null) {
  if (isSettled) {
    return "已结清";
  }
  if (overdueDays !== null && overdueDays > 0) {
    return "已逾期";
  }
  return item.receivableStatus || "回款中";
}

function calculateCreditUtilizationStatus(
  receivableBalance: number,
  creditLimit: number,
): {
  rate: number | null;
  status: CreditUtilizationStatus;
} {
  // Enabled rule: credit limit utilization is computed only when the customer has a valid credit limit.
  if (!creditLimit || creditLimit <= 0) {
    return {
      rate: null,
      status: "未启用",
    };
  }

  const rate = receivableBalance / creditLimit;

  if (rate > 1) {
    return { rate, status: "超额度" };
  }
  if (rate > 0.9) {
    return { rate, status: "风险" };
  }
  if (rate >= 0.7) {
    return { rate, status: "预警" };
  }

  return { rate, status: "正常" };
}

function isHighRiskCustomer(
  receivables: ReceivableRecord[],
  risks: HighRiskSignal[],
  latestScore?: CreditScoreRecord,
) {
  // Enabled rule: mark as high risk only from receivable and risk-record signals.
  // Credit-limit related signals are retained as reference data, not as default risk triggers.
  return (
    latestScore?.creditLevel === "C" ||
    receivables.some((item) => ["高风险", "诉讼"].includes(item.riskStatus)) ||
    risks.some(
      (item) =>
        ["诉讼", "被执行人", "失信被执行人"].includes(item.riskType) ||
        item.riskLevel === "重大",
    )
  );
}

function isKeyAttentionCustomer(
  scores: CreditScoreRecord[],
  receivables: ReceivableRecord[],
  latestScore?: CreditScoreRecord,
) {
  // Enabled rule: key attention comes from scoring output and receivable attention markers.
  // Credit-limit warning is retained only as reference and is not enabled by default.
  return (
    ["B", "B-", "C"].includes(latestScore?.creditLevel ?? "") ||
    scores.some((item) => item.keyAttention) ||
    receivables.some((item) => ["轻微风险", "中风险", "需关注"].includes(item.riskStatus))
  );
}

export function applyReceivableRules(item: ReceivableRecord): ReceivableRecord {
  const paymentTerm = normalizePaymentTermLabel(item);
  const dueDate = calculateDueDate(item.baseDate, paymentTerm) ?? item.dueDate ?? null;
  const receivedAmount = Math.max(item.receivedAmount, 0);
  const unpaidAmount = Math.max(item.amount - receivedAmount, 0);
  const paymentRate = item.amount > 0 ? receivedAmount / item.amount : 0;
  const isSettled = receivedAmount >= item.amount && item.amount > 0;
  const overdueDays = calculateOverdueDays(dueDate, isSettled);
  const agingBucket = calculateAgingBucket(dueDate, overdueDays);
  const overdueRuleEnabled = Boolean(paymentTerm && dueDate);
  const overdueRuleStatus =
    overdueDays === null ? "未启用" : overdueDays > 0 ? "预警" : "正常";
  const manualStatusMaintained = !overdueRuleEnabled;
  const riskStatus = getReceivableRiskStatus(item, overdueDays);
  const receivableStatus = getReceivableStatus(item, isSettled, overdueDays);

  return {
    ...item,
    paymentTerm,
    unpaidAmount,
    paymentRate,
    dueDate,
    receivedAmount,
    isSettled,
    overdueDays,
    agingBucket,
    riskStatus,
    receivableStatus,
    overdueRuleEnabled,
    overdueRuleStatus,
    manualStatusMaintained,
  };
}

export function applyReceivablePortfolioRules(items: ReceivableRecord[]) {
  const grouped = new Map<string, ReceivableRecord[]>();

  for (const item of items) {
    const group = grouped.get(item.customerId) ?? [];
    group.push(item);
    grouped.set(item.customerId, group);
  }

  return Array.from(grouped.values()).flatMap((customerItems) => {
    const sorted = [...customerItems].sort((left, right) => {
      const leftKey = left.baseDate || left.period || left.createdAt;
      const rightKey = right.baseDate || right.period || right.createdAt;
      return leftKey.localeCompare(rightKey) || left.createdAt.localeCompare(right.createdAt);
    });

    let remainingReceived = sorted.reduce((sum, item) => sum + Math.max(item.receivedAmount, 0), 0);

    return sorted.map((item) => {
      const allocatedReceived = Math.min(item.amount, remainingReceived);
      remainingReceived = Math.max(remainingReceived - allocatedReceived, 0);

      return applyReceivableRules({
        ...item,
        receivedAmount: allocatedReceived,
      });
    });
  });
}

export function applyCustomerRules(
  customer: CustomerRecord,
  receivables: ReceivableRecord[],
  scores: CreditScoreRecord[],
  risks: HighRiskSignal[] = [],
): CustomerRecord {
  // Enabled rule: current receivable balance is aggregated from all unpaid receivables for the customer.
  const receivableBalance = receivables.reduce((sum, item) => sum + item.unpaidAmount, 0);
  const latestScore = [...scores].sort((a, b) => b.scoreDate.localeCompare(a.scoreDate))[0];
  const { rate, status } = calculateCreditUtilizationStatus(
    receivableBalance,
    customer.creditLimit ?? 0,
  );
  const highRiskCustomer = isHighRiskCustomer(receivables, risks, latestScore);
  const keyAttentionCustomer = isKeyAttentionCustomer(scores, receivables, latestScore);

  const ruleFlags = [
    highRiskCustomer ? "高风险客户" : "",
    keyAttentionCustomer ? "重点关注客户" : "",
    latestScore?.riskAction && latestScore.riskAction !== "常规跟进" ? latestScore.riskAction : "",
  ].filter(Boolean);

  return {
    ...customer,
    currentCreditLevel: latestScore?.creditLevel ?? customer.currentCreditLevel,
    creditScore: latestScore?.creditScore ?? customer.creditScore ?? null,
    creditLevel: latestScore?.creditLevel ?? customer.creditLevel ?? customer.currentCreditLevel,
    riskAction: latestScore?.riskAction ?? customer.riskAction ?? "常规跟进",
    riskStatus: latestScore?.riskStatus ?? customer.riskStatus ?? "正常",
    scoreDelta: latestScore?.scoreDelta ?? customer.scoreDelta ?? null,
    receivableBalance,
    creditUtilizationRate: rate,
    creditUtilizationStatus: status,
    highRiskCustomer,
    keyAttentionCustomer,
    ruleFlags,
  };
}

export function buildRuleSummary(): DashboardOverviewData["ruleSummary"] {
  return [
    {
      name: "未收金额自动计算",
      status: "已启用",
      description: "按应收金额减已收金额实时计算。",
    },
    {
      name: "回款率自动计算",
      status: "已启用",
      description: "按已收金额除以应收金额计算。",
    },
    {
      name: "信用额度使用率自动计算",
      status: "未启用",
      description: "信用额度字段保留为辅助参考信息，当前不纳入默认风控判断。",
    },
    {
      name: "期间账款逾期判断",
      status: "已启用",
      description: "根据期间、付款周期、起算日期和当前日期自动判断到期与逾期状态。",
    },
    {
      name: "制度信用评分",
      status: "已启用",
      description: "按未按期回款、跨月回款、诉讼、预付款等制度规则自动生成月度评分。",
    },
    {
      name: "风险动作触发",
      status: "已启用",
      description: "根据制度评分等级自动触发风险告知、催款或诉讼动作。",
    },
  ];
}

export function buildRuleAwareDashboardOverview(
  customers: CustomerRecord[],
  receivables: ReceivableRecord[],
): DashboardOverviewData {
  const totalAmount = receivables.reduce((sum, item) => sum + item.amount, 0);
  const totalReceived = receivables.reduce((sum, item) => sum + item.receivedAmount, 0);
  const totalUnpaid = receivables.reduce((sum, item) => sum + item.unpaidAmount, 0);
  const highRiskCustomers = customers.filter((item) => item.highRiskCustomer).length;
  const keyAttentionCustomers = customers.filter((item) => item.keyAttentionCustomer).length;
  const creditLimitWarnings = 0;
  const creditLimitRisks = 0;
  const overdueReceivables = receivables.filter((item) => (item.overdueDays ?? 0) > 0);
  const overdueCustomerCount = new Set(overdueReceivables.map((item) => item.customerId)).size;
  const overdueAmount = overdueReceivables.reduce((sum, item) => sum + item.unpaidAmount, 0);
  const overdue60Amount = receivables
    .filter((item) => (item.overdueDays ?? 0) > 60)
    .reduce((sum, item) => sum + item.unpaidAmount, 0);
  const settledRatio =
    totalAmount > 0 ? totalReceived / totalAmount : 0;
  const cLevelCustomers = customers.filter((item) => item.creditLevel === "C").length;
  const collectionCustomers = customers.filter((item) => item.riskAction === "催款").length;
  const scoreDownCustomers = customers.filter((item) => (item.scoreDelta ?? 0) < 0).length;
  const litigationCustomers = new Set(
    receivables.filter((item) => item.riskStatus === "诉讼").map((item) => item.customerId),
  ).size;

  const gradeMap = customers.reduce<Record<string, number>>((acc, customer) => {
    const level = customer.currentCreditLevel || "未评级";
    acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {});

  const collectionTopCustomers = [...customers]
    .sort((a, b) => (b.receivableBalance ?? 0) - (a.receivableBalance ?? 0))
    .slice(0, 5)
    .map((customer) => {
      const customerReceivables = receivables.filter(
        (item) => item.customerId === customer.customerId,
      );
      const maxOverdueDays = customerReceivables.reduce<number | null>((max, item) => {
        if (item.overdueDays === null) {
          return max;
        }
        return max === null ? item.overdueDays : Math.max(max, item.overdueDays);
      }, null);

      return {
        customerName: customer.name,
        unpaidAmount: customer.receivableBalance ?? 0,
        overdueDays: maxOverdueDays,
        riskStatus: customer.highRiskCustomer ? "高风险" : customer.keyAttentionCustomer ? "需关注" : "正常",
      };
    });

  const stats: PageStat[] = [
    { label: "应收账款总额", value: formatCurrency(totalAmount), helper: "规则已启用" },
    { label: "已收金额", value: formatCurrency(totalReceived), helper: "规则已启用" },
    { label: "未收金额", value: formatCurrency(totalUnpaid), helper: "自动计算" },
    { label: "逾期客户数", value: String(overdueCustomerCount), helper: "按期间账款自动识别" },
    { label: "逾期金额", value: formatCurrency(overdueAmount), helper: "仅统计未结清逾期账款" },
    { label: "60天以上金额", value: formatCurrency(overdue60Amount), helper: "逾期61天以上未收金额" },
    { label: "已结清比例", value: `${Math.round(settledRatio * 100)}%`, helper: "按累计回款覆盖计算" },
    { label: "C级客户数", value: String(cLevelCustomers), helper: "评分触发诉讼级客户" },
    { label: "催款客户数", value: String(collectionCustomers), helper: "当前触发催款动作" },
    { label: "评分下降客户", value: String(scoreDownCustomers), helper: "较上月评分下降" },
    { label: "诉讼客户数", value: String(litigationCustomers), helper: "含诉讼相关风险事件" },
    { label: "高风险客户数", value: String(highRiskCustomers), helper: "已启用规则标识" },
    { label: "重点关注客户数", value: String(keyAttentionCustomers), helper: "评分/风险/人工标识" },
  ];

  return {
    stats,
    gradeDistribution: Object.entries(gradeMap).map(([level, count]) => ({ level, count })),
    collectionTopCustomers,
    riskTrend: [
      { month: "10月", value: 2 },
      { month: "11月", value: 3 },
      { month: "12月", value: 4 },
      { month: "1月", value: 5 },
      { month: "2月", value: 4 },
      { month: "3月", value: 6 },
    ],
    ruleSummary: buildRuleSummary(),
    focusSummary: {
      highRiskCustomers,
      keyAttentionCustomers,
      creditLimitWarnings,
      creditLimitRisks,
      cLevelCustomers,
      collectionCustomers,
      scoreDownCustomers,
      litigationCustomers,
    },
  };
}
