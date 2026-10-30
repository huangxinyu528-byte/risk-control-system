import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_BASE_URL = "https://zhongchen.netlify.app";

type LedgerProfileForIndex = {
  id: string;
  customerId: string;
  projectId: string | null;
  sheetName: string;
  workbookSource: string | null;
  customerName: string;
  projectName: string | null;
  settlementClause: string | null;
  contractUnpaidTotal: Prisma.Decimal | null;
  uninvoicedTotal: Prisma.Decimal | null;
  extraSummary: unknown;
  rows: Array<{
    id: string;
    rowOrder: number;
    statementDate: string | null;
    quantity: Prisma.Decimal | null;
    statementAmount: Prisma.Decimal | null;
    contractReceivable: Prisma.Decimal | null;
    receivedDate: string | null;
    receivedAmount: Prisma.Decimal | null;
    cumulativeReceivable: Prisma.Decimal | null;
    invoiceDate: string | null;
    invoiceQuantity: Prisma.Decimal | null;
    invoiceAmount: Prisma.Decimal | null;
    remark: string | null;
    extraFields: unknown;
  }>;
};

type DocumentChunkRow = {
  id: string;
  source_id: string;
  customer_id: string | null;
  project_id: string | null;
  profile_id: string | null;
  row_id: string | null;
  chunk_type: string;
  chunk_text: string;
  source_text: string;
  sheet_name: string | null;
  row_order: number | null;
  metadata: Prisma.JsonValue | null;
  customer_name: string | null;
  customer_code: string | null;
  project_name: string | null;
  title: string;
  file_name: string | null;
};

function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 24)}`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function compactLine(parts: Array<[string, unknown]>) {
  return parts
    .map(([label, value]) => {
      const text = displayValue(value);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("；");
}

function extractKeywords(query: string) {
  const normalized = query
    .replace(/[?？!！,，.。:：;；()（）[\]【】"'“”‘’]/g, " ")
    .replace(/有没有|是否|请|帮我|查询|查一下|档案|客户|项目|关于|里面|是否有|有没有|是什么|哪些|哪里|继续/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const terms = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const domainTerms = ["担保", "起诉", "诉讼", "下月支付", "付款", "回款", "停工", "逾期", "备注", "信用", "风险"];
  for (const term of domainTerms) {
    if (query.includes(term) && !terms.includes(term)) {
      terms.push(term);
    }
  }

  if (terms.length === 0 && query.trim().length >= 2) {
    terms.push(query.trim());
  }

  return [...new Set(terms)].slice(0, 8);
}

async function resolveCustomerIdFromText(text: string, explicitCustomerId?: string, explicitCustomerName?: string) {
  if (explicitCustomerId) {
    return explicitCustomerId;
  }

  const searchText = explicitCustomerName || text;
  const terms = extractKeywords(searchText);
  if (terms.length === 0) {
    return null;
  }

  const conditions = terms.map((term) => Prisma.sql`name ILIKE ${`%${term}%`}`);
  const customers = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name
    FROM customers
    WHERE ${Prisma.join(conditions, " OR ")}
    ORDER BY length(name) ASC
    LIMIT 1
  `;

  return customers[0]?.id ?? null;
}

function buildProfileChunks(profile: LedgerProfileForIndex) {
  const chunks: Array<{
    id: string;
    rowId: string | null;
    chunkType: string;
    rowOrder: number | null;
    text: string;
    metadata: Record<string, unknown>;
  }> = [];

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

    if (!rowText) {
      continue;
    }

    chunks.push({
      id: stableId("dchunk", `${profile.id}:row:${row.id}`),
      rowId: row.id,
      chunkType: "ledger_row",
      rowOrder: row.rowOrder,
      text: rowText,
      metadata: { profileId: profile.id, rowId: row.id },
    });
  }

  return chunks;
}

export async function rebuildLedgerDocumentIndex() {
  const profiles = (await prisma.customerLedgerProfile.findMany({
    include: {
      rows: {
        orderBy: { rowOrder: "asc" },
      },
    },
    orderBy: [{ customerName: "asc" }, { sheetName: "asc" }],
  })) as LedgerProfileForIndex[];

  const sourceRows: Prisma.DocumentSourceCreateManyInput[] = [];
  const chunkRows: Prisma.DocumentChunkCreateManyInput[] = [];

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
      metadata: {
        workbookSource: profile.workbookSource,
        projectName: profile.projectName,
      } satisfies Prisma.InputJsonObject,
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
        metadata: chunk.metadata as Prisma.InputJsonObject,
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

  return {
    sourceCount: profiles.length,
    chunkCount: chunkRows.length,
  };
}

export async function searchDocumentChunks(args: {
  query: string;
  customerId?: string | null;
  customerName?: string | null;
  limit?: number;
}) {
  const terms = extractKeywords(args.query);
  const customerId = await resolveCustomerIdFromText(args.query, args.customerId ?? undefined, args.customerName ?? undefined);
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);

  if (terms.length === 0) {
    return {
      query: args.query,
      customerId,
      terms,
      total: 0,
      chunks: [],
    };
  }

  const termConditions = terms.map((term) => Prisma.sql`dc.normalized_text ILIKE ${`%${normalizeText(term)}%`}`);
  const whereParts = [Prisma.sql`(${Prisma.join(termConditions, " OR ")})`];
  if (customerId) {
    whereParts.push(Prisma.sql`dc.customer_id = ${customerId}`);
  }

  const rows = await prisma.$queryRaw<DocumentChunkRow[]>`
    SELECT
      dc.id,
      dc.source_id,
      dc.customer_id,
      dc.project_id,
      dc.profile_id,
      dc.row_id,
      dc.chunk_type,
      dc.chunk_text,
      dc.source_text,
      dc.sheet_name,
      dc.row_order,
      dc.metadata,
      c.name AS customer_name,
      c.customer_code AS customer_code,
      p.name AS project_name,
      ds.title,
      ds.file_name
    FROM document_chunks dc
    LEFT JOIN customers c ON c.id = dc.customer_id
    LEFT JOIN projects p ON p.id = dc.project_id
    INNER JOIN document_sources ds ON ds.id = dc.source_id
    WHERE ${Prisma.join(whereParts, " AND ")}
    ORDER BY dc.row_order NULLS FIRST, dc.created_at ASC
    LIMIT ${limit * 5}
  `;

  const scored = rows
    .map((row) => {
      const normalized = normalizeText(row.source_text);
      const score = terms.reduce((sum, term) => sum + (normalized.includes(normalizeText(term)) ? 1 : 0), 0);
      return { row, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    query: args.query,
    customerId,
    terms,
    total: scored.length,
    chunks: scored.map(({ row, score }) => ({
      id: row.id,
      score,
      text: row.chunk_text,
      sourceText: row.source_text,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerCode: row.customer_code,
      projectId: row.project_id,
      projectName: row.project_name,
      profileId: row.profile_id,
      rowId: row.row_id,
      sheetName: row.sheet_name,
      rowOrder: row.row_order,
      sourceTitle: row.title,
      fileName: row.file_name,
      metadata: row.metadata,
    })),
  };
}

function buildShortAnswer(question: string, chunks: Awaited<ReturnType<typeof searchDocumentChunks>>["chunks"]) {
  if (chunks.length === 0) {
    return "当前档案索引中没有找到可引用的依据。请换一个客户名称、项目名称或关键词再查。";
  }

  const top = chunks[0];
  const lowerQuestion = question.toLowerCase();
  if (question.includes("有没有") || question.includes("是否") || lowerQuestion.includes("has")) {
    const positive = chunks.some((chunk) => {
      const text = chunk.sourceText;
      return !/(无|否|没有|暂无)/.test(text);
    });
    return positive
      ? "检索到相关档案片段，当前问题存在可引用依据。请以引用来源为准进一步核对。"
      : "检索到相关档案片段，但未看到明确肯定表述。请以引用来源为准进一步核对。";
  }

  return `检索到 ${chunks.length} 条相关档案片段。最相关内容来自 ${top.customerName ?? "未知客户"}${top.projectName ? ` / ${top.projectName}` : ""}。`;
}

export async function answerDocumentQuestion(args: {
  question: string;
  customerId?: string | null;
  customerName?: string | null;
  limit?: number;
}) {
  const result = await searchDocumentChunks({
    query: args.question,
    customerId: args.customerId,
    customerName: args.customerName,
    limit: args.limit ?? 5,
  });

  return {
    question: args.question,
    answer: buildShortAnswer(args.question, result.chunks),
    citations: result.chunks.map((chunk, index) => ({
      index: index + 1,
      customerName: chunk.customerName,
      customerCode: chunk.customerCode,
      projectName: chunk.projectName,
      sheetName: chunk.sheetName,
      rowOrder: chunk.rowOrder,
      sourceTitle: chunk.sourceTitle,
      fileName: chunk.fileName,
      excerpt: chunk.sourceText.slice(0, 260),
      customerUrl: chunk.customerId ? `${DEFAULT_BASE_URL}/customers/${encodeURIComponent(chunk.customerId)}` : null,
    })),
    search: {
      terms: result.terms,
      total: result.total,
      customerId: result.customerId,
    },
  };
}
