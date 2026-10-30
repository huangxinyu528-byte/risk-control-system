import OpenAI from "openai";
import type { RiskAssistantResponse } from "@/lib/server/ai/risk-assistant-schema";

type AiProvider = "openai" | "deepseek" | "openai-compatible";

type AiRuntimeConfig = {
  provider: AiProvider;
  apiKey: string | null;
  baseURL?: string;
  model: string;
};

type RiskAssistantCompletionInput = {
  systemPrompt: string;
  userPayload: unknown;
  jsonSchema: Record<string, unknown>;
};

function normalizeProvider(value: string | undefined): AiProvider {
  if (value === "deepseek") {
    return "deepseek";
  }

  if (value === "openai-compatible" || value === "compatible") {
    return "openai-compatible";
  }

  return "openai";
}

export function getAiRuntimeConfig(): AiRuntimeConfig {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  const legacyOpenAiKey = process.env.OPENAI_API_KEY;
  const apiKey = process.env.AI_API_KEY || legacyOpenAiKey || null;
  const baseURL = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || defaultBaseUrlForProvider(provider);
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || defaultModelForProvider(provider);

  return {
    provider,
    apiKey,
    baseURL,
    model,
  };
}

export function getConfiguredOpenAIClient() {
  const config = getAiRuntimeConfig();
  const apiKey = config.apiKey;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: config.baseURL,
  });
}

export function getRiskAssistantModel() {
  return getAiRuntimeConfig().model;
}

export function getMissingAiConfigKeys() {
  return ["AI_API_KEY", "AI_MODEL 可选配置", "AI_PROVIDER 可选配置"];
}

export async function createRiskAssistantCompletion(input: RiskAssistantCompletionInput): Promise<RiskAssistantResponse> {
  const client = getConfiguredOpenAIClient();
  const config = getAiRuntimeConfig();
  if (!client) {
    throw new Error("AI_API_KEY is not configured");
  }

  if (config.provider === "openai") {
    const response = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(input.userPayload),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "risk_assistant_response",
          strict: true,
          schema: input.jsonSchema,
        },
      },
    });

    return JSON.parse(response.output_text) as RiskAssistantResponse;
  }

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: `${input.systemPrompt}\n你必须只输出一个可被 JSON.parse 解析的 JSON 对象，不要使用 Markdown 代码块。`,
      },
      {
        role: "user",
        content: JSON.stringify({
          schema: input.jsonSchema,
          payload: input.userPayload,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("AI provider returned an empty response");
  }

  return JSON.parse(content) as RiskAssistantResponse;
}

function defaultModelForProvider(provider: AiProvider) {
  if (provider === "deepseek") {
    return "deepseek-v4-pro";
  }

  return "gpt-5.2";
}

function defaultBaseUrlForProvider(provider: AiProvider) {
  if (provider === "deepseek") {
    return "https://api.deepseek.com";
  }

  return undefined;
}
