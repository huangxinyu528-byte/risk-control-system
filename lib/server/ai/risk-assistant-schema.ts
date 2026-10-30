import { z } from "zod";

export const riskAssistantTaskSchema = z.enum([
  "customer_qa",
  "risk_analysis",
  "collection_advice",
  "evidence_chain",
  "action_suggestion",
]);

export const riskAssistantRequestSchema = z.object({
  task: riskAssistantTaskSchema.default("customer_qa"),
  question: z.string().trim().min(1, "请输入要分析的问题"),
  customerId: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  contextSummary: z.array(z.string()).default([]),
});

export const riskAssistantResponseSchema = z.object({
  conclusion: z.string(),
  riskLevel: z.enum(["低风险", "中风险", "高风险", "极高风险", "资料不足"]),
  reasons: z.array(z.string()),
  evidence: z.array(
    z.object({
      sourceType: z.enum(["system", "excel", "word", "pdf", "manual"]),
      sourceTitle: z.string(),
      fileName: z.string().nullable(),
      sheetName: z.string().nullable(),
      rowNumber: z.number().nullable(),
      excerpt: z.string(),
    }),
  ),
  nextActions: z.array(
    z.object({
      action: z.enum(["停供", "降额", "补担保", "法务介入", "财务对账", "业务催收", "继续观察", "补充资料"]),
      priority: z.enum(["高", "中", "低"]),
      reason: z.string(),
      evidenceIndex: z.number().nullable(),
      requiresHumanConfirmation: z.boolean(),
    }),
  ),
  missingInfo: z.array(z.string()),
  confidence: z.enum(["高", "中", "低"]),
  safetyNote: z.string(),
});

export type RiskAssistantTask = z.infer<typeof riskAssistantTaskSchema>;
export type RiskAssistantRequest = z.infer<typeof riskAssistantRequestSchema>;
export type RiskAssistantResponse = z.infer<typeof riskAssistantResponseSchema>;
