"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import type {
  CustomerEntityType,
  CustomerLedgerCustomerRow,
  CustomerLedgerFilters,
  CustomerLedgerProjectRow,
  CustomerLedgerResponse,
  CustomerLedgerSortField,
  CustomerLedgerSortOrder,
} from "@/lib/types";

const customerTypeOptions: Array<{ label: string; value: CustomerEntityType | "" }> = [
  { label: "全部主体", value: "" },
  { label: "公司", value: "公司" },
  { label: "个人", value: "个人" },
  { label: "自运", value: "自运" },
  { label: "其他", value: "其他" },
];

const sortOptions: Array<{ label: string; value: CustomerLedgerSortField }> = [
  { label: "按未收金额", value: "unpaidAmount" },
  { label: "按对账金额", value: "receivableAmount" },
  { label: "按风险等级", value: "riskLevel" },
  { label: "按项目数量", value: "projectCount" },
];

const pageSizeOptions = [50, 100, 200, 500];
const archiveFilterOptions = [
  { label: "全部主体", value: "all" },
  { label: "仅看有未归类档案", value: "only-unclassified" },
] as const;

function displaySummary(value: string | null | undefined, fallback = "待补数据") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildSearchParams(filters: CustomerLedgerFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.customerType) params.set("customerType", filters.customerType);
  if (filters.hasUnclassifiedArchives) params.set("hasUnclassifiedArchives", "true");
  if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 200));
  return params;
}

function displayProjectBelonging(project: CustomerLedgerProjectRow) {
  return displaySummary(project.projectBelonging, "待补数据");
}

function displayProjectCreditStatus(project: CustomerLedgerProjectRow) {
  return displaySummary(project.creditStatusRaw, project.creditStatusSummary);
}

function displayProjectCurrentStatus(project: CustomerLedgerProjectRow) {
  return displaySummary(project.currentStatusRaw, project.currentStatusSummary);
}

function displayProjectRemark(project: CustomerLedgerProjectRow) {
  return displaySummary(project.remarkRaw, project.remarkSummary);
}

function displayCustomerArchiveSummary(customer: CustomerLedgerCustomerRow) {
  if (customer.hasUnclassifiedArchives) {
    return `未归类 ${customer.unclassifiedArchiveCount} 份`;
  }
  return "已归档";
}

function normalizeKeywordValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesProjectKeyword(keyword: string, project: CustomerLedgerProjectRow) {
  const normalized = normalizeKeywordValue(keyword);
  if (!normalized) {
    return false;
  }

  return [
    project.projectName,
    project.projectAlias,
    project.sourceCustomerName,
    project.normalizedProjectName,
    project.projectBelonging,
    project.remarkRaw,
    project.remarkSummary,
    project.creditStatusRaw,
    project.creditStatusSummary,
    project.currentStatusRaw,
    project.currentStatusSummary,
    project.businessType,
    project.timeNode,
  ].some((value) => normalizeKeywordValue(value).includes(normalized));
}

export function CustomerManagement() {
  const [filters, setFilters] = useState<CustomerLedgerFilters>({
    keyword: "",
    customerType: "",
    sortBy: "unpaidAmount",
    sortOrder: "desc",
    page: 1,
    pageSize: 200,
  });
  const [data, setData] = useState<CustomerLedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [focusedCustomerId, setFocusedCustomerId] = useState<string | null>(null);

  async function loadLedger(nextFilters = filters) {
    setLoading(true);
    try {
      const params = buildSearchParams(nextFilters);
      const response = await fetch(`/api/customers/ledger?${params.toString()}`);
      const result = await response.json();
      setData(result.data as CustomerLedgerResponse);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLedger(filters);
    }, filters.keyword ? 300 : 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const customers = data?.customers ?? [];
  const summary = data?.summary;
  const onlyUnclassified = Boolean(filters.hasUnclassifiedArchives);
  const normalizedKeyword = normalizeKeywordValue(filters.keyword);
  const visibleCustomers = focusedCustomerId
    ? customers.filter((customer) => customer.customerId === focusedCustomerId)
    : customers;

  const expandedSet = useMemo(() => new Set(expandedCustomerIds), [expandedCustomerIds]);
  const selectedCustomer = useMemo(
    () => visibleCustomers.find((customer) => customer.customerId === selectedCustomerId) ?? null,
    [selectedCustomerId, visibleCustomers],
  );

  function toggleExpand(customerId: string) {
    setSelectedCustomerId(customerId);
    setExpandedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((item) => item !== customerId)
        : [...current, customerId],
    );
  }

  function riskBadgeClass(riskLevel: string) {
    if (riskLevel.includes("高")) return "status-badge status-danger";
    if (riskLevel.includes("中")) return "status-badge status-warning";
    return "status-badge status-normal";
  }

  function focusCustomer(customer: CustomerLedgerCustomerRow) {
    setFocusedCustomerId(customer.customerId);
    setSelectedCustomerId(customer.customerId);
    setDrawerOpen(true);
    setExpandedCustomerIds((current) =>
      current.includes(customer.customerId) ? current : [...current, customer.customerId],
    );
    setFilters((current) => ({
      ...current,
      keyword: customer.customerName,
      page: 1,
    }));
  }

  function clearFocusedCustomer() {
    setFocusedCustomerId(null);
    setFilters((current) => ({
      ...current,
      keyword: "",
      page: 1,
    }));
  }

  const focusedCustomerExpanded = selectedCustomer
    ? expandedSet.has(selectedCustomer.customerId)
    : false;

  function expandFocusedCustomerProjects() {
    if (!selectedCustomer) return;
    setExpandedCustomerIds((current) =>
      current.includes(selectedCustomer.customerId)
        ? current
        : [...current, selectedCustomer.customerId],
    );
  }

  function collapseFocusedCustomerProjects() {
    if (!selectedCustomer) return;
    setExpandedCustomerIds((current) =>
      current.filter((item) => item !== selectedCustomer.customerId),
    );
  }

  return (
    <>
      <PageHeader
        title="客户管理"
        description="按业务往来主体汇总展示应收账款情况，可展开查看各项目台账，阅读方式参考应收账款汇总表。"
      />

      <section className="ledger-toolbar card">
        <div className="ledger-toolbar-top">
          <div>
            <strong>总账工具栏</strong>
            <div className="muted">先筛主体，再展开项目；保持 Excel 宽表式阅读。</div>
          </div>
          <div className="ledger-toolbar-actions">
            <button className="button button-ghost" type="button" onClick={() => setDrawerOpen(true)}>
              打开右侧摘要
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void loadLedger(filters)}
            >
              {loading ? "加载中..." : "刷新总账"}
            </button>
          </div>
        </div>

        <div className="toolbar-row ledger-toolbar-row">
          <div className="ledger-search-wrap">
            <input
              className="search-input"
              value={filters.keyword ?? ""}
              onChange={(event) => {
                setFocusedCustomerId(null);
                setFilters((current) => ({ ...current, keyword: event.target.value }));
              }}
              placeholder="搜索客户主体、项目名称、原始来源名称"
            />
          </div>
          <select
            className="filter-select"
            value={onlyUnclassified ? "only-unclassified" : "all"}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                hasUnclassifiedArchives: event.target.value === "only-unclassified" ? true : undefined,
              }))
            }
          >
            {archiveFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.customerType ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                customerType: event.target.value as CustomerEntityType | "",
              }))
            }
          >
            {customerTypeOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.sortBy ?? "unpaidAmount"}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sortBy: event.target.value as CustomerLedgerSortField,
              }))
            }
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.sortOrder ?? "desc"}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sortOrder: event.target.value as CustomerLedgerSortOrder,
              }))
            }
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <select
            className="filter-select"
            value={String(filters.pageSize ?? 200)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value),
              }))
            }
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                每页 {size} 条
              </option>
            ))}
          </select>
        </div>

        <div className="ledger-toolbar-summary">
          <span className="topbar-badge">主体 {summary?.customerCount ?? 0}</span>
          <span className="topbar-badge">项目 {summary?.projectCount ?? 0}</span>
          <span className="topbar-badge">未归类档案 {summary?.totalUnclassifiedArchiveCount ?? 0}</span>
          <span className="topbar-badge">未收 {formatCurrency(summary?.totalUnpaidAmount ?? 0)}</span>
          {focusedCustomerId && selectedCustomer ? (
            <>
              <span className="topbar-badge">当前聚焦：{selectedCustomer.customerName}</span>
              <button
                className="button button-secondary ledger-focus-toggle"
                type="button"
                onClick={focusedCustomerExpanded ? collapseFocusedCustomerProjects : expandFocusedCustomerProjects}
              >
                {focusedCustomerExpanded ? "收起全部项目" : "展开全部项目"}
              </button>
              <button className="button button-ghost ledger-clear-focus" type="button" onClick={clearFocusedCustomer}>
                清除聚焦
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="card ledger-table-card">
        <div className="table-header">
          <div>
            <h3 style={{ marginBottom: 6 }}>客户总账页</h3>
            <span className="muted">
              一级展示业务往来主体，展开后查看项目明细；字段优先显示结构化值，缺失时回退摘要。
            </span>
          </div>
          <span className="muted">当前显示 {visibleCustomers.length} 个主体，可横向滚动查看完整列</span>
        </div>

        <div className="ledger-table-shell">
          <table className="data-table ledger-table">
            <thead>
              <tr>
                <th className="sticky-col">主体 / 项目</th>
                <th>类型</th>
                <th>对账金额</th>
                <th>按合同应收</th>
                <th>实际收款</th>
                <th>未收金额</th>
                <th>项目数量</th>
                <th>项目摘要</th>
                <th>项目归属</th>
                <th>备注摘要</th>
                <th>资信状况</th>
                <th>目前状况</th>
                <th>风险等级</th>
                <th>档案状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.length === 0 ? (
                <tr>
                  <td className="empty-cell" colSpan={15}>
                    {loading ? "正在加载客户总账..." : "当前没有可展示的客户总账数据。"}
                  </td>
                </tr>
              ) : null}

              {visibleCustomers.map((customer) => {
                const isExpanded = expandedSet.has(customer.customerId);
                const matchedProjects = normalizedKeyword
                  ? customer.projects.filter((project) => matchesProjectKeyword(normalizedKeyword, project))
                  : [];
                const hasProjectKeywordMatch = matchedProjects.length > 0;
                const shouldShowProjects = isExpanded || hasProjectKeywordMatch;

                return (
                  <Fragment key={customer.customerId}>
                    <tr
                      key={customer.customerId}
                      className={`ledger-row ledger-row-customer${isExpanded ? " is-expanded" : ""}${
                        hasProjectKeywordMatch ? " has-project-match" : ""
                      }${
                        customer.hasUnclassifiedArchives ? " has-unclassified" : ""
                      }${selectedCustomerId === customer.customerId ? " is-selected" : ""}${
                        onlyUnclassified && customer.hasUnclassifiedArchives ? " is-unclassified-focus" : ""
                      }`}
                      onClick={() => setSelectedCustomerId(customer.customerId)}
                    >
                      <td className="sticky-col ledger-subject-cell">
                        <button
                          className="ledger-expand-button"
                          type="button"
                          onClick={() => toggleExpand(customer.customerId)}
                        >
                          {isExpanded ? "收起" : "展开"}
                        </button>
                        <div className="ledger-name-block">
                          <strong>{customer.customerName}</strong>
                          <span className="muted">
                            主体客户
                            {customer.projectCount >= 8 ? " · 项目较多" : ""}
                            {customer.hasUnclassifiedArchives ? " · 含未归类档案" : ""}
                            {hasProjectKeywordMatch ? ` · 命中项目 ${matchedProjects.length} 个` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="status-badge status-info">{customer.customerType}</span>
                      </td>
                      <td className="ledger-amount-cell">{formatCurrency(customer.totalReceivableAmount)}</td>
                      <td className="ledger-amount-cell">{formatCurrency(customer.totalContractReceivable)}</td>
                      <td className="ledger-amount-cell">{formatCurrency(customer.totalReceivedAmount)}</td>
                      <td className="ledger-amount-cell">{formatCurrency(customer.totalUnpaidAmount)}</td>
                      <td className="ledger-count-cell">{customer.projectCount}</td>
                      <td>
                        <div className="ledger-summary-cell" title={customer.projectNamesPreview}>
                          {displaySummary(customer.projectNamesPreview, "暂无项目")}
                        </div>
                      </td>
                      <td>
                        <div className="ledger-summary-cell" title={customer.projectBelongingSummary}>
                          {displaySummary(customer.projectBelongingSummary, "待补数据")}
                        </div>
                      </td>
                      <td>
                        <div className="ledger-summary-cell" title={customer.remarkSummary}>
                          {displaySummary(customer.remarkSummary)}
                        </div>
                      </td>
                      <td>
                        <div className="ledger-summary-cell" title={customer.creditStatusSummary}>
                          {displaySummary(customer.creditStatusSummary)}
                        </div>
                      </td>
                      <td>
                        <div className="ledger-summary-cell" title={customer.currentStatusSummary}>
                          {displaySummary(customer.currentStatusSummary)}
                        </div>
                      </td>
                      <td>
                        <span className={riskBadgeClass(customer.riskLevel)}>{customer.riskLevel}</span>
                      </td>
                      <td>
                        <div className="ledger-status-stack">
                          {customer.hasUnclassifiedArchives ? (
                            <span className="status-badge status-warning ledger-unclassified-badge">
                              {displayCustomerArchiveSummary(customer)}
                            </span>
                          ) : (
                            <span className="status-badge status-success">已归类</span>
                          )}
                          {customer.projectCount >= 8 ? (
                            <span className="status-badge status-info">项目较多</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          {customer.hasUnclassifiedArchives ? (
                            <button
                              className="button button-secondary"
                              type="button"
                              onClick={() => focusCustomer(customer)}
                            >
                              聚焦主体
                            </button>
                          ) : null}
                          <Link className="button button-ghost" href={`/customers/${encodeURIComponent(customer.customerId)}`}>
                            查看主体档案
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {shouldShowProjects
                      ? customer.projects.map((project) => (
                          <tr
                            key={project.projectId}
                            className={`ledger-row ledger-row-project${
                              selectedCustomerId === customer.customerId ? " is-selected" : ""
                            }${matchesProjectKeyword(normalizedKeyword, project) ? " is-project-match" : ""}${
                              hasProjectKeywordMatch ? " is-project-search-open" : ""
                            }${onlyUnclassified && customer.hasUnclassifiedArchives ? " is-unclassified-focus" : ""}`}
                          >
                            <td className="sticky-col ledger-project-cell">
                              <div className="ledger-name-block">
                                <strong>{project.projectName}</strong>
                                <span className="muted">
                                  {project.projectAlias || project.sourceCustomerName || "项目明细"}
                                </span>
                                {customer.hasUnclassifiedArchives ? (
                                  <span className="ledger-inline-hint">
                                    该主体仍有 {customer.unclassifiedArchiveCount} 份未归类档案
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <span className="status-badge">项目</span>
                            </td>
                            <td className="ledger-amount-cell">{formatCurrency(project.receivableAmount)}</td>
                            <td className="ledger-amount-cell">{formatCurrency(project.contractReceivable)}</td>
                            <td className="ledger-amount-cell">{formatCurrency(project.receivedAmount)}</td>
                            <td className="ledger-amount-cell">{formatCurrency(project.unpaidAmount)}</td>
                            <td>—</td>
                            <td>
                              <div className="ledger-summary-cell" title={project.sourceCustomerName || project.projectAlias || ""}>
                                {displaySummary(project.sourceCustomerName || project.projectAlias, "待补数据")}
                              </div>
                            </td>
                            <td>
                              <div className="ledger-summary-cell" title={displayProjectBelonging(project)}>
                                {displayProjectBelonging(project)}
                              </div>
                            </td>
                            <td>
                              <div className="ledger-summary-cell" title={displayProjectRemark(project)}>
                                {displayProjectRemark(project)}
                              </div>
                            </td>
                            <td>
                              <div className="ledger-summary-cell" title={displayProjectCreditStatus(project)}>
                                {displayProjectCreditStatus(project)}
                              </div>
                            </td>
                            <td>
                              <div className="ledger-summary-cell" title={displayProjectCurrentStatus(project)}>
                                {displayProjectCurrentStatus(project)}
                              </div>
                            </td>
                            <td>
                              <span className="status-badge status-info">{project.businessType || "正常"}</span>
                            </td>
                            <td>
                              {project.hasLedgerArchive ? (
                                <span className="status-badge status-success">
                                  已归档 {project.ledgerArchiveCount} 份
                                </span>
                              ) : (
                                <span className="status-badge">待补档案</span>
                              )}
                            </td>
                            <td>
                              <Link
                                className="button button-ghost"
                                href={`/customers/${encodeURIComponent(customer.customerId)}?projectId=${encodeURIComponent(project.projectId)}&projectName=${encodeURIComponent(project.projectName)}`}
                              >
                                查看项目档案
                              </Link>
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen ? (
        <div className="ledger-side-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside
            className="ledger-side-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="客户总账右侧摘要"
          >
            <div className="ledger-side-drawer-header">
              <div>
                <strong>右侧摘要</strong>
                <div className="muted">默认收起，避免长期占据主表宽度。</div>
              </div>
              <button className="button button-ghost" type="button" onClick={() => setDrawerOpen(false)}>
                收起
              </button>
            </div>

            <div className="ledger-side-drawer-body">
              {selectedCustomer?.hasUnclassifiedArchives ? (
                <article className="card quality-card ledger-drawer-priority-card">
                  <strong>当前选中主体存在未归类档案</strong>
                  <div>{selectedCustomer.unclassifiedArchiveCount}</div>
                  <span>{selectedCustomer.customerName}</span>
                  <span className="muted">
                    {displaySummary(selectedCustomer.projectNamesPreview, "暂无项目摘要")}
                  </span>
                </article>
              ) : null}
              <article className="card quality-card">
                <strong>主体数</strong>
                <div>{summary?.customerCount ?? 0}</div>
                <span>当前页口径下的业务往来主体数量。</span>
              </article>
              <article className="card quality-card">
                <strong>项目数</strong>
                <div>{summary?.projectCount ?? 0}</div>
                <span>主体展开后可查看项目明细。</span>
              </article>
              <article className="card quality-card">
                <strong>未归类档案</strong>
                <div>{summary?.totalUnclassifiedArchiveCount ?? 0}</div>
                <span>已挂主体客户，但尚未归入项目。</span>
              </article>
              <article className="card quality-card">
                <strong>当前排序</strong>
                <div>{sortOptions.find((item) => item.value === (filters.sortBy ?? "unpaidAmount"))?.label ?? "按未收金额"}</div>
                <span>{filters.sortOrder === "asc" ? "升序" : "降序"}</span>
              </article>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
