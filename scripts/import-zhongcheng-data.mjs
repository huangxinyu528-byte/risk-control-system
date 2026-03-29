#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

const cwd = process.cwd();
const scriptDir = resolve(cwd, "scripts");
const dataDir = resolve(cwd, "data");
const logsDir = resolve(cwd, "logs", "imports");
const importedDataDir = resolve(dataDir, "imported");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const extractorPath = join(scriptDir, "extract_zhongcheng_excel.py");
const templatePath = join(dataDir, "众程建材客户风险管理系统模板_最终版(2).xlsx");
const receivablePath = join(dataDir, "众程建材应收账款分类表2026.2.28(2)(1).xls");

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function parseJsonPayload() {
  const output = execFileSync("python3", [extractorPath, "--template", templatePath, "--receivable", receivablePath], {
    cwd,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  return JSON.parse(output);
}

function cleanString(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(value) {
  const text = cleanString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toNumberLike(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return String(value);
}

function omitEmpty(source) {
  const next = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function createStats() {
  return {
    customers: { created: 0, updated: 0, skipped: 0, failed: 0 },
    contracts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    accountsReceivable: { created: 0, updated: 0, skipped: 0, failed: 0 },
    riskRecords: { created: 0, updated: 0, skipped: 0, failed: 0 },
    creditScores: { created: 0, updated: 0, skipped: 0, failed: 0 },
  };
}

function buildCustomerCode(sequence) {
  return `KH${String(sequence).padStart(3, "0")}`;
}

function ensurePayloadCustomerCodes(payload) {
  payload.customers = payload.customers.map((item, index) => ({
    ...item,
    customerCode: cleanString(item.customerCode) ?? buildCustomerCode(index + 1),
  }));
  return payload;
}

function scoreLevel(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function riskLevelLabel(level) {
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  return "重大";
}

function riskSourceLabel(source) {
  if (source === "manual") return "人工录入";
  if (source === "system") return "系统计算";
  return "天眼查同步";
}

function contractStatusLabel(status) {
  if (status === "active") return "执行中";
  if (status === "completed") return "已完成";
  if (status === "terminated") return "已终止";
  if (status === "suspended") return "暂停中";
  return "待回款";
}

function amountNumber(value) {
  const normalized = toNumberLike(value);
  return normalized ? Number(normalized) : 0;
}

function dateLabel(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : new Date().toISOString();
}

function dateOnly(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function buildWebsiteDataset(payload) {
  const now = new Date().toISOString();
  const customerCodeMap = new Map(payload.customers.map((item) => [item.customerId, item.customerCode]));
  const customerNameMap = new Map(payload.customers.map((item) => [item.customerId, item.name]));

  const receivables = payload.accountsReceivable.map((item, index) => {
    const amount = amountNumber(item.amount);
    const receivedAmount = amountNumber(item.receivedAmount);
    const unpaidAmount = amountNumber(item.unpaidAmount);
    const monthlyReceivedAmount = amountNumber(item.monthlyReceivedAmount);
    const paymentRate = amount > 0 ? receivedAmount / amount : 0;

    return {
      id: `recv-import-${index + 1}`,
      receivableNo: item.receivableNo,
      customerId: item.customerRef,
      customerCode: customerCodeMap.get(item.customerRef) ?? "",
      customerName: customerNameMap.get(item.customerRef) ?? item.customerRef,
      salesOwnerName: cleanString(item.salesOwnerName) ?? "待分配",
      projectName: cleanString(item.projectName) ?? "待补项目名称",
      amount,
      receivedAmount,
      unpaidAmount,
      monthlyReceivedAmount,
      paymentRate,
      billingPeriodDays: item.billingPeriodDays ?? null,
      dueDate: dateOnly(item.dueDate),
      overdueDays: item.overdueDays ?? null,
      agingBucket: cleanString(item.agingBucket),
      riskStatus: cleanString(item.riskStatus) ?? "待补数据",
      receivableStatus: cleanString(item.receivableStatus) ?? "待跟进",
      createdAt: now,
      updatedAt: now,
    };
  });

  const customerReceivableMap = new Map();
  for (const receivable of receivables) {
    const current = customerReceivableMap.get(receivable.customerId) ?? 0;
    customerReceivableMap.set(receivable.customerId, current + receivable.unpaidAmount);
  }

  const latestScoreMap = new Map();
  for (const item of payload.creditScores) {
    const current = latestScoreMap.get(item.customerRef);
    if (!current || item.scoreMonth > current.scoreMonth) {
      latestScoreMap.set(item.customerRef, item);
    }
  }

  const customers = payload.customers.map((item, index) => {
    const latestScore = latestScoreMap.get(item.customerId);
    return {
      id: `cus-import-${index + 1}`,
      customerId: item.customerId,
      customerCode: item.customerCode,
      name: item.name,
      unifiedSocialCreditCode: cleanString(item.unifiedSocialCreditCode) ?? "",
      industry: cleanString(item.industry) ?? "",
      contactName: cleanString(item.contactName) ?? "",
      contactPhone: cleanString(item.contactPhone) ?? "",
      salesOwnerName: cleanString(item.salesOwnerName) ?? "",
      currentCreditLevel: cleanString(item.currentCreditLevel) ?? cleanString(latestScore?.scoreLevel) ?? "待评估",
      creditLimit: amountNumber(item.creditLimit),
      stopSupply: item.stopSupply ?? false,
      remark: cleanString(item.remark) ?? "",
      createdAt: now,
      updatedAt: now,
      receivableBalance: customerReceivableMap.get(item.customerId) ?? 0,
    };
  });

  const contracts = payload.contracts.map((item, index) => ({
    id: `contract-import-${index + 1}`,
    contractId: cleanString(item.contractBusinessId) ?? item.contractNo,
    customerId: item.customerRef,
    customerCode: customerCodeMap.get(item.customerRef) ?? "",
    customerName: customerNameMap.get(item.customerRef) ?? item.customerRef,
    projectName: cleanString(item.title) ?? "待补项目名称",
    contractNo: item.contractNo,
    amount: amountNumber(item.amount),
    signedAt: dateOnly(item.signedAt),
    billingPeriodDays: item.billingPeriodDays ?? null,
    salesOwnerName: cleanString(item.salesOwnerName) ?? "待分配",
    projectStatus: contractStatusLabel(item.contractStatus),
    remark: cleanString(item.remark) ?? "待补数据",
    createdAt: now,
    updatedAt: now,
  }));

  const risks = payload.riskRecords.map((item, index) => ({
    id: `risk-import-${index + 1}`,
    customerId: item.customerRef,
    customerCode: customerCodeMap.get(item.customerRef) ?? "",
    customerName: customerNameMap.get(item.customerRef) ?? item.customerRef,
    riskType: item.riskType,
    riskTime: dateOnly(item.eventAt || item.detectedAt) ?? now.slice(0, 10),
    riskSource: riskSourceLabel(item.source),
    riskLevel: riskLevelLabel(item.riskLevel),
    handled: item.handled ?? false,
    remark: cleanString(item.remark) ?? cleanString(item.description) ?? "",
    createdAt: now,
    updatedAt: now,
  }));

  const creditScores = payload.creditScores.map((item, index) => {
    const totalScore =
      Number(item.creditRiskScore ?? 0) +
      Number(item.businessRiskScore ?? 0) +
      Number(item.financialRiskScore ?? 0);
    const level = cleanString(item.scoreLevel) ?? scoreLevel(totalScore);
    const scoreDate = `${item.scoreMonth}-01`;
    return {
      id: `score-import-${index + 1}`,
      customerId: item.customerRef,
      customerCode: customerCodeMap.get(item.customerRef) ?? "",
      customerName: customerNameMap.get(item.customerRef) ?? item.customerRef,
      creditRiskScore: Number(item.creditRiskScore ?? 0),
      businessRiskScore: Number(item.businessRiskScore ?? 0),
      financialRiskScore: Number(item.financialRiskScore ?? 0),
      totalScore: Number(item.score ?? totalScore),
      creditLevel: level,
      scoreDate,
      scoreMonth: item.scoreMonth,
      description: cleanString(item.scoreReason) ?? "由导入数据自动生成。",
      keyAttention: item.keyAttention ?? false,
      createdAt: now,
      updatedAt: now,
    };
  });

  const collections = [...receivables]
    .sort((a, b) => b.unpaidAmount - a.unpaidAmount)
    .slice(0, 20)
    .map((item, index) => {
      const customer = customers.find((entry) => entry.customerId === item.customerId);
      return {
        id: `collection-import-${index + 1}`,
        customerId: item.customerId,
        customerCode: customer?.customerCode ?? "",
        customerName: item.customerName,
        unpaidAmount: item.unpaidAmount,
        currentCreditLevel: customer?.currentCreditLevel ?? "待评估",
        maxOverdueDays: item.overdueDays ?? null,
        collectionLevel: cleanString(item.overdueDays) ? "待补数据" : null,
        currentMeasure: "待补数据",
        ownerName: item.salesOwnerName || "待分配",
        followUpStatus: "待跟进",
        handoffToLegal: false,
        openclawSummary: `${item.customerName} 当前未收金额 ${item.unpaidAmount.toFixed(2)} 元，需人工补充催收措施。`,
        createdAt: now,
        updatedAt: now,
      };
    });

  return {
    customers,
    receivables,
    contracts,
    risks,
    creditScores,
    collections,
  };
}

const logLines = [];
const stats = createStats();

function log(level, message, meta = {}) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta, null, 0)}` : ""}`;
  logLines.push(line);
  console.log(line);
}

async function upsertCustomer(prisma, sourceCustomer) {
  const customerData = {
    customerId: sourceCustomer.customerId,
    customerCode: cleanString(sourceCustomer.customerCode),
    name: sourceCustomer.name,
    unifiedSocialCreditCode: cleanString(sourceCustomer.unifiedSocialCreditCode),
    industry: cleanString(sourceCustomer.industry),
    salesOwnerName: cleanString(sourceCustomer.salesOwnerName),
    contactName: cleanString(sourceCustomer.contactName),
    contactPhone: cleanString(sourceCustomer.contactPhone),
    currentCreditLevel: cleanString(sourceCustomer.currentCreditLevel),
    creditLimit: toNumberLike(sourceCustomer.creditLimit),
    stopSupply: sourceCustomer.stopSupply ?? false,
    remark: cleanString(sourceCustomer.remark),
    openclawSummary: cleanString(sourceCustomer.openclawSummary),
  };

  let existing = await prisma.customer.findUnique({
    where: { customerId: sourceCustomer.customerId },
  });

  if (!existing && sourceCustomer.unifiedSocialCreditCode) {
    existing = await prisma.customer.findUnique({
      where: { unifiedSocialCreditCode: sourceCustomer.unifiedSocialCreditCode },
    });
  }

  if (!existing) {
    existing = await prisma.customer.findFirst({
      where: { name: sourceCustomer.name },
    });
  }

  if (!existing) {
    const created = await prisma.customer.create({
      data: {
        customerId: customerData.customerId,
        customerCode: customerData.customerCode,
        name: customerData.name,
        unifiedSocialCreditCode: customerData.unifiedSocialCreditCode,
        industry: customerData.industry,
        salesOwnerName: customerData.salesOwnerName,
        contactName: customerData.contactName,
        contactPhone: customerData.contactPhone,
        currentCreditLevel: customerData.currentCreditLevel,
        creditLimit: customerData.creditLimit,
        stopSupply: customerData.stopSupply,
        remark: customerData.remark,
        openclawSummary: customerData.openclawSummary,
      },
    });
    stats.customers.created += 1;
    return created;
  }

  const updated = await prisma.customer.update({
    where: { id: existing.id },
    data: omitEmpty(customerData),
  });
  stats.customers.updated += 1;
  return updated;
}

async function upsertContract(prisma, sourceContract, customerId) {
  const data = {
    contractNo: sourceContract.contractNo,
    customerId,
    title: sourceContract.title,
    contractBusinessId: cleanString(sourceContract.contractBusinessId),
    contractStatus: sourceContract.contractStatus ?? "active",
    currency: cleanString(sourceContract.currency) ?? "CNY",
    amount: toNumberLike(sourceContract.amount),
    signedAt: toDate(sourceContract.signedAt),
    billingPeriodDays: sourceContract.billingPeriodDays ?? null,
    salesOwnerName: cleanString(sourceContract.salesOwnerName),
    startDate: toDate(sourceContract.startDate),
    endDate: toDate(sourceContract.endDate),
    paymentTerms: cleanString(sourceContract.paymentTerms),
    invoiceRequirement: cleanString(sourceContract.invoiceRequirement),
    remark: cleanString(sourceContract.remark),
    summary: cleanString(sourceContract.summary),
    openclawSummary: cleanString(sourceContract.openclawSummary),
  };

  const existing = await prisma.contract.findUnique({
    where: { contractNo: sourceContract.contractNo },
  });

  if (!existing) {
    const created = await prisma.contract.create({
      data,
    });
    stats.contracts.created += 1;
    return created;
  }

  const updated = await prisma.contract.update({
    where: { id: existing.id },
    data: omitEmpty(data),
  });
  stats.contracts.updated += 1;
  return updated;
}

async function upsertReceivable(prisma, sourceReceivable, customerId, contractId) {
  const data = {
    receivableNo: sourceReceivable.receivableNo,
    customerId,
    contractId,
    projectName: cleanString(sourceReceivable.projectName),
    amount: toNumberLike(sourceReceivable.amount) ?? "0.00",
    receivedAmount: toNumberLike(sourceReceivable.receivedAmount),
    unpaidAmount: toNumberLike(sourceReceivable.unpaidAmount),
    monthlyReceivedAmount: toNumberLike(sourceReceivable.monthlyReceivedAmount),
    salesOwnerName: cleanString(sourceReceivable.salesOwnerName),
    billingPeriodDays: sourceReceivable.billingPeriodDays ?? null,
    dueDate: toDate(sourceReceivable.dueDate),
    overdueDays: sourceReceivable.overdueDays ?? null,
    agingBucket: cleanString(sourceReceivable.agingBucket),
    collectionLevel: cleanString(sourceReceivable.collectionLevel),
    riskStatus: cleanString(sourceReceivable.riskStatus),
    receivableStatus: cleanString(sourceReceivable.receivableStatus) ?? "pending",
    lastCollectionAt: toDate(sourceReceivable.lastCollectionAt),
    expectedPaymentDate: toDate(sourceReceivable.expectedPaymentDate),
    openclawSummary: cleanString(sourceReceivable.openclawSummary),
    receivableSnapshot: sourceReceivable.receivableSnapshot ?? undefined,
  };

  const existing = await prisma.accountReceivable.findUnique({
    where: { receivableNo: sourceReceivable.receivableNo },
  });

  if (!existing) {
    const created = await prisma.accountReceivable.create({
      data,
    });
    stats.accountsReceivable.created += 1;
    return created;
  }

  const updated = await prisma.accountReceivable.update({
    where: { id: existing.id },
    data: omitEmpty(data),
  });
  stats.accountsReceivable.updated += 1;
  return updated;
}

async function upsertRisk(prisma, sourceRisk, customerId) {
  const data = {
    riskCode: cleanString(sourceRisk.riskCode),
    customerId,
    riskType: sourceRisk.riskType,
    riskLevel: sourceRisk.riskLevel ?? "high",
    source: sourceRisk.source ?? "system",
    title: sourceRisk.title,
    description: cleanString(sourceRisk.description),
    handled: sourceRisk.handled ?? false,
    eventAt: toDate(sourceRisk.eventAt),
    detectedAt: toDate(sourceRisk.detectedAt),
    resolvedAt: toDate(sourceRisk.resolvedAt),
    status: cleanString(sourceRisk.status) ?? "open",
    sourceDetail: cleanString(sourceRisk.sourceDetail),
    remark: cleanString(sourceRisk.remark),
    openclawSummary: cleanString(sourceRisk.openclawSummary),
    payload: sourceRisk.payload ?? undefined,
  };

  if (!data.riskCode) {
    stats.riskRecords.skipped += 1;
    return null;
  }

  const existing = await prisma.riskRecord.findUnique({
    where: { riskCode: data.riskCode },
  });

  if (!existing) {
    const created = await prisma.riskRecord.create({
      data,
    });
    stats.riskRecords.created += 1;
    return created;
  }

  const updated = await prisma.riskRecord.update({
    where: { id: existing.id },
    data: omitEmpty(data),
  });
  stats.riskRecords.updated += 1;
  return updated;
}

async function upsertCreditScore(prisma, sourceScore, customerId) {
  const data = {
    customerId,
    scoreMonth: sourceScore.scoreMonth,
    creditRiskScore: sourceScore.creditRiskScore ?? 0,
    businessRiskScore: sourceScore.businessRiskScore ?? 0,
    financialRiskScore: sourceScore.financialRiskScore ?? 0,
    score: sourceScore.score ?? 0,
    scoreLevel: cleanString(sourceScore.scoreLevel),
    scoreVersion: cleanString(sourceScore.scoreVersion) ?? "import-v1",
    scoreReason: cleanString(sourceScore.scoreReason),
    keyAttention: sourceScore.keyAttention ?? false,
    riskFlags: sourceScore.riskFlags ?? undefined,
    openclawSummary: cleanString(sourceScore.openclawSummary),
  };

  const existing = await prisma.creditScore.findUnique({
    where: {
      customerId_scoreMonth: {
        customerId,
        scoreMonth: sourceScore.scoreMonth,
      },
    },
  });

  if (!existing) {
    const created = await prisma.creditScore.create({
      data,
    });
    stats.creditScores.created += 1;
    return created;
  }

  const updated = await prisma.creditScore.update({
    where: { id: existing.id },
    data: omitEmpty(data),
  });
  stats.creditScores.updated += 1;
  return updated;
}

async function runImport() {
  ensureDir(logsDir);
  ensureDir(importedDataDir);
  const stamp = nowStamp();
  const payload = ensurePayloadCustomerCodes(parseJsonPayload());
  const websiteDataset = buildWebsiteDataset(payload);
  const payloadPath = join(logsDir, `zhongcheng-import-payload-${stamp}.json`);
  const summaryPath = join(logsDir, `zhongcheng-import-summary-${stamp}.json`);
  const logPath = join(logsDir, `zhongcheng-import-${stamp}.log`);
  const websiteDatasetPath = join(importedDataDir, "zhongcheng-development-dataset.json");

  writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf-8");
  writeFileSync(websiteDatasetPath, JSON.stringify(websiteDataset, null, 2), "utf-8");
  log("INFO", "结构化提取完成", {
    payloadPath,
    websiteDatasetPath,
    summary: payload.summary,
    dryRun,
  });

  if (dryRun) {
    const drySummary = {
      dryRun: true,
      extractedAt: new Date().toISOString(),
      extractorSummary: payload.summary,
      meta: payload.meta,
      websiteDataset: {
        customers: websiteDataset.customers.length,
        contracts: websiteDataset.contracts.length,
        receivables: websiteDataset.receivables.length,
        risks: websiteDataset.risks.length,
        creditScores: websiteDataset.creditScores.length,
        collections: websiteDataset.collections.length,
      },
      stats,
      artifacts: {
        payloadPath,
        summaryPath,
        logPath,
        websiteDatasetPath,
      },
    };
    writeFileSync(summaryPath, JSON.stringify(drySummary, null, 2), "utf-8");
    writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf-8");
    return drySummary;
  }

  if (!process.env.DATABASE_URL) {
    const noDbSummary = {
      importedAt: new Date().toISOString(),
      dryRun: false,
      databaseImported: false,
      websiteImported: true,
      reason: "缺少 DATABASE_URL，已仅导入网站开发数据集。",
      extractorSummary: payload.summary,
      meta: payload.meta,
      websiteDataset: {
        customers: websiteDataset.customers.length,
        contracts: websiteDataset.contracts.length,
        receivables: websiteDataset.receivables.length,
        risks: websiteDataset.risks.length,
        creditScores: websiteDataset.creditScores.length,
        collections: websiteDataset.collections.length,
      },
      stats,
      artifacts: {
        payloadPath,
        summaryPath,
        logPath,
        websiteDatasetPath,
      },
    };
    writeFileSync(summaryPath, JSON.stringify(noDbSummary, null, 2), "utf-8");
    writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf-8");
    return noDbSummary;
  }

  const prisma = new PrismaClient();
  const customerMap = new Map();
  const contractMap = new Map();

  try {
    for (const customer of payload.customers) {
      try {
        const saved = await upsertCustomer(prisma, customer);
        customerMap.set(customer.customerId, saved.id);
        customerMap.set(customer.name, saved.id);
      } catch (error) {
        stats.customers.failed += 1;
        log("ERROR", "客户导入失败", { customerId: customer.customerId, name: customer.name, error: error.message });
      }
    }

    for (const contract of payload.contracts) {
      const customerId = customerMap.get(contract.customerRef);
      if (!customerId) {
        stats.contracts.skipped += 1;
        log("WARN", "合同因客户缺失被跳过", { contractNo: contract.contractNo, customerRef: contract.customerRef });
        continue;
      }
      try {
        const saved = await upsertContract(prisma, contract, customerId);
        contractMap.set(contract.contractNo, saved.id);
      } catch (error) {
        stats.contracts.failed += 1;
        log("ERROR", "合同导入失败", { contractNo: contract.contractNo, error: error.message });
      }
    }

    for (const receivable of payload.accountsReceivable) {
      const customerId = customerMap.get(receivable.customerRef);
      if (!customerId) {
        stats.accountsReceivable.skipped += 1;
        log("WARN", "应收记录因客户缺失被跳过", { receivableNo: receivable.receivableNo, customerRef: receivable.customerRef });
        continue;
      }
      try {
        const saved = await upsertReceivable(prisma, receivable, customerId, contractMap.get(receivable.contractRef) ?? null);
        if (receivable.contractRef && !contractMap.get(receivable.contractRef)) {
          log("WARN", "应收记录未找到对应合同，占位导入为独立应收", {
            receivableNo: receivable.receivableNo,
            contractRef: receivable.contractRef,
          });
        }
      } catch (error) {
        stats.accountsReceivable.failed += 1;
        log("ERROR", "应收记录导入失败", { receivableNo: receivable.receivableNo, error: error.message });
      }
    }

    for (const risk of payload.riskRecords) {
      const customerId = customerMap.get(risk.customerRef);
      if (!customerId) {
        stats.riskRecords.skipped += 1;
        log("WARN", "风险记录因客户缺失被跳过", { riskCode: risk.riskCode, customerRef: risk.customerRef });
        continue;
      }
      try {
        await upsertRisk(prisma, risk, customerId);
      } catch (error) {
        stats.riskRecords.failed += 1;
        log("ERROR", "风险记录导入失败", { riskCode: risk.riskCode, error: error.message });
      }
    }

    for (const score of payload.creditScores) {
      const customerId = customerMap.get(score.customerRef);
      if (!customerId) {
        stats.creditScores.skipped += 1;
        log("WARN", "信用评分因客户缺失被跳过", { customerRef: score.customerRef, scoreMonth: score.scoreMonth });
        continue;
      }
      try {
        await upsertCreditScore(prisma, score, customerId);
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            latestCreditScore: score.score,
            latestCreditScoreMonth: score.scoreMonth,
            currentCreditLevel: cleanString(score.scoreLevel),
          },
        });
      } catch (error) {
        stats.creditScores.failed += 1;
        log("ERROR", "信用评分导入失败", {
          customerRef: score.customerRef,
          scoreMonth: score.scoreMonth,
          error: error.message,
        });
      }
    }

    const summary = {
      importedAt: new Date().toISOString(),
      dryRun: false,
      extractorSummary: payload.summary,
      meta: payload.meta,
      stats,
      artifacts: {
        payloadPath,
        summaryPath,
        logPath,
        websiteDatasetPath,
      },
    };

    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf-8");
    log("INFO", "导入完成", { summaryPath, logPath });
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

runImport()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error) => {
    ensureDir(logsDir);
    const failurePath = join(logsDir, `zhongcheng-import-failure-${nowStamp()}.log`);
    const content = `${logLines.join("\n")}\n[${new Date().toISOString()}] [FATAL] ${error.stack || error.message}\n`;
    writeFileSync(failurePath, content, "utf-8");
    console.error(error);
    process.exitCode = 1;
  });
