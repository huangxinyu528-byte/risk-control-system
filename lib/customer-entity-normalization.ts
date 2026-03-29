const PROJECT_KEYWORDS = [
  "地块",
  "#地块",
  "号地块",
  "工区",
  "组团",
  "批次",
  "一期",
  "二期",
  "三期",
  "四期",
  "标段",
  "劳务",
  "项目",
  "总坪",
  "学校",
  "云城",
  "翡翠城",
  "华庭",
  "商铺",
];

const ALIAS_ONLY_KEYWORDS = [
  "分公司",
  "子公司",
  "十局",
  "自运",
  "汇总",
];

export type CustomerEntitySplitKind = "project" | "alias" | "none";

export type CustomerEntityNormalizationResult = {
  originalName: string;
  normalizedOriginalName: string;
  baseCustomerName: string;
  projectAlias: string | null;
  bracketContent: string | null;
  splitKind: CustomerEntitySplitKind;
  shouldMergeToBaseCustomer: boolean;
  reasons: string[];
};

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBracketText(value: string) {
  return value.replace(/（/g, "(").replace(/）/g, ")");
}

export function normalizeCustomerSourceName(value: string | null | undefined) {
  const normalized = normalizeBracketText(normalizeWhitespace(value)).replace(/\s*汇总\s*$/, "");
  return normalized.trim();
}

export function normalizeProjectName(value: string | null | undefined) {
  const normalized = normalizeBracketText(normalizeWhitespace(value))
    .replace(/\s+/g, "")
    .replace(/#/g, "#")
    .replace(/号地块/g, "#地块");
  return normalized.trim();
}

function includesAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function classifyBracketContent(value: string | null | undefined): CustomerEntitySplitKind {
  const normalized = normalizeBracketText(normalizeWhitespace(value));
  if (!normalized) {
    return "none";
  }
  if (includesAnyKeyword(normalized, PROJECT_KEYWORDS)) {
    return "project";
  }
  if (includesAnyKeyword(normalized, ALIAS_ONLY_KEYWORDS)) {
    return "alias";
  }
  if (normalized.length <= 2) {
    return "none";
  }
  return "alias";
}

export function splitCustomerEntityName(value: string | null | undefined): CustomerEntityNormalizationResult {
  const originalName = normalizeWhitespace(value);
  const normalizedOriginalName = normalizeCustomerSourceName(originalName);
  const reasons: string[] = [];
  const match = normalizedOriginalName.match(/^(.*?)[(](.+)[)]$/);

  if (!match) {
    return {
      originalName,
      normalizedOriginalName,
      baseCustomerName: normalizedOriginalName,
      projectAlias: null,
      bracketContent: null,
      splitKind: "none",
      shouldMergeToBaseCustomer: false,
      reasons,
    };
  }

  const baseCustomerName = normalizeWhitespace(match[1]);
  const bracketContent = normalizeWhitespace(match[2]);
  const splitKind = classifyBracketContent(bracketContent);

  if (splitKind === "project") {
    reasons.push("括号内容命中项目关键词");
  } else if (splitKind === "alias") {
    reasons.push("括号内容更像别名或组织说明");
  } else {
    reasons.push("括号内容不明确，保守不自动拆分");
  }

  return {
    originalName,
    normalizedOriginalName,
    baseCustomerName: splitKind === "none" ? normalizedOriginalName : baseCustomerName,
    projectAlias: splitKind === "project" ? bracketContent : null,
    bracketContent,
    splitKind,
    shouldMergeToBaseCustomer: splitKind !== "none" && baseCustomerName.length > 0,
    reasons,
  };
}

export function buildProjectNormalization(args: {
  projectName?: string | null;
  projectAlias?: string | null;
}) {
  const projectName = normalizeWhitespace(args.projectName);
  const projectAlias = normalizeWhitespace(args.projectAlias);
  const preferredProjectName = projectName || projectAlias || "";
  const normalizedProjectName = normalizeProjectName(preferredProjectName);

  return {
    projectName,
    projectAlias,
    preferredProjectName,
    normalizedProjectName,
  };
}

export function deriveCustomerProjectIdentity(args: {
  customerName?: string | null;
  unitName?: string | null;
  projectName?: string | null;
}) {
  const rawCustomerName = normalizeWhitespace(args.customerName);
  const unitName = normalizeCustomerSourceName(args.unitName);
  const parsedCustomer = splitCustomerEntityName(rawCustomerName);
  const baseCustomerName = unitName || parsedCustomer.baseCustomerName;
  const project = buildProjectNormalization({
    projectName: args.projectName,
    projectAlias: parsedCustomer.projectAlias,
  });

  return {
    rawCustomerName,
    baseCustomerName,
    originalNormalizedCustomerName: parsedCustomer.normalizedOriginalName,
    projectAlias: parsedCustomer.projectAlias,
    bracketContent: parsedCustomer.bracketContent,
    splitKind: parsedCustomer.splitKind,
    projectName: project.projectName,
    normalizedProjectName: project.normalizedProjectName,
    preferredProjectName: project.preferredProjectName,
  };
}
