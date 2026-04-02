"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  displayBaseValue,
  displayComputedValue,
  displayOwnerValue,
} from "@/lib/display";
import { formatCurrency, formatOptionalText, formatPercent } from "@/lib/format";
import type {
  CustomerRecord,
  ReceivablePayload,
  ReceivableRecord,
} from "@/lib/types";

const emptyForm: ReceivablePayload = {
  customerId: "",
  projectName: "",
  contractReceivable: 0,
  cumulativeReceivable: 0,
  statementDate: null,
  businessType: "",
  timeNode: "",
  remark: "",
  period: "",
  paymentTerm: null,
  baseDate: null,
  amount: 0,
  receivedAmount: 0,
  monthlyReceivedAmount: 0,
  salesOwnerName: "",
  billingPeriodDays: null,
  dueDate: null,
  receivedDate: null,
  overdueDays: null,
  agingBucket: null,
  riskStatus: "正常",
  receivableStatus: "正常",
};

function formatReceivableStatus(value: string) {
  if (!value) {
    return "待补数据";
  }
  if (value === "pending") {
    return "待跟进";
  }
  if (value === "normal") {
    return "正常";
  }
  if (value === "overdue") {
    return "已逾期";
  }
  if (value === "completed") {
    return "已回款";
  }
  return value;
}

const paymentTermOptions = ["次月10号", "次月20号", "次月月底", "30天", "60天", "90天"];

export function ReceivableManagement() {
  const formId = useId();
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesOwnerName, setSalesOwnerName] = useState("");
  const [riskStatus, setRiskStatus] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [form, setForm] = useState<ReceivablePayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");

  async function loadCustomers() {
    const response = await fetch("/api/customers");
    const result = await response.json();
    setCustomers(result.data as CustomerRecord[]);
  }

  async function loadReceivables() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (customerId) params.set("customerId", customerId);
    if (salesOwnerName) params.set("salesOwnerName", salesOwnerName);
    if (riskStatus) params.set("riskStatus", riskStatus);
    if (businessType) params.set("businessType", businessType);

    const response = await fetch(`/api/receivables?${params.toString()}`);
    const result = await response.json();
    setReceivables(result.data as ReceivableRecord[]);
  }

  useEffect(() => {
    void Promise.all([loadCustomers(), loadReceivables()]);
  }, []);

  const salesOptions = useMemo(
    () => Array.from(new Set(customers.map((item) => item.salesOwnerName).filter(Boolean))),
    [customers],
  );

  const riskStatusOptions = useMemo(
    () => Array.from(new Set(receivables.map((item) => item.riskStatus).filter(Boolean))),
    [receivables],
  );
  const getMissingFields = useMemo(
    () => (item: ReceivableRecord) =>
      [
        !item.period ? "期间" : "",
        !item.salesOwnerName || item.salesOwnerName === "待分配" ? "责任人" : "",
        !item.paymentTerm ? "付款周期" : "",
        !item.baseDate ? "起算日期" : "",
        item.dueDate === null ? "到期日" : "",
        item.overdueDays === null ? "逾期天数" : "",
        item.agingBucket === null ? "账龄阶段" : "",
      ].filter(Boolean),
    [],
  );
  const filteredReceivables = useMemo(
    () => (showIncompleteOnly ? receivables.filter((item) => getMissingFields(item).length > 0) : receivables),
    [getMissingFields, receivables, showIncompleteOnly],
  );
  const completionSummary = useMemo(
    () => ({
      incompleteReceivables: receivables.filter((item) => getMissingFields(item).length > 0).length,
      missingBilling: receivables.filter((item) => !item.paymentTerm).length,
      missingDueDate: receivables.filter((item) => item.dueDate === null).length,
      missingOwner: receivables.filter((item) => !item.salesOwnerName || item.salesOwnerName === "待分配").length,
    }),
    [getMissingFields, receivables],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/receivables/${editingId}` : "/api/receivables";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
    await loadReceivables();
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
    setImportFile(null);
    setImportMessage("");
  }

  return (
    <>
      <PageHeader title="应收账款管理" description="支持搜索、筛选、新增和编辑，并自动计算未收金额和回款率。" />

      <section className="management-toolbar card">
        <div className="toolbar-row toolbar-grid">
          <input
            className="search-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索客户编号、客户名称、项目名称、应收编号、责任人"
          />
          <select className="search-input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">按客户筛选</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.customerId}>
                  {customer.customerCode} / {customer.name}
                </option>
              ))}
          </select>
          <select className="search-input" value={salesOwnerName} onChange={(event) => setSalesOwnerName(event.target.value)}>
            <option value="">按责任人筛选</option>
            {salesOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <select className="search-input" value={riskStatus} onChange={(event) => setRiskStatus(event.target.value)}>
            <option value="">按账款标签筛选</option>
            {riskStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select className="search-input" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
            <option value="">按业务类型筛选</option>
            <option value="尾款">尾款</option>
            <option value="待起诉">待起诉</option>
            <option value="已诉">已诉</option>
          </select>
          <button className="button button-secondary" type="button" onClick={() => void loadReceivables()}>
            查询
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setShowIncompleteOnly((current) => !current)}
          >
            {showIncompleteOnly ? "查看全部账款" : "仅看待补账款"}
          </button>
        </div>
      </section>

      <section className="quality-grid">
        <article className="card quality-card">
          <strong>待补账款</strong>
          <div>{completionSummary.incompleteReceivables} 条</div>
          <span>建议优先补账期、到期日和责任人。</span>
        </article>
        <article className="card quality-card">
          <strong>缺账期</strong>
          <div>{completionSummary.missingBilling} 条</div>
          <span>会影响到期日自动计算和逾期判断。</span>
        </article>
        <article className="card quality-card">
          <strong>缺到期日</strong>
          <div>{completionSummary.missingDueDate} 条</div>
          <span>会影响到期提醒和催收节奏安排。</span>
        </article>
        <article className="card quality-card">
          <strong>缺责任人</strong>
          <div>{completionSummary.missingOwner} 条</div>
          <span>会影响后续手动跟进和责任分派。</span>
        </article>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h3>应收账款列表</h3>
          <span className="muted">当前显示 {filteredReceivables.length} / 共 {receivables.length} 条</span>
          <button className="button button-primary" type="button" onClick={openCreateForm}>
            新增账款
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>客户名称</th>
              <th>项目名称</th>
              <th>业务类型</th>
              <th>期间</th>
              <th>应收金额</th>
              <th>已收金额</th>
              <th>未收金额</th>
              <th>累计应收</th>
              <th>本月回款</th>
              <th>回款率</th>
              <th>付款周期</th>
              <th>到期日</th>
              <th>逾期天数</th>
              <th>账龄阶段</th>
              <th>是否结清</th>
              <th>账款标签</th>
              <th>回款状态</th>
              <th>逾期规则</th>
              <th>备注</th>
              <th>待补字段</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceivables.map((item) => {
              const missingFields = getMissingFields(item);
              return <tr key={item.id}>
                <td>{item.customerCode ? `${item.customerCode} / ${item.customerName}` : item.customerName}</td>
                <td>{item.projectName}</td>
                <td>{displayBaseValue(item.businessType)}</td>
                <td>{displayBaseValue(item.period)}</td>
                <td>{formatCurrency(item.amount)}</td>
                <td>{formatCurrency(item.receivedAmount)}</td>
                <td>{formatCurrency(item.unpaidAmount)}</td>
                <td>{formatCurrency(item.cumulativeReceivable)}</td>
                <td>{formatCurrency(item.monthlyReceivedAmount)}</td>
                <td>{formatPercent(item.paymentRate)}</td>
                <td>{formatOptionalText(item.paymentTerm, "待补数据")}</td>
                <td>{formatOptionalText(item.dueDate, "待补数据")}</td>
                <td>{displayComputedValue(item.overdueDays)}</td>
                <td>{displayComputedValue(item.agingBucket)}</td>
                <td>{item.isSettled ? "是" : "否"}</td>
                <td>{displayBaseValue(item.riskStatus)}</td>
                <td>{formatReceivableStatus(item.receivableStatus)}</td>
                <td>
                  {item.overdueRuleStatus === "未启用"
                    ? "未启用"
                    : `${item.overdueRuleStatus}${item.manualStatusMaintained ? " / 人工维护" : ""}`}
                </td>
                <td>{displayBaseValue(item.remark)}</td>
                <td>{missingFields.length ? missingFields.join("、") : "已完善"}</td>
                <td>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setForm({
                        customerId: item.customerId,
                        projectName: item.projectName,
                        contractReceivable: item.contractReceivable,
                        cumulativeReceivable: item.cumulativeReceivable,
                        statementDate: item.statementDate,
                        businessType: item.businessType,
                        timeNode: item.timeNode,
                        remark: item.remark,
                        period: item.period,
                        paymentTerm: item.paymentTerm,
                        baseDate: item.baseDate,
                        amount: item.amount,
                        receivedAmount: item.receivedAmount,
                        monthlyReceivedAmount: item.monthlyReceivedAmount,
                        salesOwnerName: item.salesOwnerName,
                        billingPeriodDays: item.billingPeriodDays,
                        dueDate: item.dueDate,
                        receivedDate: item.receivedDate,
                        overdueDays: item.overdueDays,
                        agingBucket: item.agingBucket,
                        riskStatus: item.riskStatus,
                        receivableStatus: formatReceivableStatus(item.receivableStatus),
                      });
                      setFormOpen(true);
                    }}
                  >
                    {missingFields.length ? "补录" : "编辑"}
                  </button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </section>

      {formOpen ? (
        <div className="modal-overlay" onClick={closeForm}>
          <section className="modal-card modal-card-form" onClick={(event) => event.stopPropagation()}>
            <div className="table-header">
              <h3>{editingId ? "编辑账款" : "新增账款"}</h3>
              <div className="table-actions">
                <button className="button button-ghost" type="button" onClick={closeForm}>
                  关闭
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-intro-stack">
                <section className="modal-import-card">
                  <div className="modal-import-header">
                    <div>
                      <strong>Excel 导入</strong>
                      <p className="muted">支持上传应收账款情况汇总表，自动解析并写入当前系统数据层。</p>
                    </div>
                    <span className="status-tag success">已接通导入接口</span>
                  </div>
                  <div className="modal-import-actions">
                    <input
                      className="search-input"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                    />
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={async () => {
                        if (!importFile) {
                          setImportMessage("请先选择 Excel 文件");
                          return;
                        }

                        const body = new FormData();
                        body.append("file", importFile);
                        const response = await fetch("/api/import/excel", { method: "POST", body });
                        const result = await response.json();

                        if (!response.ok || !result.success) {
                          setImportMessage(result.message ?? "Excel 导入失败");
                          return;
                        }

                        setImportMessage(
                          `导入完成：客户 ${result.data.summary.customers} 条，项目 ${result.data.summary.projects} 条，应收 ${result.data.summary.receivables} 条，风险 ${result.data.summary.risks} 条。`,
                        );
                        setImportFile(null);
                        await Promise.all([loadCustomers(), loadReceivables()]);
                      }}
                    >
                      导入账款 Excel
                    </button>
                  </div>
                  <span className="muted">
                    {importMessage || "可先走批量导入，再继续手动补录个别字段。"}
                  </span>
                </section>
              </div>
              <form id={formId} className="form-layout modal-form-layout" onSubmit={handleSubmit}>
                <div className="form-section-title">手动新增 / 编辑</div>
                <label className="form-row">
                  <span>客户</span>
                  <select
                    className="search-input"
                    value={form.customerId}
                    onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                  >
                    <option value="">请选择客户</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.customerId}>
                        {customer.customerCode} / {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  ["projectName", "项目名称"],
                  ["businessType", "业务类型"],
                  ["timeNode", "时间节点"],
                  ["period", "期间"],
                  ["salesOwnerName", "责任人"],
                  ["receivableStatus", "回款状态"],
                  ["riskStatus", "账款标签"],
                ].map(([field, label]) => (
                  <label className="form-row" key={field}>
                    <span>{label}</span>
                    <input
                      value={String(form[field as keyof ReceivablePayload] ?? "")}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                  </label>
                ))}
                <label className="form-row">
                  <span>对账日期</span>
                  <input
                    type="date"
                    value={form.statementDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, statementDate: event.target.value || null }))
                    }
                  />
                </label>
                <label className="form-row">
                  <span>付款周期</span>
                  <select
                    className="search-input"
                    value={form.paymentTerm ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentTerm: event.target.value || null,
                        billingPeriodDays: event.target.value.endsWith("天")
                          ? Number(event.target.value.replace("天", ""))
                          : null,
                      }))
                    }
                  >
                    <option value="">请选择付款周期</option>
                    {paymentTermOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  <span>起算日期</span>
                  <input
                    type="date"
                    value={form.baseDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        baseDate: event.target.value || null,
                      }))
                    }
                  />
                </label>
                {[
                  ["contractReceivable", "合同应收"],
                  ["cumulativeReceivable", "累计应收"],
                  ["amount", "应收金额"],
                  ["receivedAmount", "已收金额"],
                  ["monthlyReceivedAmount", "本月回款"],
                ].map(([field, label]) => (
                  <label className="form-row" key={field}>
                    <span>{label}</span>
                    <input
                      type="number"
                      value={Number(form[field as keyof ReceivablePayload] ?? 0)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field]: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="form-row">
                  <span>实际回款日期</span>
                  <input
                    type="date"
                    value={form.receivedDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        receivedDate: event.target.value || null,
                      }))
                    }
                  />
                </label>
                <label className="form-row">
                  <span>备注</span>
                  <textarea
                    className="form-textarea"
                    value={form.remark}
                    onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
                  />
                </label>

                <div className="calc-card">
                  <div>未收金额：{formatCurrency(Math.max(form.amount - form.receivedAmount, 0))}</div>
                  <div>回款率：{formatPercent(form.amount > 0 ? form.receivedAmount / form.amount : 0)}</div>
                  <div>是否结清：{form.receivedAmount >= form.amount && form.amount > 0 ? "是" : "否"}</div>
                  <div>
                    到期日：
                    {form.paymentTerm && form.baseDate ? "将根据付款周期自动计算" : "待补数据"}
                  </div>
                  <div>逾期判断：{form.paymentTerm && form.baseDate ? "已启用" : "未启用（待补数据）"}</div>
                  <div>责任人：{displayOwnerValue(form.salesOwnerName)}</div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="button button-ghost" type="button" onClick={closeForm}>
                取消
              </button>
              <button className="button button-primary" type="submit" form={formId}>
                {editingId ? "保存修改" : "创建账款"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
