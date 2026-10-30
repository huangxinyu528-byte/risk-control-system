"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatOptionalText } from "@/lib/format";
import type { CollectionItemPayload, CollectionItemRecord, ReportEntry, RiskOverviewData } from "@/lib/types";

type CollectionResponse = {
  collections: CollectionItemRecord[];
  reports: ReportEntry[];
};

type MonthlyReportJson = {
  month: string;
  newHighRiskCustomers: string[];
  overdueReceivableTop: Array<{ customerName: string; unpaidAmount: number; measure: string }>;
  keyProjectProgress: string[];
  weeklyCollectionSuggestions: string[];
  versions: {
    boss: string;
    finance: string;
    salesOwner: string;
  };
};

const emptyForm: CollectionItemPayload = {
  customerId: "",
  maxOverdueDays: null,
  collectionLevel: null,
  currentMeasure: "",
  ownerName: "",
  followUpStatus: "",
  handoffToLegal: false,
  openclawSummary: "",
};

export function CollectionReportManagement() {
  const [collections, setCollections] = useState<CollectionItemRecord[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CollectionItemPayload>(emptyForm);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportJson | null>(null);
  const [reportMessage, setReportMessage] = useState("");

  async function loadData() {
    const response = await fetch("/api/collections");
    const result = await response.json();
    const data = result.data as CollectionResponse;
    setCollections(data.collections);
    setReports(data.reports);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    await fetch(`/api/collections/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setEditingId(null);
    setForm(emptyForm);
    await loadData();
  }

  async function generateMonthlyReport() {
    setReportMessage("");
    const response = await fetch("/api/risk/overview", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setReportMessage(result.message ?? "风险总览数据读取失败，无法生成月报。");
      return;
    }

    const riskOverview = result.data as RiskOverviewData;
    const month = new Date().toISOString().slice(0, 7);
    const overdueTop = [...collections]
      .sort((left, right) => right.unpaidAmount - left.unpaidAmount)
      .slice(0, 5)
      .map((item) => ({
        customerName: item.customerName,
        unpaidAmount: item.unpaidAmount,
        measure: item.currentMeasure || "待补充催收措施",
      }));
    const newHighRiskCustomers = riskOverview.topCustomers.slice(0, 5).map((item) => item.customerName);
    const keyProjectProgress = riskOverview.topProjects.slice(0, 5).map((item) =>
      `${item.projectName}：${item.riskLevel}，未收 ${formatCurrency(item.unpaidAmount)}，原因 ${item.riskReasons.slice(0, 2).join("；") || "待核查"}`,
    );
    const weeklyCollectionSuggestions = overdueTop.map((item) =>
      `${item.customerName}：未收 ${formatCurrency(item.unpaidAmount)}，建议本周完成对账和回款节点确认。`,
    );

    const boss = [
      `${month} 风控月报：当前高风险客户 ${riskOverview.metrics.highRiskCustomerCount} 个，高风险项目 ${riskOverview.metrics.highRiskProjectCount} 个，总未收风险暴露 ${formatCurrency(riskOverview.metrics.totalUnpaidAmount)}。`,
      `优先关注客户：${newHighRiskCustomers.join("、") || "暂无新增高风险客户"}。`,
      `本周建议：先处理金额大、风险等级高、证据链明确的客户和项目。`,
    ].join("\n");
    const finance = [
      `${month} 财务催收版本：超期/未收 Top 客户如下。`,
      ...overdueTop.map((item, index) => `${index + 1}. ${item.customerName}，未收 ${formatCurrency(item.unpaidAmount)}，当前措施：${item.measure}`),
      "建议财务优先核对合同应收、实际收款、发票和未制票差异。",
    ].join("\n");
    const salesOwner = [
      `${month} 业务负责人版本：本周重点推进以下客户回款和资料补齐。`,
      ...weeklyCollectionSuggestions.map((item, index) => `${index + 1}. ${item}`),
      "涉及停供、降额、法务介入等动作时，必须先提交人工确认。",
    ].join("\n");

    setMonthlyReport({
      month,
      newHighRiskCustomers,
      overdueReceivableTop: overdueTop,
      keyProjectProgress,
      weeklyCollectionSuggestions,
      versions: { boss, finance, salesOwner },
    });
  }

  async function copyReport(text: string) {
    await navigator.clipboard.writeText(text);
    setReportMessage("已复制报告内容。");
  }

  return (
    <>
      <PageHeader title="催收与报告" description="分为催收清单和报告中心，先保证结构清晰，后续可接 OpenClaw 分析能力。" />

      <section className="panel-grid dashboard-grid">
        <section className="table-card">
          <div className="table-header">
            <h3>催收清单</h3>
            <span className="muted">逾期数据为空时仍支持人工维护措施和状态</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>未收金额</th>
                <th>当前信用等级</th>
                <th>最大逾期天数</th>
                <th>催收等级</th>
                <th>当前措施</th>
                <th>责任人</th>
                <th>跟进状态</th>
                <th>是否移交法务</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((item) => (
                <tr key={item.id}>
                  <td>{item.customerCode ? `${item.customerCode} / ${item.customerName}` : item.customerName}</td>
                  <td>{formatCurrency(item.unpaidAmount)}</td>
                  <td>{item.currentCreditLevel || "待评定"}</td>
                  <td>{formatOptionalText(item.maxOverdueDays, "待补数据")}</td>
                  <td>{formatOptionalText(item.collectionLevel, "待补数据")}</td>
                  <td>{item.currentMeasure || "待补数据"}</td>
                  <td>{item.ownerName || "待补数据"}</td>
                  <td>{item.followUpStatus || "待补数据"}</td>
                  <td>{item.handoffToLegal ? "是" : "否"}</td>
                  <td>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          customerId: item.customerId,
                          maxOverdueDays: item.maxOverdueDays,
                          collectionLevel: item.collectionLevel,
                          currentMeasure: item.currentMeasure,
                          ownerName: item.ownerName,
                          followUpStatus: item.followUpStatus,
                          handoffToLegal: item.handoffToLegal,
                          openclawSummary: item.openclawSummary,
                        });
                      }}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="form-card">
          <h3 style={{ marginTop: 0 }}>催收维护</h3>
          <form className="form-layout" onSubmit={handleSubmit}>
            <label className="form-row">
              <span>最大逾期天数</span>
              <input
                type="number"
                value={form.maxOverdueDays ?? ""}
                placeholder="可留空"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxOverdueDays: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="form-row">
              <span>催收等级</span>
              <input
                value={form.collectionLevel ?? ""}
                placeholder="为空时不自动生成"
                onChange={(event) =>
                  setForm((current) => ({ ...current, collectionLevel: event.target.value || null }))
                }
              />
            </label>
            <label className="form-row">
              <span>当前措施</span>
              <textarea
                className="form-textarea"
                value={form.currentMeasure}
                onChange={(event) => setForm((current) => ({ ...current, currentMeasure: event.target.value }))}
              />
            </label>
            <label className="form-row">
              <span>责任人</span>
              <input
                value={form.ownerName}
                onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
              />
            </label>
            <label className="form-row">
              <span>跟进状态</span>
              <input
                value={form.followUpStatus}
                onChange={(event) => setForm((current) => ({ ...current, followUpStatus: event.target.value }))}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.handoffToLegal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, handoffToLegal: event.target.checked }))
                }
              />
              <span>是否移交法务</span>
            </label>
            <label className="form-row">
              <span>OpenClaw 摘要预留</span>
              <textarea
                className="form-textarea"
                value={form.openclawSummary}
                onChange={(event) => setForm((current) => ({ ...current, openclawSummary: event.target.value }))}
              />
            </label>
            <button className="button button-primary" type="submit" disabled={!editingId}>
              保存催收信息
            </button>
          </form>
        </section>
      </section>

      <section className="card section-card">
        <h3>报告中心</h3>
        <div className="management-toolbar card monthly-report-toolbar">
          <div className="toolbar-row">
            <div>
              <strong>AI 月报生成</strong>
              <div className="muted">先生成结构化 JSON，再渲染老板、财务、业务负责人三个版本。</div>
            </div>
            <button className="button button-primary" type="button" onClick={() => void generateMonthlyReport()}>
              生成本月风控月报
            </button>
          </div>
          {reportMessage ? <div className="muted monthly-report-message">{reportMessage}</div> : null}
        </div>
        {monthlyReport ? (
          <div className="panel-grid dashboard-grid monthly-report-grid">
            <article className="card">
              <h3 className="section-subtitle">结构化 JSON</h3>
              <pre className="report-pre">{JSON.stringify(monthlyReport, null, 2)}</pre>
            </article>
            <article className="card">
              <h3 className="section-subtitle">可复制版本</h3>
              <div className="detail-note-list">
                <button className="button button-secondary" type="button" onClick={() => void copyReport(monthlyReport.versions.boss)}>
                  复制老板版本
                </button>
                <button className="button button-secondary" type="button" onClick={() => void copyReport(monthlyReport.versions.finance)}>
                  复制财务版本
                </button>
                <button className="button button-secondary" type="button" onClick={() => void copyReport(monthlyReport.versions.salesOwner)}>
                  复制业务负责人版本
                </button>
                <div><strong>老板版本：</strong><pre className="report-pre">{monthlyReport.versions.boss}</pre></div>
                <div><strong>财务版本：</strong><pre className="report-pre">{monthlyReport.versions.finance}</pre></div>
                <div><strong>业务负责人版本：</strong><pre className="report-pre">{monthlyReport.versions.salesOwner}</pre></div>
              </div>
            </article>
          </div>
        ) : null}
        <div className="grade-grid">
          {reports.map((item) => (
            <article className="grade-card" key={item.id}>
              <strong>{item.title}</strong>
              <div className="muted">{item.description}</div>
              <div className="report-hint">{item.openclawHint}</div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
