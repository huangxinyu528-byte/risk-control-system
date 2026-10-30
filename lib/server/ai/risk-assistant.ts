import { getCustomerFullProfile } from "@/lib/server/data-access";
import { answerDocumentQuestion } from "@/lib/server/document-search";
import {
  createRiskAssistantCompletion,
  getAiRuntimeConfig,
  getConfiguredOpenAIClient,
  getMissingAiConfigKeys,
  getRiskAssistantModel,
} from "@/lib/server/ai/openai-client";
import {
  riskAssistantRequestSchema,
  riskAssistantResponseSchema,
  type RiskAssistantRequest,
  type RiskAssistantResponse,
} from "@/lib/server/ai/risk-assistant-schema";

type DocumentAnswer = Awaited<ReturnType<typeof answerDocumentQuestion>>;

function fallbackWithoutApiKey(args: RiskAssistantRequest, documentAnswer: DocumentAnswer): RiskAssistantResponse {
  const evidence = documentAnswer.citations.map((item) => ({
    sourceType: "excel" as const,
    sourceTitle: item.sourceTitle,
    fileName: item.fileName,
    sheetName: item.sheetName,
    rowNumber: item.rowOrder,
    excerpt: item.excerpt,
  }));

  return {
    conclusion: "当前尚未配置 AI_API_KEY，已先基于系统数据和档案索引返回基础分析。配置 AI 模型接口后会生成更完整的风控判断。",
    riskLevel: "资料不足",
    reasons: args.contextSummary.length ? args.contextSummary : [documentAnswer.answer],
    evidence,
    nextActions: [
      {
        action: "财务对账",
        priority: "中",
        reason: "先核对未收金额、开票、回款和合同口径，避免处置依据不一致。",
        evidenceIndex: evidence.length ? 1 : null,
        requiresHumanConfirmation: true,
      },
      {
        action: "补充资料",
        priority: "中",
        reason: "当前没有 GPT 结构化分析，需补充或确认合同、担保、催收和法务资料。",
        evidenceIndex: null,
        requiresHumanConfirmation: true,
      },
    ],
    missingInfo: getMissingAiConfigKeys(),
    confidence: "低",
    safetyNote: "AI 建议只作为风控辅助，不会自动修改金额、风险等级或处置记录。",
  };
}

function buildSystemPrompt() {
  return [
    "你是众程建材客户风险管理系统的 AI 风控助理。",
    "你的任务是基于系统结构化数据、Excel/Word/PDF 证据、客户档案和风险记录，给出谨慎、可核查的风控分析。",
    "不要编造证据。没有证据时必须写入 missingInfo。",
    "涉及停供、降额、补担保、法务介入、财务对账、业务催收等动作时，必须要求人工确认。",
    "输出必须符合 JSON schema，不要输出额外文本。",
  ].join("\n");
}

function compactCustomerProfile(profile: Awaited<ReturnType<typeof getCustomerFullProfile>>) {
  if (!profile) {
    return null;
  }

  return {
    customer: profile.customer,
    summary: profile.summary,
    risk: profile.risk,
    traceability: profile.traceability,
    topProjects: profile.projects
      .sort((left, right) => right.unpaidAmount - left.unpaidAmount)
      .slice(0, 12)
      .map((project) => ({
        projectName: project.projectName,
        receivableAmount: project.receivableAmount,
        receivedAmount: project.receivedAmount,
        unpaidAmount: project.unpaidAmount,
        businessType: project.businessType,
        timeNode: project.timeNode,
        remark: project.remark,
      })),
  };
}

function buildUserPayload(args: RiskAssistantRequest, profile: Awaited<ReturnType<typeof getCustomerFullProfile>>, documentAnswer: DocumentAnswer) {
  return {
    task: args.task,
    question: args.question,
    pageContext: args.contextSummary,
    customerProfile: compactCustomerProfile(profile),
    documentEvidence: documentAnswer.citations.map((item) => ({
      index: item.index,
      sourceType: "excel",
      sourceTitle: item.sourceTitle,
      fileName: item.fileName,
      sheetName: item.sheetName,
      rowNumber: item.rowOrder,
      excerpt: item.excerpt,
    })),
    retrieval: documentAnswer.search,
  };
}

function responseJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["conclusion", "riskLevel", "reasons", "evidence", "nextActions", "missingInfo", "confidence", "safetyNote"],
    properties: {
      conclusion: { type: "string" },
      riskLevel: { type: "string", enum: ["低风险", "中风险", "高风险", "极高风险", "资料不足"] },
      reasons: { type: "array", items: { type: "string" } },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceType", "sourceTitle", "fileName", "sheetName", "rowNumber", "excerpt"],
          properties: {
            sourceType: { type: "string", enum: ["system", "excel", "word", "pdf", "manual"] },
            sourceTitle: { type: "string" },
            fileName: { type: ["string", "null"] },
            sheetName: { type: ["string", "null"] },
            rowNumber: { type: ["number", "null"] },
            excerpt: { type: "string" },
          },
        },
      },
      nextActions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "priority", "reason", "evidenceIndex", "requiresHumanConfirmation"],
          properties: {
            action: {
              type: "string",
              enum: ["停供", "降额", "补担保", "法务介入", "财务对账", "业务催收", "继续观察", "补充资料"],
            },
            priority: { type: "string", enum: ["高", "中", "低"] },
            reason: { type: "string" },
            evidenceIndex: { type: ["number", "null"] },
            requiresHumanConfirmation: { type: "boolean" },
          },
        },
      },
      missingInfo: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["高", "中", "低"] },
      safetyNote: { type: "string" },
    },
  } as const;
}

export async function runRiskAssistant(input: unknown) {
  const args = riskAssistantRequestSchema.parse(input);
  const [profile, documentAnswer] = await Promise.all([
    args.customerId ? getCustomerFullProfile(args.customerId) : Promise.resolve(null),
    answerDocumentQuestion({
      question: args.question,
      customerId: args.customerId,
      customerName: args.customerName,
      limit: 8,
    }),
  ]);

  const client = getConfiguredOpenAIClient();
  if (!client) {
    return {
      usedModel: null,
      provider: getAiRuntimeConfig().provider,
      aiEnabled: false,
      data: fallbackWithoutApiKey(args, documentAnswer),
    };
  }

  const parsed = riskAssistantResponseSchema.parse(
    await createRiskAssistantCompletion({
      systemPrompt: buildSystemPrompt(),
      userPayload: buildUserPayload(args, profile, documentAnswer),
      jsonSchema: responseJsonSchema(),
    }),
  );

  return {
    usedModel: getRiskAssistantModel(),
    provider: getAiRuntimeConfig().provider,
    aiEnabled: true,
    data: parsed,
  };
}
