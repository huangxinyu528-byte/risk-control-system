"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { displayMetaText, summarizeRiskText } from "@/components/risk-mvp/risk-display";
import { RiskModuleNav } from "@/components/risk-mvp/risk-module-nav";
import type {
  CustomerEntityType,
  ExecutableRiskLevel,
  RiskCustomerFilters,
  RiskCustomerResponse,
  RiskCustomerRow,
} from "@/lib/types";

const RISK_LEVEL_OPTIONS: Array<ExecutableRiskLevel> = ["低风险", "中风险", "高风险", "极高风险"];
const CUSTOMER_TYPE_OPTIONS: Array<CustomerEntityType> = ["公司", "个人", "自运", "其他"];

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

function buildQuery(filters: RiskCustomerFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
  if (filters.customerType) params.set("customerType", filters.customerType);
  if (typeof filters.isImportantCustomer === "boolean") {
    params.set("isImportantCustomer", String(filters.isImportantCustomer));
  }
  if (typeof filters.hasUnclosedProjects === "boolean") {
    params.set("hasUnclosedProjects", String(filters.hasUnclosedProjects));
  }
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.page) params.set("page", String(filters.page));
  return params.toString();
}

export function RiskCustomerListPage() {
  const [filters, setFilters] = useState<RiskCustomerFilters>({
    keyword: "",
    riskLevel: "",
    customerType: "",
    isImportantCustomer: undefined,
    hasUnclosedProjects: undefined,
    sortBy: "unpaidAmount",
    sortOrder: "desc",
    page: 1,
    pageSize: 100,
  });
  const [data, setData] = useState<RiskCustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCustomers(activeFilters: RiskCustomerFilters) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/risk/customers?${buildQuery(activeFilters)}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error ?? "风险客户列表加载失败");
      }
      setData(result.data as RiskCustomerResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "风险客户列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers(filters);
  }, [filters]);

  const summary = useMemo(() => data?.summary, [data]);

  function updateFilter<K extends keyof RiskCustomerFilters>(key: K, value: RiskCustomerFilters[K]) {
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
        title="风险客户列表"
        description="按客户主体查看风险等级、风险原因和建议动作，先定位重点客户，再进入客户详情继续核查。"
      />

      <RiskModuleNav />

      <section className="management-toolbar card">
        <div className="toolbar-grid risk-customer-toolbar">
          <input
            className="search-input"
            type="search"
            value={filters.keyword ?? ""}
            placeholder="搜索客户名称、风险原因、当前状况"
            onChange={(event) => updateFilter("keyword", event.target.value)}
          />

          <div className="form-row">
            <select
              value={filters.riskLevel ?? ""}
              onChange={(event) =>
                updateFilter("riskLevel", event.target.value as RiskCustomerFilters["riskLevel"])
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
              value={filters.customerType ?? ""}
              onChange={(event) =>
                updateFilter("customerType", event.target.value as RiskCustomerFilters["customerType"])
              }
            >
              <option value="">全部客户类型</option>
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <select
              value={
                typeof filters.isImportantCustomer === "boolean" ? String(filters.isImportantCustomer) : ""
              }
              onChange={(event) => updateFilter("isImportantCustomer", parseBooleanFilter(event.target.value))}
            >
              <option value="">全部重点客户状态</option>
              <option value="true">仅看重点客户</option>
              <option value="false">仅看非重点客户</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={
                typeof filters.hasUnclosedProjects === "boolean" ? String(filters.hasUnclosedProjects) : ""
              }
              onChange={(event) => updateFilter("hasUnclosedProjects", parseBooleanFilter(event.target.value))}
            >
              <option value="">全部闭环状态</option>
              <option value="true">仅看未闭环客户</option>
              <option value="false">仅看已闭环客户</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={filters.sortBy ?? "unpaidAmount"}
              onChange={(event) =>
                updateFilter("sortBy", event.target.value as RiskCustomerFilters["sortBy"])
              }
            >
              <option value="unpaidAmount">按总未收金额排序</option>
              <option value="riskLevel">按风险等级排序</option>
              <option value="highRiskProjectCount">按高风险项目数排序</option>
            </select>
          </div>

          <div className="form-row">
            <select
              value={filters.sortOrder ?? "desc"}
              onChange={(event) =>
                updateFilter("sortOrder", event.target.value as RiskCustomerFilters["sortOrder"])
              }
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>

          <button className="button button-secondary" type="button" onClick={() => void loadCustomers(filters)}>
            刷新列表
          </button>
        </div>
      </section>

      <section className="risk-customer-summary-grid">
        <article className="card risk-metric-card">
          <span>风险客户数</span>
          <strong>{summary?.customerCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card">
          <span>高风险客户数</span>
          <strong>{summary?.highRiskCustomerCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card">
          <span>极高风险客户数</span>
          <strong>{summary?.extremeRiskCustomerCount ?? 0}</strong>
        </article>
        <article className="card risk-metric-card">
          <span>风险客户总未收</span>
          <strong>{formatCurrency(summary?.totalUnpaidAmount ?? 0)}</strong>
        </article>
      </section>

      {loading ? (
        <section className="card empty-card">正在加载风险客户列表…</section>
      ) : error ? (
        <section className="card empty-card">
          <strong>风险客户列表加载失败</strong>
          <div className="muted">{error}</div>
        </section>
      ) : (
        <section className="table-card">
          <div className="table-header">
            <h3>风险客户列表</h3>
            <span className="muted">
              当前共 {summary?.customerCount ?? 0} 个客户，页面直接展示后端已计算好的风险等级、原因和建议动作。
            </span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>客户名称</th>
                  <th>客户类型</th>
                  <th>风险等级</th>
                  <th>风险原因</th>
                  <th>建议动作</th>
                  <th>总应收金额</th>
                  <th>总未收金额</th>
                  <th>项目数量</th>
                  <th>高风险项目数量</th>
                  <th>是否重点客户</th>
                  <th>是否未闭环</th>
                </tr>
              </thead>
              <tbody>
                {data?.customers.length ? (
                  data.customers.map((customer) => <RiskCustomerRowView key={customer.customerId} customer={customer} />)
                ) : (
                  <tr>
                    <td className="empty-cell" colSpan={11}>
                      当前筛选条件下没有风险客户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function RiskCustomerRowView({ customer }: { customer: RiskCustomerRow }) {
  const reasonText = summarizeRiskText(customer.riskReasons, "暂无风险原因", 3);
  const actionText = summarizeRiskText(customer.riskActions, "暂无建议动作", 2);
  const currentStatusText = displayMetaText(customer.currentStatusSummary);
  const creditStatusText = displayMetaText(customer.creditStatusSummary);

  return (
    <tr>
      <td>
        <Link className="table-link-block" href={`/customers/${encodeURIComponent(customer.customerId)}`}>
          <span className="table-link">{customer.customerName}</span>
          <span className="table-link-helper">{customer.triggeredRules.join("、") || "未命中规则编码"}</span>
        </Link>
      </td>
      <td>{customer.customerType}</td>
      <td>
        <span className={riskBadgeClass(customer.riskLevel)}>{customer.riskLevel}</span>
      </td>
      <td>
        <div className="risk-text-stack">
          <span>{reasonText}</span>
          {currentStatusText !== "暂无补充说明" ? <span className="muted">当前状况：{currentStatusText}</span> : null}
        </div>
      </td>
      <td>
        <div className="risk-text-stack">
          <span>{actionText}</span>
          {creditStatusText !== "暂无补充说明" ? <span className="muted">资信：{creditStatusText}</span> : null}
        </div>
      </td>
      <td>{formatCurrency(customer.totalReceivableAmount)}</td>
      <td>{formatCurrency(customer.totalUnpaidAmount)}</td>
      <td>{customer.projectCount}</td>
      <td>{customer.highRiskProjectCount}</td>
      <td>{customer.isImportantCustomer ? <span className="status-badge status-info">重点客户</span> : <span className="muted">否</span>}</td>
      <td>
        {customer.hasUnclosedProjects ? (
          <span className="status-badge status-warning">未闭环</span>
        ) : (
          <span className="status-badge status-success">已闭环</span>
        )}
      </td>
    </tr>
  );
}
