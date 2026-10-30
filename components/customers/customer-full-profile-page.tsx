"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RiskAssistantPanel } from "@/components/ai/risk-assistant-panel";
import { CustomerLedgerSpreadsheet } from "@/components/customers/customer-ledger-spreadsheet";
import { PageHeader } from "@/components/shared/page-header";
import { displayBaseValue, displayOptionalNote } from "@/lib/display";
import { formatCurrency } from "@/lib/format";
import type { CustomerFullProfileRecord, CustomerLedgerArchiveRecord } from "@/lib/types";

type Props = {
  customerId: string;
  preferredProjectId?: string;
  preferredProjectName?: string;
  preferredSheetName?: string;
};

type RiskActionSuggestion = {
  id: string;
  action: string;
  level: "高" | "中" | "低";
  reason: string;
  evidence: string;
};

export function CustomerFullProfilePage({
  customerId,
  preferredProjectId,
  preferredProjectName,
  preferredSheetName,
}: Props) {
  const [data, setData] = useState<CustomerFullProfileRecord | null>(null);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerArchiveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerMessage, setLedgerMessage] = useState("");
  const [confirmedActions, setConfirmedActions] = useState<Record<string, "confirmed" | "rejected">>({});
  const classifiedArchives = (ledgerData?.archives ?? []).filter((archive) => archive.projectId);
  const unclassifiedArchives = (ledgerData?.archives ?? []).filter((archive) => !archive.projectId);
  const hasGeneratedLedgerArchive = classifiedArchives.some((archive) =>
    archive.workbookSource?.includes("开发环境回退生成"),
  );

  function riskBadgeClass(level: string) {
    if (level.includes("高")) return "status-badge status-danger";
    if (level.includes("中")) return "status-badge status-warning";
    return "status-badge status-normal";
  }

  async function readJsonSafely<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      return null;
    }

    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  const loadCustomerData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResponse, ledgerResponse] = await Promise.all([
        fetch(`/api/customers/${customerId}/full-profile`),
        fetch(`/api/customers/${customerId}/account-ledger-profile`),
      ]);
      const [profileResult, ledgerResult] = await Promise.all([
        readJsonSafely<{ success?: boolean; data?: CustomerFullProfileRecord | null }>(profileResponse),
        readJsonSafely<{ success?: boolean; data?: CustomerLedgerArchiveRecord | null; message?: string }>(ledgerResponse),
      ]);
      setData((profileResult?.data as CustomerFullProfileRecord) ?? null);
      setLedgerData((ledgerResult?.data as CustomerLedgerArchiveRecord) ?? null);
      setLedgerMessage(
        ledgerResult?.message ??
          (!ledgerResponse.ok
            ? "原始账款档案暂时不可用"
            : !(ledgerResult?.data?.archives?.length)
              ? "暂无原始sheet数据"
              : ""),
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomerData();
  }, [loadCustomerData]);

  const actionSuggestions: RiskActionSuggestion[] = (() => {
    const unpaid = data?.summary.totalUnpaid ?? 0;
    const riskConclusion = data?.risk.conclusion ?? "低风险";
    const riskReasons = data?.risk.reasons.length ? data.risk.reasons.join("；") : "当前未发现明显异常";
    const baseEvidence = `未收金额 ${formatCurrency(unpaid)}，风险结论 ${riskConclusion}`;

    if (riskConclusion.includes("高") || unpaid >= 10_000_000) {
      return [
        {
          id: "legal-review",
          action: "法务介入",
          level: "高",
          reason: "风险等级高或未收金额较大，需要提前核查诉讼、函件和保全条件。",
          evidence: `${baseEvidence}；风险原因：${riskReasons}`,
        },
        {
          id: "stop-supply",
          action: "停供建议",
          level: "高",
          reason: "继续供货可能扩大风险暴露，需管理层确认是否暂停新增供货。",
          evidence: baseEvidence,
        },
        {
          id: "guarantee",
          action: "要求补担保",
          level: "中",
          reason: "在继续合作前补充担保或付款承诺，可降低后续回款不确定性。",
          evidence: riskReasons,
        },
        {
          id: "finance-reconcile",
          action: "财务对账",
          level: "中",
          reason: "先确认合同应收、实际收款、开票和未收口径，避免处置依据不一致。",
          evidence: baseEvidence,
        },
      ];
    }

    if (riskConclusion.includes("中") || unpaid > 0) {
      return [
        {
          id: "sales-collection",
          action: "业务负责人催收",
          level: "中",
          reason: "当前仍有未收金额，需要业务负责人确认回款节点和责任人。",
          evidence: baseEvidence,
        },
        {
          id: "finance-reconcile",
          action: "财务对账",
          level: "中",
          reason: "先核对账款和票据状态，再决定是否升级处置。",
          evidence: riskReasons,
        },
        {
          id: "limit-reduction",
          action: "降额建议",
          level: "中",
          reason: "在回款稳定前降低授信或供货额度，控制新增风险暴露。",
          evidence: baseEvidence,
        },
      ];
    }

    return [
      {
        id: "observe",
        action: "继续观察",
        level: "低",
        reason: "当前未发现明显异常，按常规频率跟进即可。",
        evidence: baseEvidence,
      },
    ];
  })();

  return (
    <>
      <PageHeader
        title="客户详情"
        description="关键金额、风险摘要和原始账款档案。"
      />

      <section className="card customer-hero-card">
        <div className="customer-hero-header">
          <div className="customer-hero-main">
            <div className="customer-hero-title-row">
              <h3>{data?.customer.name ?? "客户档案"}</h3>
              <span className={riskBadgeClass(data?.risk.conclusion ?? "低风险")}>
                {data?.risk.conclusion ?? "低风险"}
              </span>
            </div>
            <div className="customer-hero-meta">
              <span>{data?.customer.customerCode || "待生成"}</span>
              <span>{data?.customer.customerId || customerId}</span>
              <span>项目数 {data?.summary.projectCount ?? 0}</span>
            </div>
            {data?.traceability?.mergedSourceNames?.length ? (
              <div className="customer-hero-trace">
                已归并来源：{data.traceability.mergedSourceNames.join("、")}
              </div>
            ) : null}
          </div>

          <div className="customer-hero-actions">
            <Link className="button button-ghost" href="/customers">
              返回客户列表
            </Link>
          </div>
        </div>

        <div className="customer-overview-grid">
          <article className="card quality-card customer-overview-card">
            <strong>总应收</strong>
            <div>{formatCurrency(data?.summary.totalReceivable ?? 0)}</div>
            <span>客户当前已确认的整体应收规模</span>
          </article>
          <article className="card quality-card customer-overview-card">
            <strong>已收金额</strong>
            <div>{formatCurrency(data?.summary.totalReceived ?? 0)}</div>
            <span>当前已回款金额</span>
          </article>
          <article className="card quality-card customer-overview-card customer-overview-card-highlight">
            <strong>未收金额</strong>
            <div>{formatCurrency(data?.summary.totalUnpaid ?? 0)}</div>
            <span>当前最需要关注的未回款规模</span>
          </article>
          <article className="card quality-card customer-overview-card">
            <strong>逾期金额</strong>
            <div>{formatCurrency(data?.summary.totalUnpaid ?? 0)}</div>
            <span>第一版先按未收金额口径展示</span>
          </article>
          <article className="card quality-card customer-overview-card">
            <strong>项目数量</strong>
            <div>{data?.summary.projectCount ?? 0} 个</div>
            <span>当前纳入客户主体的项目数量</span>
          </article>
        </div>
      </section>

      <section className="customer-detail-layout">
        <article className="card customer-detail-primary customer-archive-panel">
          <div className="table-header customer-section-header">
            <div>
              <h3>完整账款档案</h3>
              <span className="muted">可直接查看和编辑原始 Excel 档案。</span>
            </div>
          </div>
          {hasGeneratedLedgerArchive ? (
            <div className="inline-notice inline-notice-warning customer-archive-notice">
              当前为开发环境回退生成档案，仅用于试运行展示；正式数据版上线后将优先显示真实原始账款档案。
            </div>
          ) : null}
          <CustomerLedgerSpreadsheet
            customerId={customerId}
            preferredProjectId={preferredProjectId}
            preferredProjectName={preferredProjectName}
            preferredSheetName={preferredSheetName}
            sheets={classifiedArchives
              .filter((archive) => archive.sheetData)
              .map((archive) => ({
                id: archive.id,
                name: archive.sheetName,
                projectId: archive.projectId ?? undefined,
                projectName: archive.projectName || undefined,
                sourceCustomerName: archive.workbookSource || undefined,
                data: archive.sheetData ?? { name: archive.sheetName },
              }))}
            emptyMessage={
              loading
                ? "正在加载原始sheet数据..."
                : classifiedArchives.length === 0
                  ? "暂无已归类项目档案"
                  : ledgerMessage || "暂无原始sheet数据"
            }
          />
        </article>

        <aside className="customer-detail-aside">
          <section className="card customer-section-card">
            <div className="table-header customer-section-header">
              <h3>风险摘要</h3>
            </div>
            <div className="detail-note-list">
              <div><strong>风险结论：</strong>{data?.risk.conclusion ?? "低风险"}</div>
              <div><strong>风险原因：</strong>{data?.risk.reasons.length ? data.risk.reasons.join("；") : "当前未发现明显异常"}</div>
              <div><strong>建议动作：</strong>{data?.risk.actions.length ? data.risk.actions.join("；") : "保持常规跟进"}</div>
            </div>
          </section>

          <section className="card customer-section-card">
            <div className="table-header customer-section-header">
              <h3>备注与跟进信息</h3>
            </div>
            <div className="detail-note-list">
              <div><strong>目前状况：</strong>{displayBaseValue(data?.risk.currentStatus)}</div>
              <div><strong>资信状况：</strong>{displayBaseValue(data?.risk.creditStatus)}</div>
              <div><strong>备注摘要：</strong>{displayOptionalNote(data?.risk.remark ?? "")}</div>
            </div>
          </section>

          <section className="card customer-section-card">
            <div className="table-header customer-section-header">
              <h3>档案状态</h3>
            </div>
            <div className="detail-note-list">
              <div><strong>已归类档案：</strong>{classifiedArchives.length} 份</div>
              <div><strong>未归类档案：</strong>{unclassifiedArchives.length} 份</div>
              <div><strong>档案状态：</strong>{loading ? "正在核对..." : classifiedArchives.length > 0 ? "可查看" : "待补充"}</div>
            </div>
          </section>

          <section className="card customer-section-card">
            <div className="table-header customer-section-header">
              <h3>顾问式风险动作建议</h3>
            </div>
            <div className="detail-note-list">
              {actionSuggestions.map((item) => (
                <article className="risk-action-suggestion" key={item.id}>
                  <div className="toolbar-row">
                    <div>
                      <strong>{item.action}</strong>
                      <span className={item.level === "高" ? "status-badge status-danger" : item.level === "中" ? "status-badge status-warning" : "status-badge status-normal"}>
                        {item.level}优先级
                      </span>
                    </div>
                    <span className="muted">
                      {confirmedActions[item.id] === "confirmed"
                        ? "已确认"
                        : confirmedActions[item.id] === "rejected"
                          ? "已驳回"
                          : "待人工确认"}
                    </span>
                  </div>
                  <div><strong>原因：</strong>{item.reason}</div>
                  <div><strong>证据：</strong>{item.evidence}</div>
                  <div className="toolbar-row risk-action-buttons">
                    <button
                      className="button button-primary button-small"
                      type="button"
                      onClick={() => setConfirmedActions((current) => ({ ...current, [item.id]: "confirmed" }))}
                    >
                      人工确认
                    </button>
                    <button
                      className="button button-secondary button-small"
                      type="button"
                      onClick={() => setConfirmedActions((current) => ({ ...current, [item.id]: "rejected" }))}
                    >
                      驳回
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <RiskAssistantPanel
        contextLabel="当前客户档案"
        customerId={customerId}
        customerName={data?.customer.name}
        onCustomerDataChanged={loadCustomerData}
        contextSummary={[
          `风险结论：${data?.risk.conclusion ?? "低风险"}`,
          `未收金额：${formatCurrency(data?.summary.totalUnpaid ?? 0)}`,
          `项目数量：${data?.summary.projectCount ?? 0}`,
          `风险原因：${data?.risk.reasons.length ? data.risk.reasons.join("；") : "当前未发现明显异常"}`,
        ]}
      />
    </>
  );
}
