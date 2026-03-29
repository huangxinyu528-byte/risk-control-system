#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

const ALIAS_ONLY_KEYWORDS = ["分公司", "子公司", "十局", "自运", "汇总"];

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBracketText(value) {
  return value.replace(/（/g, "(").replace(/）/g, ")");
}

function normalizeCustomerSourceName(value) {
  return normalizeBracketText(normalizeWhitespace(value)).replace(/\s*汇总\s*$/, "").trim();
}

function normalizeProjectName(value) {
  return normalizeBracketText(normalizeWhitespace(value))
    .replace(/\s+/g, "")
    .replace(/号地块/g, "#地块")
    .trim();
}

function includesAnyKeyword(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function classifyBracketContent(value) {
  const normalized = normalizeBracketText(normalizeWhitespace(value));
  if (!normalized) return "none";
  if (includesAnyKeyword(normalized, PROJECT_KEYWORDS)) return "project";
  if (includesAnyKeyword(normalized, ALIAS_ONLY_KEYWORDS)) return "alias";
  if (normalized.length <= 2) return "none";
  return "alias";
}

function splitCustomerEntityName(value) {
  const originalName = normalizeWhitespace(value);
  const normalizedOriginalName = normalizeCustomerSourceName(originalName);
  const reasons = [];
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

function buildProjectNormalization(projectName, projectAlias) {
  const preferredProjectName = normalizeWhitespace(projectName) || normalizeWhitespace(projectAlias) || "";
  return {
    preferredProjectName,
    normalizedProjectName: normalizeProjectName(preferredProjectName),
  };
}

async function main() {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customerId: true,
      customerCode: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          projects: true,
          accountsReceivable: true,
          ledgerProfiles: true,
          riskRecords: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const baseNameSet = new Set(customers.map((item) => normalizeCustomerSourceName(item.name)));
  const mappings = customers.map((customer) => {
    const parsed = splitCustomerEntityName(customer.name);
    const project = buildProjectNormalization(null, parsed.projectAlias);
    const targetSubjectExists = baseNameSet.has(parsed.baseCustomerName);
    const action =
      parsed.splitKind === "project"
        ? "merge_to_subject_customer"
        : parsed.splitKind === "alias"
          ? "review_alias_before_merge"
          : "keep_as_subject_customer";

    return {
      currentCustomerName: customer.name,
      currentCustomerId: customer.customerId,
      currentCustomerCode: customer.customerCode,
      normalizedOriginalName: parsed.normalizedOriginalName,
      proposedBaseCustomerName: parsed.baseCustomerName,
      bracketContent: parsed.bracketContent,
      splitKind: parsed.splitKind,
      projectAlias: parsed.projectAlias,
      normalizedProjectAlias: project.normalizedProjectName || null,
      shouldMergeToBaseCustomer: parsed.shouldMergeToBaseCustomer,
      targetSubjectExists,
      suggestedAction: action,
      traceability: {
        originalSourceName: customer.name,
        keepSourceReference: true,
      },
      impactPreview: {
        projectCount: customer._count.projects,
        receivableCount: customer._count.accountsReceivable,
        ledgerProfileCount: customer._count.ledgerProfiles,
        riskCount: customer._count.riskRecords,
      },
      reasons: parsed.reasons,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalCustomers: mappings.length,
    splitProjectCount: mappings.filter((item) => item.splitKind === "project").length,
    aliasOnlyCount: mappings.filter((item) => item.splitKind === "alias").length,
    noSplitCount: mappings.filter((item) => item.splitKind === "none").length,
    mergeCandidateCount: mappings.filter((item) => item.shouldMergeToBaseCustomer).length,
    targetSubjectExistsCount: mappings.filter((item) => item.shouldMergeToBaseCustomer && item.targetSubjectExists).length,
    targetSubjectNeedsCreateCount: mappings.filter((item) => item.shouldMergeToBaseCustomer && !item.targetSubjectExists).length,
  };

  const report = {
    summary,
    examples: mappings.filter((item) => item.shouldMergeToBaseCustomer).slice(0, 30),
    mappings,
  };

  const reportsDir = path.join(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, "customer_subject_merge_map_2026-03-26.json");
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ outputPath, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
