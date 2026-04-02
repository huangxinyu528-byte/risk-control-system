"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerLedgerSpreadsheet } from "@/components/customers/customer-ledger-spreadsheet";
import { HorizontalScrollArea } from "@/components/shared/horizontal-scroll-area";
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

  useEffect(() => {
    let active = true;

    async function load() {
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
        if (!active) return;
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
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <>
      <PageHeader
        title="客户账款档案"
        description="查看客户概览、项目明细、风险摘要与完整账款档案，作为业务管理与档案核查的统一入口。"
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
              <span className="muted">集中查看客户原始账款档案、完整 sheet 布局和项目档案切换。</span>
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
        </aside>
      </section>

      <section className="card customer-section-card customer-project-section">
        <div className="table-header customer-section-header">
          <h3>项目明细</h3>
          <span className="muted">{loading ? "加载中..." : `共 ${data?.projects.length ?? 0} 个项目`}</span>
        </div>
        <HorizontalScrollArea hint="可在表格区域内按住鼠标左右拖动，或使用顶部滚动条查看完整项目列">
          <table className="data-table detail-project-table">
            <thead>
              <tr>
                <th>项目名称</th>
                <th>项目别名</th>
                <th>应收</th>
                <th>已收</th>
                <th>未收</th>
                <th>业务类型</th>
                <th>时间节点</th>
              </tr>
            </thead>
            <tbody>
              {(data?.projects ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">暂无项目数据</td>
                </tr>
              ) : (
                (data?.projects ?? []).map((project) => (
                  <tr key={project.id}>
                    <td>{project.projectName}</td>
                    <td>{displayBaseValue(project.projectAlias)}</td>
                    <td>{formatCurrency(project.receivableAmount)}</td>
                    <td>{formatCurrency(project.receivedAmount)}</td>
                    <td>{formatCurrency(project.unpaidAmount)}</td>
                    <td>{displayBaseValue(project.businessType)}</td>
                    <td>{displayBaseValue(project.timeNode)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </HorizontalScrollArea>
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3 style={{ margin: 0 }}>未归类档案</h3>
            <span className="muted">
              {loading ? "正在核对..." : `共 ${unclassifiedArchives.length} 份，当前仍挂在主体客户下，待后续补充项目归类`}
            </span>
          </div>
        </div>

        {unclassifiedArchives.length === 0 ? (
          <div className="empty-cell" style={{ padding: 24 }}>当前没有未归类档案</div>
        ) : (
          <div className="detail-note-list">
            {unclassifiedArchives.map((archive) => (
              <article className="card" key={archive.id} style={{ padding: 16 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div><strong>sheetName：</strong>{archive.sheetName}</div>
                  <div><strong>原始来源名称：</strong>{displayBaseValue(archive.workbookSource)}</div>
                  <div><strong>projectName：</strong>{displayBaseValue(archive.projectName)}</div>
                  <div><strong>settlementClause：</strong>{displayBaseValue(archive.settlementClause)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
