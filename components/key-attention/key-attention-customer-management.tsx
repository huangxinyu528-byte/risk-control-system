"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import type { KeyAttentionCustomerRecord } from "@/lib/types";

export function KeyAttentionCustomerManagement() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? "";

  const [items, setItems] = useState<KeyAttentionCustomerRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [attentionLevel, setAttentionLevel] = useState("");
  const [salesOwnerName, setSalesOwnerName] = useState("");
  const [detail, setDetail] = useState<KeyAttentionCustomerRecord | null>(null);

  async function loadItems(next = { keyword, attentionLevel, salesOwnerName }) {
    const params = new URLSearchParams();
    if (next.keyword) params.set("keyword", next.keyword);
    if (next.attentionLevel) params.set("attentionLevel", next.attentionLevel);
    if (next.salesOwnerName) params.set("salesOwnerName", next.salesOwnerName);

    const response = await fetch(`/api/key-attention-customers?${params.toString()}`);
    const result = await response.json();
    const data = result.data as KeyAttentionCustomerRecord[];
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
        title="重点关注客户"
        description="查看需要持续跟进的客户清单，支持搜索、筛选、详情查看，并展示关注标签、管理层摘要和备注。"
      />

      <section className="management-toolbar card">
        <div className="toolbar-row toolbar-grid">
          <input
            className="search-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索客户名称、客户编号、管理层摘要、备注"
          />
          <select
            className="search-input"
            value={attentionLevel}
            onChange={(event) => setAttentionLevel(event.target.value)}
          >
            <option value="">按关注级别筛选</option>
            <option value="持续关注">持续关注</option>
            <option value="重点跟进">重点跟进</option>
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
            onClick={() => void loadItems({ keyword, attentionLevel, salesOwnerName })}
          >
            查询
          </button>
        </div>
      </section>

      <section className="management-layout">
        <section className="table-card">
          <div className="table-header">
            <h3>重点关注客户列表</h3>
            <span className="muted">共 {items.length} 家</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>客户编号</th>
                <th>客户名称</th>
                <th>当前信用等级</th>
                <th>当前应收余额</th>
                <th>关注级别</th>
                <th>关注标签</th>
                <th>管理层摘要</th>
                <th>当前备注</th>
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
                    <span
                      className={`status-badge ${
                        item.attentionLevel === "重点跟进" ? "status-warning" : "status-info"
                      }`}
                    >
                      {item.attentionLevel}
                    </span>
                  </td>
                  <td>
                    <div className="tag-list">
                      {item.attentionTags.map((tag) => (
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
          <h3 style={{ marginTop: 0 }}>重点关注客户详情</h3>
          {detail ? (
            <div className="detail-grid">
              <div><strong>客户编号：</strong>{detail.customerCode || detail.customerId}</div>
              <div><strong>客户名称：</strong>{detail.customerName}</div>
              <div><strong>当前信用等级：</strong>{detail.currentCreditLevel}</div>
              <div><strong>当前应收余额：</strong>{formatCurrency(detail.receivableBalance)}</div>
              <div><strong>关注级别：</strong>{detail.attentionLevel}</div>
              <div><strong>业务负责人：</strong>{detail.salesOwnerName || "待分配"}</div>
              <div><strong>是否重点关注：</strong>{detail.keyAttention ? "是" : "否"}</div>
              <div className="detail-full">
                <strong>关注标签：</strong>
                <div className="tag-list" style={{ marginTop: 8 }}>
                  {detail.attentionTags.map((tag) => (
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
                <strong>关注判定依据：</strong>
                {detail.attentionReasons.length ? detail.attentionReasons.join("；") : "暂无规则命中说明"}
              </div>
              <div className="detail-full"><strong>当前备注：</strong>{detail.riskRemark || "暂无备注"}</div>
            </div>
          ) : (
            <div className="empty-card" style={{ padding: 20 }}>
              请选择一条重点关注客户记录查看详情。
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
