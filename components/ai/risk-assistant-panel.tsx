"use client";

import { useEffect, useRef, useState } from "react";

type Citation = {
  index: number;
  sourceType?: "system" | "excel" | "word" | "pdf" | "manual";
  sourceTitle?: string | null;
  fileName?: string | null;
  sheetName?: string | null;
  rowOrder?: number | null;
  rowNumber?: number | null;
  excerpt?: string | null;
};

type NextAction = {
  action: string;
  priority: "高" | "中" | "低";
  reason: string;
  evidenceIndex: number | null;
  requiresHumanConfirmation: boolean;
};

type AssistantAnswer = {
  conclusion: string;
  riskLevel?: "低风险" | "中风险" | "高风险" | "极高风险" | "资料不足";
  reasons: string[];
  evidence: Citation[];
  actions: string[];
  nextActions?: NextAction[];
  missingInfo?: string[];
  confidence?: "高" | "中" | "低";
  requiresHumanConfirmation: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  answer?: AssistantAnswer;
};

type Props = {
  title?: string;
  contextLabel: string;
  contextSummary: string[];
  customerId?: string;
  customerName?: string;
  onCustomerDataChanged?: () => void | Promise<void>;
};

function buildContextAnswer(question: string, contextSummary: string[]): AssistantAnswer {
  return {
    conclusion: question.trim()
      ? "已基于当前页面数据生成风控助理答复。"
      : "请先输入要查询的风控问题。",
    reasons: contextSummary.length ? contextSummary : ["当前页面没有足够上下文，需要进入客户或项目详情继续核查。"],
    evidence: [],
    actions: ["优先核查高风险对象", "结合原始账款档案确认金额和回款记录", "涉及处置动作时先由人工确认"],
    requiresHumanConfirmation: true,
  };
}

export function RiskAssistantPanel({
  title = "AI 风控助理",
  contextLabel,
  contextSummary,
  customerId,
  customerName,
  onCustomerDataChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [modeMessage, setModeMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  function createMessage(role: ChatMessage["role"], text: string, answer?: AssistantAnswer): ChatMessage {
    return {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      text,
      answer,
    };
  }

  async function askWithQuestion(rawQuestion: string) {
    const normalizedQuestion = rawQuestion.trim();
    if (!normalizedQuestion) {
      setMessages((current) => [
        ...current,
        createMessage("assistant", "先输入一个风控问题，我再基于客户档案回答。", buildContextAnswer("", contextSummary)),
      ]);
      return;
    }

    setLoading(true);
    setMessage("");
    setQuestion("");
    setMessages((current) => [...current, createMessage("user", normalizedQuestion)]);
    try {
      const response = await fetch("/api/ai/risk-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: "customer_qa",
          question: normalizedQuestion,
          customerId,
          customerName,
          contextSummary,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "AI 风控助理查询失败");
      }

      const data = result.data;
      setModeMessage(
        result.aiEnabled
          ? `AI 模式：${result.provider ?? "openai"} / ${result.usedModel}`
          : "基础分析模式：配置 AI_API_KEY 后启用 AI 模型",
      );
      const assistantAnswer: AssistantAnswer = {
        conclusion: data.conclusion,
        riskLevel: data.riskLevel,
        reasons: data.reasons ?? [],
        evidence: data.evidence ?? [],
        actions: (data.nextActions ?? []).map((item: NextAction) => `${item.action}（${item.priority}）`),
        nextActions: data.nextActions ?? [],
        missingInfo: data.missingInfo ?? [],
        confidence: data.confidence,
        requiresHumanConfirmation: true,
      };
      setMessages((current) => [...current, createMessage("assistant", assistantAnswer.conclusion, assistantAnswer)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 风控助理查询失败");
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    await askWithQuestion(question);
  }

  async function runAnalysis(template: string) {
    setQuestion(template);
    await askWithQuestion(template);
  }

  async function handleFileSelected(file: File | undefined) {
    setUploadMessage("");
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!customerId) {
      setUploadMessage("请先进入具体客户档案页，再上传文件更新客户数据。");
      return;
    }

    if (["doc", "docx"].includes(extension)) {
      setUploadMessage("Word 档案已识别；当前项目尚未接入 Word 解析入库接口，接入 GPT API 后再自动抽取证据并更新档案。");
      return;
    }

    if (!["xlsx", "xls"].includes(extension)) {
      setUploadMessage("当前支持 Excel（.xls/.xlsx）上传；Word 会在解析接口接入后开放自动更新。");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("customerId", customerId);
      const response = await fetch("/api/import/excel", { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Excel 导入失败");
      }

      const summary = result.data?.summary;
      setUploadMessage(
        summary
          ? `Excel 已导入并更新：客户 ${summary.customers} 条，项目 ${summary.projects} 条，应收 ${summary.receivables} 条，风险 ${summary.risks} 条。`
          : "Excel 已导入并按现有规则更新客户数据。",
      );
      setMessages((current) => [...current, createMessage("system", "文件已上传，客户数据已按现有规则更新。")]);
      await onCustomerDataChanged?.();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Excel 导入失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="ai-assistant">
      {open ? (
        <aside className="ai-assistant-panel" role="dialog" aria-label={title}>
          <div className="ai-assistant-header">
            <div>
              <h3>{title}</h3>
              <span>{contextLabel}</span>
            </div>
            <button className="button button-secondary button-small" type="button" onClick={() => setOpen(false)}>
              收起
            </button>
          </div>

          <div className="ai-assistant-body">
            <div className="ai-assistant-quick-actions">
              <button
                className="ai-chip"
                type="button"
                onClick={() => void runAnalysis("分析这个客户当前最主要的风控风险，按金额、逾期、合同、回款证据分别说明。")}
              >
                风险归因
              </button>
              <button
                className="ai-chip"
                type="button"
                onClick={() => void runAnalysis("基于当前客户档案，给出催收建议、下一步负责人动作和需要补充的证据。")}
              >
                催收建议
              </button>
              <button
                className="ai-chip"
                type="button"
                onClick={() => void runAnalysis("列出当前客户风险判断所依据的证据链，包含来源、sheet、行号和可核查摘录。")}
              >
                证据链
              </button>
            </div>

            <div className="ai-chat">
              {messages.length ? (
                messages.map((item) => (
                  <article className={`ai-message ai-message-${item.role}`} key={item.id}>
                    <div className="ai-message-bubble">
                      <p>{item.text}</p>
                      {item.answer ? (
                        <div className="ai-answer-compact">
                          <div className="ai-answer-meta">
                            {item.answer.riskLevel ? <span>{item.answer.riskLevel}</span> : null}
                            <span>置信度：{item.answer.confidence ?? "待评估"}</span>
                            <span>人工确认：{item.answer.requiresHumanConfirmation ? "需要" : "不需要"}</span>
                          </div>
                          {item.answer.actions.length ? (
                            <div className="ai-action-line">建议：{item.answer.actions.join("、")}</div>
                          ) : null}
                          <details className="ai-answer-details">
                            <summary>查看依据</summary>
                            <div className="detail-note-list">
                              <div><strong>原因：</strong>{item.answer.reasons.join("；") || "当前资料不足"}</div>
                              <div><strong>证据：</strong>{item.answer.evidence.length ? `${item.answer.evidence.length} 条` : "暂无可核查证据"}</div>
                              {item.answer.nextActions?.map((action, index) => (
                                <article className="ai-evidence-item" key={`${action.action}-${index}`}>
                                  <strong>{action.action}</strong>
                                  <span className="muted"> · {action.priority}优先级 · {action.reason}</span>
                                </article>
                              ))}
                              {item.answer.evidence.map((evidence) => (
                                <article className="ai-evidence-item" key={`${evidence.index}-${evidence.sheetName}-${evidence.rowOrder ?? evidence.rowNumber}`}>
                                  <strong>证据 {evidence.index}：</strong>{evidence.sourceTitle || evidence.fileName || "账款档案"}
                                  <div className="muted">
                                    Sheet {evidence.sheetName || "未知"} / 行 {evidence.rowOrder ?? evidence.rowNumber ?? "摘要"}
                                  </div>
                                  <div className="muted">{evidence.excerpt || "无摘录"}</div>
                                </article>
                              ))}
                              {item.answer.missingInfo?.length ? (
                                <div><strong>待补资料：</strong>{item.answer.missingInfo.join("；")}</div>
                              ) : null}
                            </div>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="ai-empty-state">
                  <strong>问我客户风险、催收建议或证据链。</strong>
                  <span>也可以先上传 Excel，系统会更新当前客户数据。</span>
                </div>
              )}
              {loading ? (
                <article className="ai-message ai-message-assistant">
                  <div className="ai-message-bubble">正在分析...</div>
                </article>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            {message ? <div className="ai-inline-note ai-inline-note-error">{message}</div> : null}
            {uploadMessage ? <div className="ai-inline-note">{uploadMessage}</div> : null}
            {modeMessage ? <div className="ai-inline-note">{modeMessage}</div> : null}
          </div>

          <div className="ai-composer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.doc,.docx"
              style={{ display: "none" }}
              onChange={(event) => void handleFileSelected(event.target.files?.[0])}
            />
            <button
              className="ai-upload-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="上传 Excel / Word"
            >
              {uploading ? "..." : "+"}
            </button>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="问客户风险、催收建议、证据链..."
              rows={1}
              className="ai-assistant-input"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask();
                }
              }}
            />
            <button className="ai-send-button" type="button" onClick={() => void ask()} disabled={loading}>
              {loading ? "分析" : "发送"}
            </button>
          </div>
        </aside>
      ) : (
        <button
          className="button button-primary ai-assistant-fab"
          type="button"
          onClick={() => setOpen(true)}
        >
          AI 助理
        </button>
      )}
    </div>
  );
}
