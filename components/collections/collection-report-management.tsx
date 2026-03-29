"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatOptionalText } from "@/lib/format";
import type { CollectionItemPayload, CollectionItemRecord, ReportEntry } from "@/lib/types";

type CollectionResponse = {
  collections: CollectionItemRecord[];
  reports: ReportEntry[];
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
