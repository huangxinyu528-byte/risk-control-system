"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { RiskModuleNav } from "@/components/risk-mvp/risk-module-nav";
import { summarizeRiskText } from "@/components/risk-mvp/risk-display";
import type { RiskOverviewData } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskBadgeClass(level: string) {
  if (level.includes("极高") || level.includes("高")) return "status-badge status-danger";
  if (level.includes("中")) return "status-badge status-warning";
  return "status-badge status-normal";
}

export function RiskOverviewDashboard() {
  const [data, setData] = useState<RiskOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function loadOverview() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/risk/overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error ?? "风控总览加载失败");
      }
      setData(result.data as RiskOverviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "风控总览加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const topRiskReasons = useMemo(() => data?.distributions.riskReason ?? [], [data]);

  return (
    <>
      <PageHeader
        title="风控总览"
        description="先看风险规模、重点对象和主要原因，再进入客户页和项目页继续排查。"
      />

      <RiskModuleNav />

      <section className="management-toolbar card">
        <div className="toolbar-row">
          <span className="muted">
            当前页面基于后端风控聚合接口展示，规则由服务端统一计算，页面不再自行拼规则。
          </span>
          <button className="button button-secondary" type="button" onClick={() => void loadOverview()}>
            刷新总览
          </button>
        </div>
      </section>

      {loading ? (
        <section className="card empty-card">正在加载风控总览…</section>
      ) : error ? (
        <section className="card empty-card">
          <strong>风控总览加载失败</strong>
          <div className="muted">{error}</div>
        </section>
      ) : (
        <>
          <section className="risk-metric-grid">
            <article className="card risk-metric-card">
              <span>高风险客户数</span>
              <strong>{data?.metrics.highRiskCustomerCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>高风险项目数</span>
              <strong>{data?.metrics.highRiskProjectCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>极高风险项目数</span>
              <strong>{data?.metrics.extremeRiskProjectCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>总未收金额</span>
              <strong>{formatCurrency(data?.metrics.totalUnpaidAmount ?? 0)}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>大额未收项目数</span>
              <strong>{data?.metrics.largeExposureProjectCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>待起诉/已诉项目数</span>
              <strong>{data?.metrics.litigationProjectCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>未闭环项目数</span>
              <strong>{data?.metrics.unclosedProjectCount ?? 0}</strong>
            </article>
          </section>

          <section className="risk-distribution-grid">
            <article className="card risk-distribution-card">
              <div className="table-header">
                <h3>风险等级分布</h3>
                <span className="muted">项目级</span>
              </div>
              <div className="risk-bar-list">
                {data?.distributions.riskLevel.map((item) => {
                  const max = Math.max(...(data.distributions.riskLevel.map((entry) => entry.count) || [1]), 1);
                  return (
                    <div className="risk-bar-row" key={item.label}>
                      <div className="risk-bar-meta">
                        <span className={riskBadgeClass(item.label)}>{item.label}</span>
                        <strong>{item.count}</strong>
                      </div>
                      <div className="risk-bar-track">
                        <div className="risk-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="card risk-distribution-card">
              <div className="table-header">
                <h3>风险原因分布</h3>
                <span className="muted">Top 10</span>
              </div>
              <div className="risk-summary-list">
                {topRiskReasons.length === 0 ? (
                  <div className="muted">暂无风险原因分布</div>
                ) : (
                  topRiskReasons.map((item) => (
                    <div className="risk-summary-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="card risk-distribution-card">
              <div className="table-header">
                <h3>项目风险分布</h3>
                <span className="muted">重点指标</span>
              </div>
              <div className="risk-summary-list">
                <div className="risk-summary-item">
                  <span>大额未收项目</span>
                  <strong>{data?.metrics.largeExposureProjectCount ?? 0}</strong>
                </div>
                <div className="risk-summary-item">
                  <span>待起诉/已诉项目</span>
                  <strong>{data?.metrics.litigationProjectCount ?? 0}</strong>
                </div>
                <div className="risk-summary-item">
                  <span>未闭环项目</span>
                  <strong>{data?.metrics.unclosedProjectCount ?? 0}</strong>
                </div>
                <div className="risk-summary-item">
                  <span>新增预警数</span>
                  <strong>{data?.metrics.newAlertCount ?? "待补"}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="risk-top-grid">
            <article className="table-card">
              <div className="table-header">
                <h3>高风险客户 Top 列表</h3>
                <Link className="table-link" href="/risk/customers">
                  查看全部客户风险
                </Link>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>客户名称</th>
                      <th>风险等级</th>
                      <th>未收金额</th>
                      <th>高风险项目数</th>
                      <th>风险原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topCustomers.map((item) => (
                      <tr key={item.customerId}>
                        <td>
                          <Link className="table-link" href={`/customers/${encodeURIComponent(item.customerId)}`}>
                            {item.customerName}
                          </Link>
                        </td>
                        <td><span className={riskBadgeClass(item.riskLevel)}>{item.riskLevel}</span></td>
                        <td>{formatCurrency(item.totalUnpaidAmount)}</td>
                        <td>{item.highRiskProjectCount}</td>
                        <td>{summarizeRiskText(item.riskReasons, "暂无风险原因", 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="table-card">
              <div className="table-header">
                <h3>高风险项目 Top 列表</h3>
                <Link className="table-link" href="/risk/projects">
                  查看全部项目风险
                </Link>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>客户名称</th>
                      <th>项目名称</th>
                      <th>风险等级</th>
                      <th>未收金额</th>
                      <th>命中规则</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topProjects.map((item) => (
                      <tr key={item.projectId}>
                        <td>{item.customerName}</td>
                        <td>
                          <Link
                            className="table-link"
                            href={`/customers/${encodeURIComponent(item.customerId)}?projectId=${encodeURIComponent(item.projectId)}`}
                          >
                            {item.projectName}
                          </Link>
                        </td>
                        <td><span className={riskBadgeClass(item.riskLevel)}>{item.riskLevel}</span></td>
                        <td>{formatCurrency(item.unpaidAmount)}</td>
                        <td>{item.triggeredRules.join("、") || "未命中规则编码"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}
