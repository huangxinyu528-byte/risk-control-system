"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { displayOptionalNote, displayOwnerValue } from "@/lib/display";
import { formatCurrency, formatOptionalText } from "@/lib/format";
import type { ContractPayload, ContractRecord, CustomerRecord } from "@/lib/types";

const emptyForm: ContractPayload = {
  contractId: "",
  customerId: "",
  projectName: "",
  contractNo: "",
  amount: 0,
  signedAt: null,
  billingPeriodDays: null,
  salesOwnerName: "",
  projectStatus: "执行中",
  remark: "",
};

const statusOptions = ["执行中", "待回款", "已完成", "已终止", "暂停中"];

export function ContractManagement() {
  const formId = useId();
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [form, setForm] = useState<ContractPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");

  async function loadCustomers() {
    const response = await fetch("/api/customers");
    const result = await response.json();
    setCustomers(result.data as CustomerRecord[]);
  }

  async function loadContracts() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (customerId) params.set("customerId", customerId);
    if (projectStatus) params.set("projectStatus", projectStatus);

    const response = await fetch(`/api/contracts?${params.toString()}`);
    const result = await response.json();
    setContracts(result.data as ContractRecord[]);
  }

  useEffect(() => {
    async function loadInitialData() {
      const [customerResponse, contractResponse] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/contracts"),
      ]);
      const [customerResult, contractResult] = await Promise.all([
        customerResponse.json(),
        contractResponse.json(),
      ]);
      setCustomers(customerResult.data as CustomerRecord[]);
      setContracts(contractResult.data as ContractRecord[]);
    }

    void loadInitialData();
  }, []);

  const getMissingFields = useMemo(
    () => (item: ContractRecord) =>
      [
        !item.signedAt ? "签订日期" : "",
        item.billingPeriodDays === null ? "账期" : "",
        !item.salesOwnerName || item.salesOwnerName === "待分配" ? "业务负责人" : "",
      ].filter(Boolean),
    [],
  );
  const startEditContract = (item: ContractRecord) => {
    setEditingId(item.id);
    setForm({
      contractId: item.contractId,
      customerId: item.customerId,
      projectName: item.projectName,
      contractNo: item.contractNo,
      amount: item.amount,
      signedAt: item.signedAt,
      billingPeriodDays: item.billingPeriodDays,
      salesOwnerName: item.salesOwnerName,
      projectStatus: item.projectStatus,
      remark: item.remark,
    });
    setFormOpen(true);
  };
  const filteredContracts = useMemo(
    () => (showIncompleteOnly ? contracts.filter((item) => getMissingFields(item).length > 0) : contracts),
    [contracts, getMissingFields, showIncompleteOnly],
  );
  const completionSummary = useMemo(
    () => ({
      incompleteContracts: contracts.filter((item) => getMissingFields(item).length > 0).length,
      missingSignedAt: contracts.filter((item) => !item.signedAt).length,
      missingBillingPeriod: contracts.filter((item) => item.billingPeriodDays === null).length,
      missingOwner: contracts.filter((item) => !item.salesOwnerName || item.salesOwnerName === "待分配").length,
    }),
    [contracts, getMissingFields],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/contracts/${editingId}` : "/api/contracts";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
    await loadContracts();
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImportFile(null);
    setImportMessage("");
  }

  return (
    <>
      <PageHeader title="合同管理" description="支持合同列表、搜索、新增、编辑、详情查看与筛选。" />

      <section className="management-toolbar card">
        <div className="toolbar-row toolbar-grid">
          <input
            className="search-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索客户编号、客户名称、项目名称、合同编号"
          />
          <select className="search-input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">按客户筛选</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.customerId}>
                  {customer.customerCode} / {customer.name}
                </option>
              ))}
          </select>
          <select className="search-input" value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
            <option value="">按项目状态筛选</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button className="button button-secondary" type="button" onClick={() => void loadContracts()}>
            查询
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setShowIncompleteOnly((current) => !current)}
          >
            {showIncompleteOnly ? "查看全部合同" : "仅看待补合同"}
          </button>
        </div>
      </section>

      <section className="quality-grid">
        <article className="card quality-card">
          <strong>待补合同</strong>
          <div>{completionSummary.incompleteContracts} 份</div>
          <span>建议优先补签订日期、账期和业务负责人。</span>
        </article>
        <article className="card quality-card">
          <strong>缺签订日期</strong>
          <div>{completionSummary.missingSignedAt} 份</div>
          <span>会影响履约阶段判断和合同时间轴。</span>
        </article>
        <article className="card quality-card">
          <strong>缺账期</strong>
          <div>{completionSummary.missingBillingPeriod} 份</div>
          <span>会影响应收预警和到期测算。</span>
        </article>
        <article className="card quality-card">
          <strong>缺业务负责人</strong>
          <div>{completionSummary.missingOwner} 份</div>
          <span>会影响责任归属和后续提醒。</span>
        </article>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h3>合同列表</h3>
          <span className="muted">当前显示 {filteredContracts.length} / 共 {contracts.length} 条</span>
          <button className="button button-primary" type="button" onClick={openCreateForm}>
            新增合同
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>客户编号</th>
              <th>客户名称</th>
              <th>项目名称</th>
              <th>合同编号</th>
              <th>合同金额</th>
              <th>签订日期</th>
              <th>账期</th>
              <th>业务负责人</th>
              <th>项目状态</th>
              <th>待补字段</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredContracts.map((item) => {
              const missingFields = getMissingFields(item);
              return <tr key={item.id}>
                <td>{item.customerCode || "待生成"}</td>
                <td>{item.customerName}</td>
                <td>{item.projectName}</td>
                <td>{item.contractNo}</td>
                <td>{formatCurrency(item.amount)}</td>
                <td>{formatOptionalText(item.signedAt, "待补数据")}</td>
                <td>{formatOptionalText(item.billingPeriodDays, "待补数据")}</td>
                <td>{displayOwnerValue(item.salesOwnerName)}</td>
                <td>{item.projectStatus}</td>
                <td>{missingFields.length ? missingFields.join("、") : "已完善"}</td>
                <td>
                  <div className="table-actions">
                    <button className="button button-ghost" type="button" onClick={() => setDetail(item)}>
                      查看
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => startEditContract(item)}
                    >
                      {missingFields.length ? "补录" : "编辑"}
                    </button>
                  </div>
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
              <h3>{editingId ? "编辑合同" : "新增合同"}</h3>
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
                      <p className="muted">用于批量导入合同。当前先开放上传入口和操作说明。</p>
                    </div>
                    <span className="status-tag neutral">合同导入待接后端</span>
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
                      onClick={() => {
                        if (!importFile) {
                          setImportMessage("请先选择合同 Excel 文件");
                          return;
                        }
                        setImportMessage("当前合同管理尚未接入独立 Excel 导入接口；本轮已完成弹窗入口和上传交互，后端导入链路待下一步接入。");
                      }}
                    >
                      导入合同 Excel
                    </button>
                  </div>
                  <span className="muted">
                    {importMessage || "当前阶段先完成前端入口；合同专用导入接口尚未打通。"}
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
                  ["contractId", "台账编号（可选）"],
                  ["projectName", "项目名称"],
                  ["contractNo", "合同编号"],
                  ["salesOwnerName", "业务负责人"],
                ].map(([field, label]) => (
                  <label className="form-row" key={field}>
                    <span>{label}</span>
                    <input
                      value={String(form[field as keyof ContractPayload] ?? "")}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                  </label>
                ))}
                <label className="form-row">
                  <span>合同金额</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, amount: Number(event.target.value) || 0 }))
                    }
                  />
                </label>
                <label className="form-row">
                  <span>签订日期</span>
                  <input
                    type="date"
                    value={form.signedAt ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, signedAt: event.target.value || null }))
                    }
                  />
                </label>
                <label className="form-row">
                  <span>账期</span>
                  <input
                    type="number"
                    value={form.billingPeriodDays ?? ""}
                    placeholder="可留空"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        billingPeriodDays: event.target.value === "" ? null : Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="form-row">
                  <span>项目状态</span>
                  <select
                    className="search-input"
                    value={form.projectStatus}
                    onChange={(event) => setForm((current) => ({ ...current, projectStatus: event.target.value }))}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  <span>备注</span>
                  <textarea
                    className="form-textarea"
                    value={form.remark}
                    onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
                  />
                </label>
              </form>
            </div>
            <div className="modal-footer">
              <button className="button button-ghost" type="button" onClick={closeForm}>
                取消
              </button>
              <button className="button button-primary" type="submit" form={formId}>
                {editingId ? "保存修改" : "创建合同"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {detail ? (
        <section className="detail-panel card">
          <div className="table-header">
            <h3>合同详情</h3>
            <div className="table-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => startEditContract(detail)}
              >
                {getMissingFields(detail).length ? "去补录" : "编辑合同"}
              </button>
              <button className="button button-ghost" type="button" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
          </div>
          {getMissingFields(detail).length ? (
            <div className="inline-notice inline-notice-warning">
              合同信息待补：{getMissingFields(detail).join("、")}
            </div>
          ) : null}
          <div className="detail-grid">
            <div><strong>台账编号：</strong>{detail.contractId}</div>
            <div><strong>客户编号：</strong>{detail.customerCode || "待生成"}</div>
            <div><strong>客户名称：</strong>{detail.customerName}</div>
            <div><strong>项目名称：</strong>{detail.projectName}</div>
            <div><strong>合同编号：</strong>{detail.contractNo}</div>
            <div><strong>合同金额：</strong>{formatCurrency(detail.amount)}</div>
            <div><strong>签订日期：</strong>{formatOptionalText(detail.signedAt, "待补数据")}</div>
            <div><strong>账期：</strong>{formatOptionalText(detail.billingPeriodDays, "待补数据")}</div>
            <div><strong>业务负责人：</strong>{displayOwnerValue(detail.salesOwnerName)}</div>
            <div><strong>项目状态：</strong>{detail.projectStatus}</div>
            <div className="detail-full">
              <strong>待补字段：</strong>
              {getMissingFields(detail).length ? getMissingFields(detail).join("、") : "已完善"}
            </div>
            <div className="detail-full"><strong>备注：</strong>{displayOptionalNote(detail.remark)}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}
