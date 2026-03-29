"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import type { HighRiskCustomerRecord } from "@/lib/types";

export function HighRiskCustomerManagement() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? "";

  const [items, setItems] = useState<HighRiskCustomerRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [salesOwnerName, setSalesOwnerName] = useState("");
  const [detail, setDetail] = useState<HighRiskCustomerRecord | null>(null);

  async function loadItems(next = { keyword, riskLevel, salesOwnerName }) {
    const params = new URLSearchParams();
    if (next.keyword) params.set("keyword", next.keyword);
    if (next.riskLevel) params.set("riskLevel", next.riskLevel);
    if (next.salesOwnerName) params.set("salesOwnerName", next.salesOwnerName);

    const response = await fetch(`/api/high-risk-customers?${params.toString()}`);
    const result = await response.json();
    const data = result.data as HighRiskCustomerRecord[];
    setItems(data);

    if (initialCustomerId) {
      const matched = data.find(
        (item) => item.customerId === initialCustomerId || item.customerCode === initialCustomerId,
      );
      if (matched) {
        setDetail(matched);
      }
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownerOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.salesOwnerName).filter(Boolean))),
    [items],
  );

  return (
    <>
      <PageHeader
        title="高风险客户"
        description="查看全部高风险客户，支持搜索、筛选、详情查看，并同时展示风险标签、管理层摘要和人工备注。"
      />

      <section className="management-toolbar card">
        <div className="toolbar-row toolbar-grid">
          <input
            className="search-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索客户名称、客户编号、管理层摘要、备注"
          />
          <select className="search-input" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
            <option value="">按风险等级筛选</option>
            <option value="高">高</option>
            <option value="重大">重大</option>
          </select>
          <select
            className="search-input"
            value={salesOwnerName}
            onChange={(event) => setSalesOwnerName(event.target.value)}
          >
            <option value="">按业务负责人筛选</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void loadItems({ keyword, riskLevel, salesOwnerName })}
          >
            查询
          </button>
        </div>
      </section>

      <section className="management-layout">
        <section className="table-card">
          <div className="table-header">
            <h3>高风险客户列表</h3>
            <span className="muted">共 {items.length} 家</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>客户编号</th>
                <th>客户名称</th>
                <th>当前信用等级</th>
                <th>当前应收余额</th>
                <th>风险等级</th>
                <th>风险标签</th>
                <th>高风险原因摘要</th>
                <th>管理备注</th>
                <th>是否重点关注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.customerId}>
                  <td>{item.customerCode || item.customerId}</td>
                  <td>{item.customerName}</td>
                  <td>{item.currentCreditLevel}</td>
                  <td>{formatCurrency(item.receivableBalance)}</td>
                  <td>
                    <span className={`status-badge ${item.riskLevel === "重大" ? "status-danger" : "status-warning"}`}>
                      {item.riskLevel}
                    </span>
                  </td>
                  <td>
                    <div className="tag-list">
                      {item.riskTags.map((tag) => (
                        <span className="tag-chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{item.managementSummary}</td>
                  <td>{item.riskRemark || "暂无备注"}</td>
                  <td>{item.keyAttention ? "是" : "否"}</td>
                  <td>
                    <button className="button button-secondary" type="button" onClick={() => setDetail(item)}>
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="form-card">
          <h3 style={{ marginTop: 0 }}>高风险客户详情</h3>
          {detail ? (
            <div className="detail-grid">
              <div><strong>客户编号：</strong>{detail.customerCode || detail.customerId}</div>
              <div><strong>客户名称：</strong>{detail.customerName}</div>
              <div><strong>当前信用等级：</strong>{detail.currentCreditLevel}</div>
              <div><strong>当前应收余额：</strong>{formatCurrency(detail.receivableBalance)}</div>
              <div><strong>风险等级：</strong>{detail.riskLevel}</div>
              <div><strong>业务负责人：</strong>{detail.salesOwnerName || "待分配"}</div>
              <div><strong>是否重点关注：</strong>{detail.keyAttention ? "是" : "否"}</div>
              <div className="detail-full">
                <strong>风险标签：</strong>
                <div className="tag-list" style={{ marginTop: 8 }}>
                  {detail.riskTags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detail-full"><strong>管理层版摘要：</strong>{detail.managementSummary}</div>
              <div className="detail-full">
                <strong>催收执行版摘要：</strong>
                <span className="muted"> {detail.collectionSummary}</span>
              </div>
              <div className="detail-full">
                <strong>高风险判定依据：</strong>
                {detail.highRiskReasons.length ? detail.highRiskReasons.join("；") : "暂无规则命中说明"}
              </div>
              <div className="detail-full"><strong>管理备注：</strong>{detail.riskRemark || "暂无备注"}</div>
            </div>
          ) : (
            <div className="empty-card" style={{ padding: 20 }}>
              请选择一条高风险客户记录查看详情。
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Link className="button button-ghost" href="/">
              返回首页
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
