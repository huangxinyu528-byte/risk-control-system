"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RiskAssistantPanel } from "@/components/ai/risk-assistant-panel";
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

const scoringStandards = [
  {
    title: "极高风险",
    detail: "回款比例极低、存在待起诉/已诉、项目未闭环且金额暴露大时优先进入极高风险。",
  },
  {
    title: "高风险",
    detail: "未收金额较大、回款比例低、命中多条规则或客户下存在多个高风险项目。",
  },
  {
    title: "中风险",
    detail: "存在回款偏慢、档案字段不完整、跟进信息不足等需要业务继续核查的信号。",
  },
  {
    title: "低风险",
    detail: "当前未发现明显异常，按常规回款和档案维护节奏继续跟进。",
  },
];

const ruleWeights = [
  "未收金额和应收规模决定风险暴露优先级",
  "回款比例越低，风险等级越高",
  "诉讼、待起诉、未闭环项目直接提高处置优先级",
  "合同、对账、开票、档案缺口会作为风险原因展示",
];

export function RiskOverviewDashboard() {
  const [data, setData] = useState<RiskOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function loadOverview(options: { forceRefresh?: boolean } = {}) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(options.forceRefresh ? "/api/risk/overview?refresh=1" : "/api/risk/overview", {
        cache: "no-store",
      });
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
  const headlineAlert = useMemo(() => {
    if (!data) return null;
    if ((data.metrics.extremeRiskProjectCount ?? 0) > 0) {
      return {
        title: "极高风险项目需要优先处理",
        detail: `当前有 ${data.metrics.extremeRiskProjectCount} 个极高风险项目，建议先进入风险项目页核查金额大、规则命中多的项目。`,
        href: "/risk/projects",
        action: "查看高风险项目",
        tone: "danger",
      };
    }
    if ((data.metrics.highRiskCustomerCount ?? 0) > 0) {
      return {
        title: "高风险客户需要集中排查",
        detail: `当前有 ${data.metrics.highRiskCustomerCount} 个高风险客户，建议优先检查重点客户和未闭环客户。`,
        href: "/risk/customers",
        action: "查看风险客户",
        tone: "warning",
      };
    }
    return {
      title: "当前风险总体可控",
      detail: "可继续通过风险客户页和风险项目页做常规排查与跟进。",
      href: "/risk/customers",
      action: "进入风险客户页",
      tone: "normal",
    };
  }, [data]);
  const totalExposure = data?.metrics.totalUnpaidAmount ?? 0;
  const prioritySnapshot = [
    {
      label: "高风险客户",
      value: data?.metrics.highRiskCustomerCount ?? 0,
      helper: "优先核查重点客户与客户级原因",
      href: "/risk/customers",
    },
    {
      label: "高风险项目",
      value: data?.metrics.highRiskProjectCount ?? 0,
      helper: "优先核查金额大、命中规则多的项目",
      href: "/risk/projects",
    },
    {
      label: "重点关注项",
      value: (data?.metrics.extremeRiskProjectCount ?? 0) + (data?.metrics.litigationProjectCount ?? 0),
      helper: "极高风险项目 + 诉讼类项目",
      href: "/risk/projects",
    },
  ];

  return (
    <>
      <PageHeader
        title="风控总览"
        description="先看高风险对象，再进入客户详情核查。"
      />

      <RiskModuleNav />

      <section className="management-toolbar card quiet-toolbar">
        <div className="toolbar-row">
          <span className="muted">数据已缓存，点击后重新计算最新风险。</span>
          <button className="button button-secondary" type="button" onClick={() => void loadOverview({ forceRefresh: true })}>
            重新计算
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
          <RiskAssistantPanel
            contextLabel="当前风控总览"
            contextSummary={[
              `总未收风险暴露：${formatCurrency(data?.metrics.totalUnpaidAmount ?? 0)}`,
              `高风险客户：${data?.metrics.highRiskCustomerCount ?? 0}`,
              `高风险项目：${data?.metrics.highRiskProjectCount ?? 0}`,
              `极高风险项目：${data?.metrics.extremeRiskProjectCount ?? 0}`,
              `主要风险原因：${topRiskReasons.slice(0, 3).map((item) => item.label).join("、") || "暂无"}`,
            ]}
          />

          <section className="risk-workbench-hero">
            <article className="card risk-workbench-main-card">
              <div className="risk-workbench-eyebrow">总览</div>
              <div className="risk-workbench-main-head">
                <div>
                  <h3>未收风险暴露</h3>
                  <strong>{formatCurrency(totalExposure)}</strong>
                </div>
                <div className="risk-workbench-badge-stack">
                  <span className="status-badge status-danger">高风险客户 {data?.metrics.highRiskCustomerCount ?? 0}</span>
                  <span className="status-badge status-warning">高风险项目 {data?.metrics.highRiskProjectCount ?? 0}</span>
                  <span className="status-badge status-info">新增预警 {data?.metrics.newAlertCount ?? 0}</span>
                </div>
              </div>
              <div className="risk-priority-grid">
                {prioritySnapshot.map((item) => (
                  <Link className="risk-priority-card" href={item.href} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <em>{item.helper}</em>
                  </Link>
                ))}
              </div>
            </article>

            <article className={`card risk-workbench-alert risk-workbench-alert-${headlineAlert?.tone ?? "normal"}`}>
              <div className="risk-workbench-eyebrow">重点提醒</div>
              <h3>{headlineAlert?.title}</h3>
              <p>{headlineAlert?.detail}</p>
              <Link className="button button-primary" href={headlineAlert?.href ?? "/risk/customers"}>
                {headlineAlert?.action ?? "查看详情"}
              </Link>
            </article>
          </section>

          <section className="risk-metric-grid risk-metric-grid-compact">
            <article className="card risk-metric-card risk-metric-card-highlight">
              <span>高风险客户数</span>
              <strong>{data?.metrics.highRiskCustomerCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card risk-metric-card-highlight">
              <span>高风险项目数</span>
              <strong>{data?.metrics.highRiskProjectCount ?? 0}</strong>
            </article>
            <article className="card risk-metric-card">
              <span>极高风险项目数</span>
              <strong>{data?.metrics.extremeRiskProjectCount ?? 0}</strong>
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

          <details className="card risk-collapsible-section">
            <summary>风险评分标准</summary>
            <div className="risk-collapsible-grid">
              <div className="risk-summary-list">
                {scoringStandards.map((item) => (
                  <div className="risk-summary-item" key={item.title}>
                    <span>
                      <strong>{item.title}</strong>
                      <br />
                      <span className="muted">{item.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="risk-summary-list">
                {ruleWeights.map((item) => (
                  <div className="risk-summary-item" key={item}>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>

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
                        <th>高危项目</th>
                      <th>主要风险原因</th>
                      <th>操作</th>
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
                        <td>
                          <div className="risk-inline-actions">
                            <Link
                              className="button button-secondary button-small"
                              href={`/customers/${encodeURIComponent(item.customerId)}?from=risk-overview`}
                            >
                              查看详情
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="table-card">
              <div className="table-header">
                <h3>高风险项目 Top</h3>
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
                      <th>主要风险原因</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topProjects.map((item) => (
                      <tr key={item.projectId}>
                        <td>
                          <Link
                            className="table-link"
                            href={`/customers/${encodeURIComponent(item.customerId)}?from=risk-overview`}
                          >
                            {item.customerName}
                          </Link>
                        </td>
                        <td>
                          <Link
                            className="table-link"
                            href={`/customers/${encodeURIComponent(item.customerId)}?projectId=${encodeURIComponent(item.projectId)}&projectName=${encodeURIComponent(item.projectName)}&from=risk-overview`}
                          >
                            {item.projectName}
                          </Link>
                        </td>
                        <td><span className={riskBadgeClass(item.riskLevel)}>{item.riskLevel}</span></td>
                        <td>{formatCurrency(item.unpaidAmount)}</td>
                        <td>{summarizeRiskText(item.riskReasons, "暂无风险原因", 2)}</td>
                        <td>
                          <div className="risk-inline-actions">
                            <Link
                              className="button button-secondary button-small"
                              href={`/customers/${encodeURIComponent(item.customerId)}?projectId=${encodeURIComponent(item.projectId)}&projectName=${encodeURIComponent(item.projectName)}&from=risk-overview`}
                            >
                              查看详情
                            </Link>
                          </div>
                        </td>
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
