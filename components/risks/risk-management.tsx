"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { displayOptionalNote } from "@/lib/display";
import type {
  CustomerRecord,
  RiskLevelLabel,
  RiskPayload,
  RiskRecordItem,
  RiskSourceLabel,
  RiskTypeOption,
} from "@/lib/types";

const riskTypes: RiskTypeOption[] = [
  "诉讼",
  "被执行人",
  "失信被执行人",
  "经营异常",
  "税务异常",
  "付款逾期",
  "沟通异常",
  "订单波动",
  "财务异常",
];

const riskSources: RiskSourceLabel[] = ["人工录入", "系统计算", "天眼查同步"];
const riskLevels: RiskLevelLabel[] = ["低", "中", "高", "重大"];

const emptyForm: RiskPayload = {
  customerId: "",
  riskType: "诉讼",
  riskTime: "",
  riskSource: "人工录入",
  riskLevel: "中",
  handled: false,
  handlingAction: "",
  followUpRecord: "",
  riskStatus: "待处理",
  remark: "",
};

export function RiskManagement() {
  const [risks, setRisks] = useState<RiskRecordItem[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [riskType, setRiskType] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [form, setForm] = useState<RiskPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskRecordItem | null>(null);

  async function loadCustomers() {
    const response = await fetch("/api/customers");
    const result = await response.json();
    setCustomers(result.data as CustomerRecord[]);
  }

  async function loadRisks() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (customerId) params.set("customerId", customerId);
    if (riskType) params.set("riskType", riskType);
    if (riskLevel) params.set("riskLevel", riskLevel);

    const response = await fetch(`/api/risks?${params.toString()}`);
    const result = await response.json();
    setRisks(result.data as RiskRecordItem[]);
  }

  useEffect(() => {
    async function loadInitialData() {
      const [customerResponse, riskResponse] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/risks"),
      ]);
      const [customerResult, riskResult] = await Promise.all([
        customerResponse.json(),
        riskResponse.json(),
      ]);
      setCustomers(customerResult.data as CustomerRecord[]);
      setRisks(riskResult.data as RiskRecordItem[]);
    }

    void loadInitialData();
  }, []);

  const startEditRisk = (item: RiskRecordItem) => {
    setEditingId(item.id);
    setForm({
      customerId: item.customerId,
      riskType: item.riskType,
      riskTime: item.riskTime,
      riskSource: item.riskSource,
      riskLevel: item.riskLevel,
      handled: item.handled,
      handlingAction: item.handlingAction ?? "",
      followUpRecord: item.followUpRecord ?? "",
      riskStatus: item.riskStatus ?? (item.handled ? "已关闭" : "待处理"),
      remark: item.remark,
    });
  };

  const getMissingFields = useMemo(
    () => (item: RiskRecordItem) =>
      [
        !item.riskTime ? "风险时间" : "",
        !item.riskSource ? "风险来源" : "",
        !item.riskLevel ? "风险等级" : "",
        !item.handlingAction ? "处理动作" : "",
        !item.remark ? "备注说明" : "",
      ].filter(Boolean),
    [],
  );
  const filteredRisks = useMemo(
    () => (showIncompleteOnly ? risks.filter((item) => getMissingFields(item).length > 0) : risks),
    [getMissingFields, risks, showIncompleteOnly],
  );
  const completionSummary = useMemo(
    () => ({
      incompleteRisks: risks.filter((item) => getMissingFields(item).length > 0).length,
      unhandledRisks: risks.filter((item) => !item.handled).length,
      missingRemark: risks.filter((item) => !item.remark).length,
      missingSource: risks.filter((item) => !item.riskSource).length,
    }),
    [getMissingFields, risks],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/risks/${editingId}` : "/api/risks";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingId(null);
    await loadRisks();
  }

  return (
    <>
      <PageHeader title="风险记录管理" description="适合财务和管理人员查看、筛选、记录与跟进风险事件。" />

      <section className="management-toolbar card">
        <div className="toolbar-row toolbar-grid">
          <input
            className="search-input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索客户编号、客户名称、风险类型、备注"
          />
          <select className="search-input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">按客户筛选</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.customerId}>
                  {customer.customerCode} / {customer.name}
                </option>
              ))}
          </select>
          <select className="search-input" value={riskType} onChange={(event) => setRiskType(event.target.value)}>
            <option value="">按风险类型筛选</option>
            {riskTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="search-input" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
            <option value="">按风险等级筛选</option>
            {riskLevels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="button button-secondary" type="button" onClick={() => void loadRisks()}>
            查询
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setShowIncompleteOnly((current) => !current)}
          >
            {showIncompleteOnly ? "查看全部风险" : "仅看待补风险"}
          </button>
        </div>
      </section>

      <section className="quality-grid">
        <article className="card quality-card">
          <strong>待补风险记录</strong>
          <div>{completionSummary.incompleteRisks} 条</div>
          <span>建议优先补处理动作、跟进记录和备注说明。</span>
        </article>
        <article className="card quality-card">
          <strong>待处理风险</strong>
          <div>{completionSummary.unhandledRisks} 条</div>
          <span>适合继续补录处理动作和跟进结论。</span>
        </article>
        <article className="card quality-card">
          <strong>缺备注说明</strong>
          <div>{completionSummary.missingRemark} 条</div>
          <span>会影响管理层理解和后续汇报。</span>
        </article>
        <article className="card quality-card">
          <strong>缺风险来源</strong>
          <div>{completionSummary.missingSource} 条</div>
          <span>会影响来源追溯和外部同步。</span>
        </article>
      </section>

      <section className="management-layout">
        <section className="table-card">
          <div className="table-header">
            <h3>风险记录列表</h3>
            <span className="muted">当前显示 {filteredRisks.length} / 共 {risks.length} 条</span>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              新增风险
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>风险类型</th>
                <th>风险时间</th>
                <th>风险来源</th>
                <th>风险等级</th>
                <th>处理状态</th>
                <th>处理动作</th>
                <th>备注</th>
                <th>待补字段</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((item) => {
                const missingFields = getMissingFields(item);
                return <tr key={item.id}>
                  <td>{item.customerCode ? `${item.customerCode} / ${item.customerName}` : item.customerName}</td>
                  <td>{item.riskType}</td>
                  <td>{item.riskTime}</td>
                  <td>{item.riskSource}</td>
                  <td>{item.riskLevel}</td>
                  <td>{item.riskStatus || (item.handled ? "已处理" : "待处理")}</td>
                  <td>{displayOptionalNote(item.handlingAction)}</td>
                  <td>{displayOptionalNote(item.remark)}</td>
                  <td>{missingFields.length ? missingFields.join("、") : "已完善"}</td>
                  <td>
                    <div className="table-actions">
                      <button className="button button-ghost" type="button" onClick={() => setDetail(item)}>
                        查看
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => startEditRisk(item)}
                      >
                        {missingFields.length || !item.handled ? "补充" : "编辑"}
                      </button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </section>

        <section className="form-card">
          <h3 style={{ marginTop: 0 }}>{editingId ? "编辑风险记录" : "新增风险记录"}</h3>
          <form className="form-layout" onSubmit={handleSubmit}>
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
            <label className="form-row">
              <span>风险类型</span>
              <select
                className="search-input"
                value={form.riskType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, riskType: event.target.value as RiskTypeOption }))
                }
              >
                {riskTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              <span>风险时间</span>
              <input
                type="date"
                value={form.riskTime}
                onChange={(event) => setForm((current) => ({ ...current, riskTime: event.target.value }))}
              />
            </label>
            <label className="form-row">
              <span>风险来源</span>
              <select
                className="search-input"
                value={form.riskSource}
                onChange={(event) =>
                  setForm((current) => ({ ...current, riskSource: event.target.value as RiskSourceLabel }))
                }
              >
                {riskSources.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              <span>风险等级</span>
              <select
                className="search-input"
                value={form.riskLevel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, riskLevel: event.target.value as RiskLevelLabel }))
                }
              >
                {riskLevels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.handled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, handled: event.target.checked }))
                }
              />
              <span>是否已处理</span>
            </label>
            <label className="form-row">
              <span>处理动作</span>
              <input
                value={form.handlingAction ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, handlingAction: event.target.value }))}
              />
            </label>
            <label className="form-row">
              <span>跟进记录</span>
              <textarea
                className="form-textarea"
                value={form.followUpRecord ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, followUpRecord: event.target.value }))}
              />
            </label>
            <label className="form-row">
              <span>风险状态</span>
              <input
                value={form.riskStatus ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, riskStatus: event.target.value }))}
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
            <button className="button button-primary" type="submit">
              {editingId ? "保存修改" : "创建风险记录"}
            </button>
          </form>
        </section>
      </section>

      {detail ? (
        <section className="detail-panel card">
          <div className="table-header">
            <h3>风险记录详情</h3>
            <div className="table-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => startEditRisk(detail)}
              >
                {!detail.handled || getMissingFields(detail).length ? "去补充" : "编辑记录"}
              </button>
              <button className="button button-ghost" type="button" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
          </div>
          {!detail.handled || getMissingFields(detail).length ? (
            <div className="inline-notice inline-notice-warning">
              风险记录待完善：{[
                !detail.handled ? "处理状态" : "",
                ...getMissingFields(detail),
              ].filter(Boolean).join("、")}
            </div>
          ) : null}
          <div className="detail-grid">
            <div><strong>客户编号：</strong>{detail.customerCode || "待生成"}</div>
            <div><strong>客户名称：</strong>{detail.customerName}</div>
            <div><strong>风险类型：</strong>{detail.riskType}</div>
            <div><strong>风险时间：</strong>{detail.riskTime}</div>
            <div><strong>风险来源：</strong>{detail.riskSource}</div>
            <div><strong>风险等级：</strong>{detail.riskLevel}</div>
            <div><strong>处理状态：</strong>{detail.riskStatus || (detail.handled ? "已处理" : "待处理")}</div>
            <div><strong>处理动作：</strong>{displayOptionalNote(detail.handlingAction)}</div>
            <div className="detail-full"><strong>跟进记录：</strong>{displayOptionalNote(detail.followUpRecord)}</div>
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
