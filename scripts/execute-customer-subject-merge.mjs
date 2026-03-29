#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_CONFIRMATIONS = new Set([
  "四川昌奕建设工程集团有限公司（清水云庭）",
  "成都永安建设集团有限公司（云龙小学）",
  "成都永安建设集团有限公司（盛世锦都）",
  "成都永安建设集团有限公司（秦皇帝锦）",
  "江西建工第三建筑有限责任公司（环天．青水澜湾）",
  "四川昌奕建设工程集团有限公司（恒大文化旅游城）",
]);

const ALIAS_CONFIRMATIONS = new Set([
  "深圳市赛能达实业发展有限公司（收票单位为：四川展途鑫建材有限公司）",
  "中国水利水电第十四工程局有限公司（十局）",
  "四川良盟建筑工程有限公司（施工二部B1）",
]);

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeBracketText(value) {
  return normalizeWhitespace(value).replace(/（/g, "(").replace(/）/g, ")");
}

function normalizeProjectName(value) {
  return normalizeBracketText(value).replace(/\s+/g, "").replace(/号地块/g, "#地块").trim();
}

function fitDbText(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function chooseMode(row) {
  if (row.suggestedAction === "merge_to_subject_customer") return "project";
  if (PROJECT_CONFIRMATIONS.has(row.currentCustomerName)) return "project";
  if (ALIAS_CONFIRMATIONS.has(row.currentCustomerName)) return "alias";
  return "skip";
}

async function ensureTargetCustomer(tx, row, report) {
  let target = await tx.customer.findUnique({
    where: { name: row.proposedBaseCustomerName },
  });

  if (target) {
    return { target, created: false };
  }

  const targetCustomerId = `MERGE-${Buffer.from(row.proposedBaseCustomerName).toString("hex").slice(0, 12).toUpperCase()}`;
  target = await tx.customer.create({
    data: {
      customerId: targetCustomerId,
      name: row.proposedBaseCustomerName,
      normalizedName: row.proposedBaseCustomerName,
      sourceCustomerName: row.proposedBaseCustomerName,
      isMerged: false,
    },
  });
  report.newBaseCustomers.push({
    customerName: target.name,
    customerId: target.customerId,
    createdFrom: row.currentCustomerName,
  });
  return { target, created: true };
}

async function findExistingTargetProject(tx, targetCustomerId, projectName, normalizedProjectName) {
  if (projectName) {
    const exact = await tx.project.findFirst({
      where: { customerId: targetCustomerId, name: projectName },
    });
    if (exact) return exact;
  }
  if (normalizedProjectName) {
    const normalized = await tx.project.findFirst({
      where: { customerId: targetCustomerId, normalizedProjectName },
    });
    if (normalized) return normalized;
  }
  return null;
}

async function ensureTargetProject(tx, args) {
  const existing = await findExistingTargetProject(
    tx,
    args.targetCustomerId,
    args.projectName,
    args.normalizedProjectName,
  );
  if (existing) {
    return existing;
  }

  return tx.project.create({
    data: {
      customerId: args.targetCustomerId,
      name: args.projectName || args.projectAlias || "未归类项目",
      normalizedProjectName: args.normalizedProjectName || null,
      projectAlias: fitDbText(args.projectAlias, 200),
      sourceCustomerName: fitDbText(args.sourceCustomerName, 200),
      derivedFromCustomerName: Boolean(args.projectAlias),
      status: "进行中",
      remark: args.remark || null,
    },
  });
}

async function moveProjectOwnership(tx, sourceProject, targetCustomerId, row, mode) {
  const desiredName =
    normalizeWhitespace(sourceProject.name) ||
    (mode === "project" ? normalizeWhitespace(row.bracketContent) : "") ||
    "未归类项目";
  const normalizedProject = normalizeProjectName(desiredName);

  try {
    return await tx.project.update({
      where: { id: sourceProject.id },
      data: {
        customerId: targetCustomerId,
        normalizedProjectName: fitDbText(normalizedProject, 200),
        projectAlias: mode === "project" ? fitDbText(row.bracketContent, 200) : sourceProject.projectAlias,
        sourceCustomerName: fitDbText(row.currentCustomerName, 200),
        derivedFromCustomerName: mode === "project" ? true : sourceProject.derivedFromCustomerName,
      },
    });
  } catch {
    const fallbackName =
      mode === "project" && normalizeWhitespace(row.bracketContent) && normalizeWhitespace(row.bracketContent) !== desiredName
        ? normalizeWhitespace(row.bracketContent)
        : `${desiredName}（原项目化客户）`;
    const fallbackNormalized = normalizeProjectName(fallbackName);
    return tx.project.update({
      where: { id: sourceProject.id },
      data: {
        customerId: targetCustomerId,
        name: fallbackName,
        normalizedProjectName: fitDbText(fallbackNormalized, 200),
        projectAlias: mode === "project" ? fitDbText(row.bracketContent, 200) : sourceProject.projectAlias,
        sourceCustomerName: fitDbText(row.currentCustomerName, 200),
        derivedFromCustomerName: mode === "project" ? true : sourceProject.derivedFromCustomerName,
      },
    });
  }
}

async function moveProjectChildren(tx, args) {
  let receivables = 0;
  const sourceReceivables = await tx.accountReceivable.findMany({
    where: {
      customerId: args.sourceCustomerId,
      projectId: args.sourceProjectId,
    },
  });

  for (const receivable of sourceReceivables) {
    const targetReceivable = await tx.accountReceivable.findFirst({
      where: {
        customerId: args.targetCustomerId,
        projectId: args.targetProjectId,
      },
    });

    if (targetReceivable) {
      await tx.accountReceivable.update({
        where: { id: targetReceivable.id },
        data: {
          amount: Number(targetReceivable.amount) + Number(receivable.amount),
          contractReceivable:
            Number(targetReceivable.contractReceivable ?? 0) + Number(receivable.contractReceivable ?? 0),
          cumulativeReceivable:
            Number(targetReceivable.cumulativeReceivable ?? 0) + Number(receivable.cumulativeReceivable ?? 0),
          receivedAmount:
            Number(targetReceivable.receivedAmount ?? 0) + Number(receivable.receivedAmount ?? 0),
          unpaidAmount: Number(targetReceivable.unpaidAmount ?? 0) + Number(receivable.unpaidAmount ?? 0),
          monthlyReceivedAmount:
            Number(targetReceivable.monthlyReceivedAmount ?? 0) + Number(receivable.monthlyReceivedAmount ?? 0),
          remark: [targetReceivable.remark, receivable.remark].filter(Boolean).join("；"),
          extraFields: {
            ...((targetReceivable.extraFields ?? {}) || {}),
            ...((receivable.extraFields ?? {}) || {}),
          },
        },
      });
      receivables += 1;
      continue;
    }

    await tx.accountReceivable.update({
      where: { id: receivable.id },
      data: {
        customerId: args.targetCustomerId,
        projectId: args.targetProjectId,
      },
    });
    receivables += 1;
  }

  const riskUpdates = await tx.riskRecord.updateMany({
    where: {
      customerId: args.sourceCustomerId,
      projectId: args.sourceProjectId,
    },
    data: {
      customerId: args.targetCustomerId,
      projectId: args.targetProjectId,
    },
  });

  let ledgerProfiles = 0;
  const sourceProfiles = await tx.customerLedgerProfile.findMany({
    where: {
      customerId: args.sourceCustomerId,
      projectId: args.sourceProjectId,
    },
  });

  for (const profile of sourceProfiles) {
    const existing = await tx.customerLedgerProfile.findFirst({
      where: {
        customerId: args.targetCustomerId,
        sheetName: profile.sheetName,
      },
    });
    const nextSheetName =
      existing && existing.id !== profile.id
        ? `${profile.sheetName}-merged-${profile.id.slice(0, 6)}`
        : profile.sheetName;

    await tx.customerLedgerProfile.update({
      where: { id: profile.id },
      data: {
        customerId: args.targetCustomerId,
        projectId: args.targetProjectId,
        sheetName: nextSheetName,
      },
    });
    ledgerProfiles += 1;
  }

  return {
    receivables,
    risks: riskUpdates.count,
    ledgerProfiles,
  };
}

async function main() {
  const mappingPath = path.join(process.cwd(), "reports", "customer_subject_merge_map_2026-03-26.json");
  const mappingData = JSON.parse(await fs.readFile(mappingPath, "utf8"));
  const candidates = mappingData.mappings.filter((item) => item.shouldMergeToBaseCustomer);

  const report = {
    generatedAt: new Date().toISOString(),
    newBaseCustomers: [],
    mergedCustomers: [],
    counts: {
      projectsMoved: 0,
      receivablesMoved: 0,
      risksMoved: 0,
      ledgerProfilesMoved: 0,
      mappingsCreated: 0,
    },
    skippedCustomers: [],
  };

  for (const row of candidates) {
    const mode = chooseMode(row);
    if (mode === "skip") {
      report.skippedCustomers.push({
        currentCustomerName: row.currentCustomerName,
        reason: "未在确认名单中，保守跳过",
      });
      continue;
    }

    const sourceCustomer = await prisma.customer.findFirst({
      where: { customerId: row.currentCustomerId },
      include: {
        projects: true,
      },
    });
    if (!sourceCustomer) {
      report.skippedCustomers.push({
        currentCustomerName: row.currentCustomerName,
        reason: "源客户不存在",
      });
      continue;
    }

    if (sourceCustomer.isMerged) {
      report.skippedCustomers.push({
        currentCustomerName: row.currentCustomerName,
        reason: "已归并，跳过重复执行",
      });
      continue;
    }

    const { target } = await ensureTargetCustomer(prisma, row, report);

    const sourceProjects = await prisma.project.findMany({
      where: { customerId: sourceCustomer.id },
      orderBy: { updatedAt: "desc" },
    });

    let fallbackTargetProject = null;
    if (mode === "project" && row.bracketContent) {
      fallbackTargetProject = await ensureTargetProject(prisma, {
        targetCustomerId: target.id,
        projectName: normalizeWhitespace(row.bracketContent),
        normalizedProjectName: normalizeProjectName(row.bracketContent),
        projectAlias: row.bracketContent,
        sourceCustomerName: row.currentCustomerName,
        remark: "由项目化客户归并生成",
      });
    }

    for (const sourceProject of sourceProjects) {
      const desiredName =
        normalizeWhitespace(sourceProject.name) ||
        (mode === "project" ? normalizeWhitespace(row.bracketContent) : "") ||
        "未归类项目";
      const normalizedProject = normalizeProjectName(desiredName);
      const existingTargetProject = await findExistingTargetProject(
        prisma,
        target.id,
        desiredName,
        normalizedProject,
      );

      if (existingTargetProject && existingTargetProject.id !== sourceProject.id) {
        const moved = await moveProjectChildren(prisma, {
          sourceCustomerId: sourceCustomer.id,
          sourceProjectId: sourceProject.id,
          targetCustomerId: target.id,
          targetProjectId: existingTargetProject.id,
        });
        report.counts.receivablesMoved += moved.receivables;
        report.counts.risksMoved += moved.risks;
        report.counts.ledgerProfilesMoved += moved.ledgerProfiles;

        await prisma.project.update({
          where: { id: sourceProject.id },
          data: {
            remark: [sourceProject.remark, `已归并到主体客户项目：${existingTargetProject.name}`]
              .filter(Boolean)
              .join("；"),
            sourceCustomerName: fitDbText(row.currentCustomerName, 200),
            derivedFromCustomerName: true,
          },
        });
        continue;
      }

      const movedProject = await moveProjectOwnership(prisma, sourceProject, target.id, row, mode);
      report.counts.projectsMoved += 1;
      const moved = await moveProjectChildren(prisma, {
        sourceCustomerId: sourceCustomer.id,
        sourceProjectId: sourceProject.id,
        targetCustomerId: target.id,
        targetProjectId: movedProject.id,
      });
      report.counts.receivablesMoved += moved.receivables;
      report.counts.risksMoved += moved.risks;
      report.counts.ledgerProfilesMoved += moved.ledgerProfiles;
    }

    const looseReceivables = await prisma.accountReceivable.findMany({
      where: { customerId: sourceCustomer.id, projectId: null },
    });
    for (const receivable of looseReceivables) {
      if (fallbackTargetProject) {
        const targetReceivable = await prisma.accountReceivable.findFirst({
          where: { customerId: target.id, projectId: fallbackTargetProject.id },
        });
        if (targetReceivable) {
          await prisma.accountReceivable.update({
            where: { id: targetReceivable.id },
            data: {
              amount: Number(targetReceivable.amount) + Number(receivable.amount),
              contractReceivable:
                Number(targetReceivable.contractReceivable ?? 0) + Number(receivable.contractReceivable ?? 0),
              cumulativeReceivable:
                Number(targetReceivable.cumulativeReceivable ?? 0) + Number(receivable.cumulativeReceivable ?? 0),
              receivedAmount:
                Number(targetReceivable.receivedAmount ?? 0) + Number(receivable.receivedAmount ?? 0),
              unpaidAmount: Number(targetReceivable.unpaidAmount ?? 0) + Number(receivable.unpaidAmount ?? 0),
              monthlyReceivedAmount:
                Number(targetReceivable.monthlyReceivedAmount ?? 0) + Number(receivable.monthlyReceivedAmount ?? 0),
              remark: [targetReceivable.remark, receivable.remark].filter(Boolean).join("；"),
              extraFields: {
                ...((targetReceivable.extraFields ?? {}) || {}),
                ...((receivable.extraFields ?? {}) || {}),
              },
            },
          });
          report.counts.receivablesMoved += 1;
          continue;
        }
      }

      await prisma.accountReceivable.update({
        where: { id: receivable.id },
        data: {
          customerId: target.id,
          projectId: fallbackTargetProject?.id ?? undefined,
        },
      });
      report.counts.receivablesMoved += 1;
    }

    const riskUpdates = await prisma.riskRecord.updateMany({
      where: { customerId: sourceCustomer.id, projectId: null },
      data: {
        customerId: target.id,
        projectId: fallbackTargetProject?.id ?? undefined,
      },
    });
    report.counts.risksMoved += riskUpdates.count;

    const looseProfiles = await prisma.customerLedgerProfile.findMany({
      where: { customerId: sourceCustomer.id, projectId: null },
    });
    for (const profile of looseProfiles) {
      const existing = await prisma.customerLedgerProfile.findFirst({
        where: { customerId: target.id, sheetName: profile.sheetName },
      });
      const nextSheetName =
        existing && existing.id !== profile.id
          ? `${profile.sheetName}-merged-${profile.id.slice(0, 6)}`
          : profile.sheetName;
      await prisma.customerLedgerProfile.update({
        where: { id: profile.id },
        data: {
          customerId: target.id,
          projectId: fallbackTargetProject?.id ?? undefined,
          sheetName: nextSheetName,
        },
      });
      report.counts.ledgerProfilesMoved += 1;
    }

    const mapping = await prisma.customerMergeMapping.upsert({
      where: { sourceCustomerId: sourceCustomer.id },
      update: {
        targetCustomerId: target.id,
        targetCustomerName: target.name,
        projectAlias: fitDbText(mode === "project" ? row.bracketContent : null, 200),
        splitKind: row.splitKind,
        suggestedAction: row.suggestedAction,
        originalSourceName: row.traceability?.originalSourceName ?? row.currentCustomerName,
        status: "applied",
        notes: mode === "alias" ? "按别名/备注保留，不自动转项目名" : "按项目归并",
      },
      create: {
        sourceCustomerId: sourceCustomer.id,
        targetCustomerId: target.id,
        sourceCustomerName: sourceCustomer.name,
        targetCustomerName: target.name,
        projectAlias: fitDbText(mode === "project" ? row.bracketContent : null, 200),
        splitKind: row.splitKind,
        suggestedAction: row.suggestedAction,
        originalSourceName: row.traceability?.originalSourceName ?? row.currentCustomerName,
        status: "applied",
        notes: mode === "alias" ? "按别名/备注保留，不自动转项目名" : "按项目归并",
      },
    });
    if (mapping) {
      report.counts.mappingsCreated += 1;
    }

    await prisma.customer.update({
      where: { id: sourceCustomer.id },
      data: {
        normalizedName: fitDbText(row.proposedBaseCustomerName, 200),
        sourceCustomerName: fitDbText(sourceCustomer.name, 200),
        isMerged: true,
        mergedIntoCustomerId: target.id,
      },
    });

    await prisma.customer.update({
      where: { id: target.id },
      data: {
        normalizedName: fitDbText(row.proposedBaseCustomerName, 200),
        sourceCustomerName: fitDbText(target.sourceCustomerName ?? target.name, 200),
      },
    });

    report.mergedCustomers.push({
      currentCustomerName: row.currentCustomerName,
      currentCustomerId: row.currentCustomerId,
      targetCustomerName: target.name,
      targetCustomerId: target.customerId,
      mode,
      bracketContent: row.bracketContent,
    });
  }

  const reportsDir = path.join(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, "customer_subject_merge_execution_2026-03-26.json");
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ outputPath, summary: report.counts, mergedCustomers: report.mergedCustomers.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
