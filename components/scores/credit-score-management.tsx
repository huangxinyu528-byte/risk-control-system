"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import type { CreditScoreRecord } from "@/lib/types";

export function CreditScoreManagement() {
  const [scores, setScores] = useState<CreditScoreRecord[]>([]);
  const [scoreMonth, setScoreMonth] = useState("");
  const [creditLevel, setCreditLevel] = useState("");
  const [detail, setDetail] = useState<CreditScoreRecord | null>(null);

  async function loadScores() {
    const params = new URLSearchParams();
    if (scoreMonth) params.set("scoreMonth", scoreMonth);
    if (creditLevel) params.set("creditLevel", creditLevel);

    const response = await fetch(`/api/scores?${params.toString()}`);
    const result = await response.json();
    setScores(result.data as CreditScoreRecord[]);
  }

  useEffect(() => {
    async function loadInitialData() {
      const response = await fetch("/api/scores");
      const result = await response.json();
      setScores(result.data as CreditScoreRecord[]);
    }

    void loadInitialData();
  }, []);

  const monthOptions = useMemo(
    () => Array.from(new Set(scores.map((item) => item.scoreMonth))),
    [scores],
  );

  return (
    <>
      <PageHeader title="信用评分" description="按客户查看评分结果，支持月份和信用等级筛选。" />

      <section className="management-toolbar card">
        <div className="toolbar-row">
          <select className="search-input" value={scoreMonth} onChange={(event) => setScoreMonth(event.target.value)}>
            <option value="">按月份筛选</option>
            {monthOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="search-input" value={creditLevel} onChange={(event) => setCreditLevel(event.target.value)}>
            <option value="">按信用等级筛选</option>
            {["A+", "A", "A-", "B", "B-", "C"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="button button-secondary" type="button" onClick={() => void loadScores()}>
            查询
          </button>
        </div>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h3>客户评分列表</h3>
          <span className="muted">按制度口径按月更新，核心依据为回款表现、风险事件和期间账款情况。</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>客户名称</th>
              <th>信用风险评分</th>
              <th>经营风险评分</th>
              <th>财务风险评分</th>
              <th>制度评分</th>
              <th>信用等级</th>
              <th>风险动作</th>
              <th>风险状态</th>
              <th>评分变化</th>
              <th>评分日期</th>
              <th>是否重点关注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((item) => (
              <tr key={item.id}>
                <td>{item.customerCode ? `${item.customerCode} / ${item.customerName}` : item.customerName}</td>
                <td>{item.creditRiskScore}</td>
                <td>{item.businessRiskScore}</td>
                <td>{item.financialRiskScore}</td>
                <td>{item.creditScore}</td>
                <td>{item.creditLevel}</td>
                <td>{item.riskAction}</td>
                <td>{item.riskStatus}</td>
                <td>{item.scoreDelta === null || item.scoreDelta === undefined ? "待补数据" : item.scoreDelta}</td>
                <td>{item.scoreDate}</td>
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

      {detail ? (
        <section className="detail-panel card">
          <div className="table-header">
            <h3>评分详情</h3>
            <button className="button button-ghost" type="button" onClick={() => setDetail(null)}>
              关闭
            </button>
          </div>
          <div className="detail-grid">
            <div><strong>客户编号：</strong>{detail.customerCode || "待生成"}</div>
            <div><strong>客户名称：</strong>{detail.customerName}</div>
            <div><strong>评分日期：</strong>{detail.scoreDate}</div>
            <div><strong>信用风险评分：</strong>{detail.creditRiskScore}</div>
            <div><strong>经营风险评分：</strong>{detail.businessRiskScore}</div>
            <div><strong>财务风险评分：</strong>{detail.financialRiskScore}</div>
            <div><strong>制度评分：</strong>{detail.creditScore}</div>
            <div><strong>信用等级：</strong>{detail.creditLevel}</div>
            <div><strong>风险动作：</strong>{detail.riskAction}</div>
            <div><strong>风险状态：</strong>{detail.riskStatus}</div>
            <div><strong>评分变化：</strong>{detail.scoreDelta ?? "待补数据"}</div>
            <div><strong>是否重点关注：</strong>{detail.keyAttention ? "是" : "否"}</div>
            <div className="detail-full"><strong>评分说明：</strong>{detail.description || "无"}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}
