import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function stableId(prefix, value) {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 24)}`;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "object" && typeof value.toString === "function" && value.constructor?.name === "Decimal") {
    return value.toString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function compactLine(parts) {
  return parts
    .map(([label, value]) => {
      const text = displayValue(value);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("；");
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildProfileChunks(profile) {
  const chunks = [];
  const summaryText = compactLine([
    ["客户", profile.customerName],
    ["项目", profile.projectName],
    ["sheet", profile.sheetName],
    ["工作簿", profile.workbookSource],
    ["结算条款", profile.settlementClause],
    ["按合同未收", profile.contractUnpaidTotal],
    ["未制票", profile.uninvoicedTotal],
    ["摘要", profile.extraSummary],
  ]);

  if (summaryText) {
    chunks.push({
      id: stableId("dchunk", `${profile.id}:summary`),
      rowId: null,
      chunkType: "ledger_profile_summary",
      rowOrder: null,
      text: summaryText,
      metadata: { profileId: profile.id },
    });
  }

  for (const row of profile.rows) {
    const rowText = compactLine([
      ["客户", profile.customerName],
      ["项目", profile.projectName],
      ["sheet", profile.sheetName],
      ["行号", row.rowOrder],
      ["对账时间", row.statementDate],
      ["方量", row.quantity],
      ["对账金额", row.statementAmount],
      ["按合同应收", row.contractReceivable],
      ["实际收款时间", row.receivedDate],
      ["实际收款金额", row.receivedAmount],
      ["累计应收", row.cumulativeReceivable],
      ["开票时间", row.invoiceDate],
      ["开票金额", row.invoiceAmount],
      ["备注", row.remark],
      ["其他字段", row.extraFields],
    ]);

    if (rowText) {
      chunks.push({
        id: stableId("dchunk", `${profile.id}:row:${row.id}`),
        rowId: row.id,
        chunkType: "ledger_row",
        rowOrder: row.rowOrder,
        text: rowText,
        metadata: { profileId: profile.id, rowId: row.id },
      });
    }
  }

  return chunks;
}

async function main() {
  const profiles = await prisma.customerLedgerProfile.findMany({
    include: {
      rows: {
        orderBy: { rowOrder: "asc" },
      },
    },
    orderBy: [{ customerName: "asc" }, { sheetName: "asc" }],
  });

  const sourceRows = [];
  const chunkRows = [];

  for (const profile of profiles) {
    const sourceId = stableId("dsrc", `ledger_profile:${profile.id}`);
    const sourceKey = `ledger_profile:${profile.id}`;
    const title = [profile.customerName, profile.projectName, profile.sheetName].filter(Boolean).join(" / ");

    sourceRows.push({
      id: sourceId,
      sourceType: "ledger_profile",
      sourceKey,
      customerId: profile.customerId,
      projectId: profile.projectId,
      profileId: profile.id,
      title,
      fileName: profile.workbookSource,
      sheetName: profile.sheetName,
      metadata: { workbookSource: profile.workbookSource, projectName: profile.projectName },
    });

    for (const chunk of buildProfileChunks(profile)) {
      chunkRows.push({
        id: chunk.id,
        sourceId,
        customerId: profile.customerId,
        projectId: profile.projectId,
        profileId: profile.id,
        rowId: chunk.rowId,
        chunkType: chunk.chunkType,
        chunkText: chunk.text,
        sourceText: chunk.text,
        normalizedText: normalizeText(chunk.text),
        sheetName: profile.sheetName,
        rowOrder: chunk.rowOrder,
        metadata: chunk.metadata,
      });
    }
  }

  await prisma.documentSource.deleteMany({
    where: { sourceType: "ledger_profile" },
  });

  for (const batch of chunkArray(sourceRows, 500)) {
    await prisma.documentSource.createMany({ data: batch });
  }

  for (const batch of chunkArray(chunkRows, 500)) {
    await prisma.documentChunk.createMany({ data: batch });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceCount: profiles.length,
        chunkCount: chunkRows.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
