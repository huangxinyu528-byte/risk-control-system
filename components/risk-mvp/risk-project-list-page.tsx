"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScrollArea } from "@/components/shared/horizontal-scroll-area";
import { displayMetaText, summarizeRiskText } from "@/components/risk-mvp/risk-display";
import { RiskModuleNav } from "@/components/risk-mvp/risk-module-nav";
import type {
  ExecutableRiskLevel,
  RiskProjectFilters,
  RiskProjectResponse,
  RiskProjectRow,
} from "@/lib/types";

const RISK_LEVEL_OPTIONS: Array<ExecutableRiskLevel> = ["低风险", "中风险", "高风险", "极高风险"];
const PROJECT_BELONGING_CATEGORY_OPTIONS = ["央企", "国企", "民营", "项目类", "未标注"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskBadgeClass(level: ExecutableRiskLevel) {
  if (level === "极高风险" || level === "高风险") return "status-badge status-danger";
  if (level === "中风险") return "status-badge status-warning";
  return "status-badge status-normal";
}

function buildQuery(filters: RiskProjectFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
  if (filters.projectBelongingCategory) params.set("projectBelongingCategory", filters.projectBelongingCategory);
  if (filters.businessType) params.set("businessType", filters.businessType);
  if (typeof filters.hasLedgerArchive === "boolean") {
    params.set("hasLedgerArchive", String(filters.hasLedgerArchive));
  }
  if (typeof filters.isUnclosed === "boolean") {
    params.set("isUnclosed", String(filters.isUnclosed));
  }
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.page) params.set("page", String(filters.page));
  return params.toString();
}

export function RiskProjectListPage() {
  const [filters, setFilters] = useState<RiskProjectFilters>({
    keyword: "",
    riskLevel: "",
    projectBelongingCategory: "",
    businessType: "",
    hasLedgerArchive: undefined,
    isUnclosed: undefined,
    sortBy: "unpaidAmount",
    sortOrder: "desc",
    page: 1,
    pageSize: 100,
  });
  const [data, setData] = useState<RiskProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProjects(activeFilters: RiskProjectFilters) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/risk/projects?${buildQuery(activeFilters)}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error ?? "风险项目列表加载失败");
      }
      setData(result.data as RiskProjectResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "风险项目列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects(filters);
  }, [filters]);

  const summary = useMemo(() => data?.summary, [data]);

  function updateFilter<K extends keyof RiskProjectFilters>(key: K, value: RiskProjectFilters[K]) {
    setFilters((current) => ({
      ...current,
      page: 1,
      [key]: value,
    }));
  }

  function parseBooleanFilter(value: string): boolean | undefined {
    if (value === "") return undefined;
    return value === "true";
  }

  return (
    <>
      <PageHeader
        title="风险项目"
        description="按项目定位大额未收、诉讼和未闭环风险。"
      />

      <RiskModuleNav />

      <section className="management-toolbar card">
        <div className="toolbar-grid risk-project-toolbar">
          <input
            className="search-input"
            type="search"
            value={filters.keyword ?? ""}
            placeholder="搜索客户名称、项目名称、风险原因"
            onChange={(event) => updateFilter("keyword", event.target.value)}
          />

          <div className="form-row">
            <select
              value={filters.riskLevel ?? ""}
              onChange={(event) =>
                updateFilter("riskLevel", event.target.value as RiskProjectFilters["riskLevel"])
              }
            >
              <option value="">全部风险等级</option>
              {RISK_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <select
              value={filters.projectBelongingCategory ?? ""}
              onChange={(event) =>
                updateFilter(
                  "projectBelongingCategory",
                  event.target.value as RiskProjectFilters["projectBelongingCategory"],
                )
              }
            >
              <option value="">全部项目归属</option>
              {PROJECT_BELONGING_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <input
              className="search-input"
              type="text"
              value={filters.businessType ?? ""}
              placeholder="筛选业务类型"
              onChange={(event) => updateFilter("businessType", event.target.value)}
            />
          </div>

          <div className="form-row">
            <select
              value={typeof filters.isUnclosed === "boolean" ? String(filters.isUnclosed) : ""}
              onChange={(event) => updateFilter("isUnclosed", parseBooleanFilter(event.target.value))}
            >
              <option value="">全部闭环状态</option>
              <option value="true">仅看未闭环项目</option>
              <option value="false">仅看已闭环项目</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={typeof filters.hasLedgerArchive === "boolean" ? String(filters.hasLedgerArchive) : ""}
              onChange={(event) => updateFilter("hasLedgerArchive", parseBooleanFilter(event.target.value))}
            >
              <option value="">全部档案状态</option>
              <option value="true">仅看有原始档案</option>
              <option value="false">仅看无原始档案</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={filters.sortBy ?? "unpaidAmount"}
              onChange={(event) =>
                updateFilter("sortBy", event.target.value as RiskProjectFilters["sortBy"])
              }
            >
              <option value="unpaidAmount">按未收金额排序</option>
              <option value="riskLevel">按风险等级排序</option>
              <option value="collectionRate">按回款比例排序</option>
              <option value="receivableAmount">按应收金额排序</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={filters.sortOrder ?? "desc"}
              onChange={(event) =>
                updateFilter("sortOrder", event.target.value as RiskProjectFilters["sortOrder"])
              }
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>

          <button className="button button-secondary" type="button" onClick={() => void loadProjects(filters)}>
            刷新列表
          </button>
        </div>
      </section>

      <section className="risk-project-summary-grid">
        <article className="card risk-metric-card risk-metric-card-highlight">
          <span>风险项目数</span>
          <strong>{summary?.projectCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card risk-metric-card-highlight">
          <span>高风险项目数</span>
          <strong>{summary?.highRiskProjectCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card">
          <span>极高风险项目数</span>
          <strong>{summary?.extremeRiskProjectCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card">
          <span>风险项目总未收</span>
          <strong>{formatCurrency(summary?.totalUnpaidAmount ?? 0)}</strong>
        </article>
      </section>

      <section className="management-toolbar card quiet-toolbar">
        <div className="toolbar-row">
          <div className="toolbar-badges">
            {(summary?.projectBelongingCategories ?? [])
              .filter((item) => item.count > 0)
              .map((item) => (
                <span className="summary-badge" key={item.label}>
                  {item.label} {item.count}
                </span>
              ))}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="card empty-card">正在加载风险项目列表…</section>
      ) : error ? (
        <section className="card empty-card">
          <strong>风险项目列表加载失败</strong>
          <div className="muted">{error}</div>
        </section>
      ) : (
        <section className="table-card">
          <div className="table-header">
            <h3>项目清单</h3>
            <span className="muted">共 {summary?.projectCount ?? 0} 个</span>
          </div>

          <HorizontalScrollArea hint="">
            <table className="data-table risk-project-table">
              <thead>
                <tr>
                  <th>客户名称</th>
                  <th>项目名称</th>
                  <th>风险等级</th>
                  <th>风险原因</th>
                  <th>未收金额</th>
                  <th>命中规则</th>
                  <th>状态</th>
                  <th>档案</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data?.projects.length ? (
                  data.projects.map((project) => <RiskProjectRowView key={project.projectId} project={project} />)
                ) : (
                  <tr>
                    <td className="empty-cell" colSpan={9}>
                      当前筛选条件下没有风险项目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </HorizontalScrollArea>
        </section>
      )}
    </>
  );
}

function RiskProjectRowView({ project }: { project: RiskProjectRow }) {
  const reasonText = summarizeRiskText(project.riskReasons, "暂无风险原因", 3);
  const currentStatusText = displayMetaText(project.currentStatusSummary);
  const ruleCount = project.triggeredRules.length;
  const attentionLabel =
    project.riskLevel === "极高风险"
      ? "立即处理"
      : project.riskLevel === "高风险"
        ? "优先跟进"
        : project.riskLevel === "中风险"
          ? "持续跟进"
          : "常规观察";

  return (
    <tr className={`risk-table-row risk-table-row-${project.riskLevel.replace("风险", "")}`}>
      <td>
        <Link
          className="table-link"
          href={`/customers/${encodeURIComponent(project.customerId)}?from=risk-projects`}
        >
          {project.customerName}
        </Link>
      </td>
      <td>
        <Link
          className="table-link-block risk-name-block"
          href={`/customers/${encodeURIComponent(project.customerId)}?projectId=${encodeURIComponent(project.projectId)}&projectName=${encodeURIComponent(project.projectName)}&from=risk-projects`}
        >
          <span className="table-link risk-primary-name">{project.projectName}</span>
          <span className="risk-row-helper">{attentionLabel}</span>
        </Link>
      </td>
      <td>
        <div className="risk-badge-stack">
          <span className={riskBadgeClass(project.riskLevel)}>{project.riskLevel}</span>
          <span className="status-badge status-info">命中 {ruleCount} 条</span>
        </div>
      </td>
      <td>
        <div className="risk-text-stack">
          <span>{reasonText}</span>
          {currentStatusText !== "暂无补充说明" ? <span className="muted">当前状况：{currentStatusText}</span> : null}
        </div>
      </td>
      <td>
        <div className="risk-amount-emphasis">
          <strong>{formatCurrency(project.unpaidAmount)}</strong>
        </div>
      </td>
      <td>
        <div className="risk-rule-stack">
          <strong>{ruleCount} 条</strong>
          <span>{project.triggeredRules.join("、") || "未命中规则编码"}</span>
        </div>
      </td>
      <td>
        {project.isUnclosed ? (
          <span className="status-badge status-warning">未闭环</span>
        ) : (
          <span className="status-badge status-success">已闭环</span>
        )}
      </td>
      <td>
        {project.hasLedgerArchive ? (
          <span className="status-badge status-info">有档案</span>
        ) : (
          <span className="muted">无档案</span>
        )}
      </td>
      <td>
        <div className="risk-inline-actions">
          <Link
            className="button button-secondary button-small"
            href={`/customers/${encodeURIComponent(project.customerId)}?projectId=${encodeURIComponent(project.projectId)}&projectName=${encodeURIComponent(project.projectName)}&from=risk-projects`}
          >
            查看详情
          </Link>
        </div>
      </td>
    </tr>
  );
}
