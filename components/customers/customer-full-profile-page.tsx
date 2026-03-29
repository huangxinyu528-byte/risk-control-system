"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        description="查看客户概览，以及 Excel 原始账款档案中的头部信息、明细行和底部汇总。"
      />

      <section className="card">
        <div className="table-header">
          <div>
            <h3 style={{ margin: 0 }}>{data?.customer.name ?? "客户档案"}</h3>
            <span className="muted">
              {data?.customer.customerCode || "待生成"} / {data?.customer.customerId || customerId}
            </span>
            {data?.traceability?.mergedSourceNames?.length ? (
              <div className="muted" style={{ marginTop: 8 }}>
                已归并来源：{data.traceability.mergedSourceNames.join("、")}
              </div>
            ) : null}
          </div>
          <Link className="button button-ghost" href="/customers">
            返回客户列表
          </Link>
        </div>
      </section>

      <section className="detail-summary-grid">
        <article className="card quality-card">
          <strong>总应收</strong>
          <div>{formatCurrency(data?.summary.totalReceivable ?? 0)}</div>
        </article>
        <article className="card quality-card">
          <strong>已收金额</strong>
          <div>{formatCurrency(data?.summary.totalReceived ?? 0)}</div>
        </article>
        <article className="card quality-card">
          <strong>未收金额</strong>
          <div>{formatCurrency(data?.summary.totalUnpaid ?? 0)}</div>
        </article>
        <article className="card quality-card">
          <strong>项目数量</strong>
          <div>{data?.summary.projectCount ?? 0} 个</div>
        </article>
      </section>

      <section className="card">
        <div className="table-header">
          <h3>项目明细表</h3>
          <span className="muted">{loading ? "加载中..." : `共 ${data?.projects.length ?? 0} 个项目`}</span>
        </div>
        <table className="data-table">
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
      </section>

      <section className="card">
        <div className="table-header">
          <h3>风险与备注</h3>
        </div>
        <div className="detail-note-list">
          <div><strong>风险结论：</strong>{data?.risk.conclusion ?? "低风险"}</div>
          <div><strong>风险原因：</strong>{data?.risk.reasons.length ? data.risk.reasons.join("；") : "当前未发现明显异常"}</div>
          <div><strong>建议动作：</strong>{data?.risk.actions.length ? data.risk.actions.join("；") : "保持常规跟进"}</div>
          <div><strong>目前状况：</strong>{displayBaseValue(data?.risk.currentStatus)}</div>
          <div><strong>资信状况：</strong>{displayBaseValue(data?.risk.creditStatus)}</div>
          <div><strong>备注：</strong>{displayOptionalNote(data?.risk.remark ?? "")}</div>
        </div>
      </section>

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
