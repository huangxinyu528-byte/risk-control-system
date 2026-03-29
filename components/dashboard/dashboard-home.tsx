"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import type {
  DashboardOverviewData,
  HighRiskCustomerRecord,
  KeyAttentionCustomerRecord,
} from "@/lib/types";

export function DashboardHome() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [highRiskItems, setHighRiskItems] = useState<HighRiskCustomerRecord[]>([]);
  const [keyAttentionItems, setKeyAttentionItems] = useState<KeyAttentionCustomerRecord[]>([]);
  const [showHighRiskModal, setShowHighRiskModal] = useState(false);
  const [showKeyAttentionModal, setShowKeyAttentionModal] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/dashboard/overview")
        .then((response) => response.json())
        .then((result) => setData(result.data as DashboardOverviewData)),
      fetch("/api/high-risk-customers")
        .then((response) => response.json())
        .then((result) => setHighRiskItems(result.data as HighRiskCustomerRecord[])),
      fetch("/api/key-attention-customers")
        .then((response) => response.json())
        .then((result) => setKeyAttentionItems(result.data as KeyAttentionCustomerRecord[])),
    ]);
  }, []);

  return (
    <>
      <PageHeader
        title="首页看板"
        description="聚合展示应收、回款、风险客户和催收重点客户。"
      />

      <section className="stat-grid">
        {data?.stats.map((stat) =>
          stat.label === "高风险客户数" ? (
            <button
              className="card stat-card stat-card-button"
              key={stat.label}
              type="button"
              onClick={() => setShowHighRiskModal(true)}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.helper ?? "实时汇总"}</em>
              <div className="stat-card-action">查看明细 ›</div>
            </button>
          ) : stat.label === "重点关注客户数" ? (
            <button
              className="card stat-card stat-card-button"
              key={stat.label}
              type="button"
              onClick={() => setShowKeyAttentionModal(true)}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.helper ?? "实时汇总"}</em>
              <div className="stat-card-action">查看明细 ›</div>
            </button>
          ) : (
            <article className="card stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.helper ?? "实时汇总"}</em>
            </article>
          ),
        )}
      </section>

      <section className="panel-grid dashboard-grid">
        <section className="card section-card">
          <h3>客户等级分布</h3>
          <div className="grade-grid">
            {data?.gradeDistribution.map((item) => (
              <article className="grade-card" key={item.level}>
                <strong>{item.level}</strong>
                <span>{item.count} 家客户</span>
              </article>
            ))}
          </div>
        </section>

        <section className="card section-card">
          <h3>催收重点客户 TOP</h3>
          <div className="mini-list">
            {data?.collectionTopCustomers.map((item) => (
              <article key={item.customerName}>
                <strong>{item.customerName}</strong>
                <div className="muted">
                  未收金额：{formatCurrency(item.unpaidAmount)} ·
                  逾期：{item.overdueDays === null ? "未计算" : `${item.overdueDays} 天`}
                </div>
                <span className={`status-badge ${item.riskStatus === "高风险" ? "status-danger" : "status-warning"}`}>
                  {item.riskStatus}
                </span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel-grid dashboard-grid">
        <section className="card section-card">
          <h3>规则启用状态</h3>
          <div className="mini-list">
            {data?.ruleSummary.map((item) => (
              <article key={item.name}>
                <strong>
                  {item.name}
                  <span className={`inline-status ${item.status === "已启用" ? "inline-status-on" : "inline-status-off"}`}>
                    {item.status}
                  </span>
                </strong>
                <div className="muted">{item.description}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="card section-card">
          <h3>规则结果总览</h3>
          <div className="info-list">
            <article>
              <strong>高风险客户</strong>
              <div className="muted">{data?.focusSummary.highRiskCustomers ?? 0} 家</div>
            </article>
            <article>
              <strong>重点关注客户</strong>
              <div className="muted">{data?.focusSummary.keyAttentionCustomers ?? 0} 家</div>
            </article>
            <article>
              <strong>C级客户</strong>
              <div className="muted">{data?.focusSummary.cLevelCustomers ?? 0} 家</div>
            </article>
            <article>
              <strong>催款客户</strong>
              <div className="muted">{data?.focusSummary.collectionCustomers ?? 0} 家</div>
            </article>
            <article>
              <strong>评分下降客户</strong>
              <div className="muted">{data?.focusSummary.scoreDownCustomers ?? 0} 家</div>
            </article>
            <article>
              <strong>诉讼客户</strong>
              <div className="muted">{data?.focusSummary.litigationCustomers ?? 0} 家</div>
            </article>
          </div>
        </section>
      </section>

      <section className="card section-card">
        <h3>风险趋势占位图</h3>
        <div className="trend-chart">
          {data?.riskTrend.map((point) => (
            <div className="trend-bar-wrap" key={point.month}>
              <div className="trend-bar" style={{ height: `${point.value * 18}px` }} />
              <span>{point.month}</span>
            </div>
          ))}
        </div>
      </section>

      {showHighRiskModal ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowHighRiskModal(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="table-header">
              <h3>高风险客户明细</h3>
              <button className="button button-ghost" type="button" onClick={() => setShowHighRiskModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal-body">
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
                  {highRiskItems.map((item) => (
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
                        <Link
                          className="button button-secondary"
                          href={`/high-risk-customers?customerId=${encodeURIComponent(item.customerId)}`}
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="button button-ghost" type="button" onClick={() => setShowHighRiskModal(false)}>
                关闭
              </button>
              <Link className="button button-primary" href="/high-risk-customers">
                查看全部高风险客户
              </Link>
            </div>
          </section>
        </div>
      ) : null}

      {showKeyAttentionModal ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowKeyAttentionModal(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="table-header">
              <h3>重点关注客户明细</h3>
              <button className="button button-ghost" type="button" onClick={() => setShowKeyAttentionModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal-body">
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
                  {keyAttentionItems.map((item) => (
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
                        <Link
                          className="button button-secondary"
                          href={`/key-attention-customers?customerId=${encodeURIComponent(item.customerId)}`}
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="button button-ghost" type="button" onClick={() => setShowKeyAttentionModal(false)}>
                关闭
              </button>
              <Link className="button button-primary" href="/key-attention-customers">
                查看全部重点关注客户
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
