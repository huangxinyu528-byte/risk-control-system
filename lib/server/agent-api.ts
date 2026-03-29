import type { NextRequest } from "next/server";
import {
  displayBaseValue,
  displayCreditLevel,
  displayOwnerValue,
  displayOptionalNote,
} from "@/lib/display";
import {
  computeCustomerRisk,
  getCustomerById,
  getHighRiskCustomerById,
  getKeyAttentionCustomerById,
  getDashboardOverview,
  listCollectionItems,
  listCreditScores,
  listCustomers,
  listHighRiskCustomers,
  listKeyAttentionCustomers,
  listReceivables,
  listRisks,
} from "@/lib/server/data-access";

const AGENT_API_SCHEMA_VERSION = "v1";

export function assertAgentAccess(_request: NextRequest) {
  // Auth placeholder:
  // First version keeps Agent API open for local development.
  // Future versions should validate an internal token, service signature,
  // or allowlist before returning any data to OpenClaw.
  return true;
}

function buildAgentMeta(sourceScope: string) {
  return {
    schema_version: AGENT_API_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_scope: sourceScope,
  };
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function getNameMatchType(query: string, customerName: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(customerName);

  if (normalizedName === normalizedQuery) {
    return "exact";
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return "prefix";
  }
  return "fuzzy";
}

function agentBaseValue(value: string | number | null | undefined) {
  return displayBaseValue(value);
}

function agentOwnerValue(value: string | null | undefined) {
  return displayOwnerValue(value);
}

function agentCreditLevel(value: string | null | undefined) {
  return displayCreditLevel(value);
}

function agentRemarkValue(value: string | null | undefined) {
  return displayOptionalNote(value);
}

function buildFallbackManagementSummary(args: {
  highRisk: boolean;
  keyAttention: boolean;
  riskCount: number;
  receivableBalance: number;
  overduePeriods: number;
}) {
  if (args.highRisk) {
    return "该客户当前已进入高风险范围，建议管理层持续关注回款、授信和风险处置进展。";
  }
  if (args.keyAttention) {
    return "该客户当前处于重点关注范围，建议保持跟进并提前做好风险干预安排。";
  }
  if (args.overduePeriods > 0) {
    return "该客户当前存在逾期期间账款，建议优先关注回款覆盖进度和后续到期压力。";
  }
  if (args.riskCount > 0) {
    return "该客户当前存在风险记录，建议结合风险类型和应收情况继续跟进。";
  }
  if (args.receivableBalance > 0) {
    return "该客户当前存在未收账款，建议结合回款进度持续关注。";
  }
  return "该客户当前暂无显著异常，可继续按常规节奏跟进。";
}

export async function buildAgentCustomerProfile(customerId: string) {
  const customer = await getCustomerById(customerId);

  if (!customer) {
    return null;
  }

  return {
    meta: buildAgentMeta("customer_profile"),
    customer_profile: {
      customer_code: customer.customerCode || customer.customerId,
      customer_name: customer.name,
      customer_nature: agentBaseValue(customer.customerNature),
      has_guarantee: Boolean(customer.hasGuarantee),
      credit_standing: agentBaseValue(customer.creditStanding),
      due_diligence_completed: Boolean(customer.dueDiligenceCompleted),
      current_credit_level: agentCreditLevel(customer.currentCreditLevel),
      institutional_credit_score: customer.creditScore ?? "待补数据",
      institutional_credit_level: agentCreditLevel(customer.creditLevel),
      risk_action: agentBaseValue(customer.riskAction),
      risk_status: agentBaseValue(customer.riskStatus),
      sales_owner_name: agentOwnerValue(customer.salesOwnerName),
      credit_limit: customer.creditLimit,
      key_attention_customer: Boolean(customer.keyAttentionCustomer),
      stop_supply: customer.stopSupply,
      high_risk_customer: Boolean(customer.highRiskCustomer),
      remark: agentRemarkValue(customer.remark),
    },
  };
}

export async function buildAgentCustomerSearchByName(name: string) {
  const keyword = name.trim();

  if (!keyword) {
    return {
      meta: buildAgentMeta("customer_search"),
      query: {
        name: "",
      },
      total: 0,
      customers: [],
    };
  }

  const customers = await listCustomers({ keyword });
  const normalizedKeyword = normalizeSearchText(keyword);

  const matchedCustomers = customers
    .filter((item) => normalizeSearchText(item.name).includes(normalizedKeyword))
    .map((item) => ({
      customer_id: item.customerId,
      customer_code: item.customerCode || item.customerId,
      customer_name: item.name,
      match_type: getNameMatchType(keyword, item.name),
      next_risk_summary_path: `/api/agent/customers/${encodeURIComponent(item.customerId)}/risk-summary`,
    }))
    .sort((left, right) => {
      const score = { exact: 0, prefix: 1, fuzzy: 2 };
      return (
        score[left.match_type as keyof typeof score] - score[right.match_type as keyof typeof score] ||
        left.customer_name.localeCompare(right.customer_name, "zh-CN")
      );
    });

  return {
    meta: buildAgentMeta("customer_search"),
    query: {
      name: keyword,
    },
    total: matchedCustomers.length,
    customers: matchedCustomers,
  };
}

export async function buildAgentCustomerRiskSummary(customerId: string) {
  const profile = await buildAgentCustomerProfile(customerId);

  if (!profile) {
    return null;
  }

  const [receivables, risks, scores, highRiskDetail, keyAttentionDetail] = await Promise.all([
    listReceivables({ customerId }),
    listRisks({ customerId }),
    listCreditScores(),
    getHighRiskCustomerById(customerId),
    getKeyAttentionCustomerById(customerId),
  ]);
  const customer = await getCustomerById(customerId);
  const computedRisk = customer ? await computeCustomerRisk(customer) : null;

  const customerScores = scores
    .filter((item) => item.customerId === customerId)
    .sort((a, b) => b.scoreDate.localeCompare(a.scoreDate));

  const latestRisk = [...risks].sort((a, b) => b.riskTime.localeCompare(a.riskTime))[0] ?? null;
  const receivableBalance = receivables.reduce((sum, item) => sum + item.unpaidAmount, 0);
  const overduePeriods = receivables
    .filter((item) => (item.overdueDays ?? 0) > 0)
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  const settledCount = receivables.filter((item) => item.isSettled).length;
  const managementSummary =
    highRiskDetail?.managementSummary ||
    keyAttentionDetail?.managementSummary ||
    buildFallbackManagementSummary({
      highRisk: Boolean(profile.customer_profile.high_risk_customer),
      keyAttention: Boolean(profile.customer_profile.key_attention_customer),
      riskCount: risks.length,
      receivableBalance,
      overduePeriods: overduePeriods.length,
    });
  const remark = agentRemarkValue(
    highRiskDetail?.riskRemark || keyAttentionDetail?.riskRemark || profile.customer_profile.remark,
  );

  return {
    meta: buildAgentMeta("customer_risk_summary"),
    customer_profile: {
      customer_code: profile.customer_profile.customer_code,
      customer_name: profile.customer_profile.customer_name,
      current_credit_level: agentCreditLevel(profile.customer_profile.current_credit_level),
      institutional_credit_score: profile.customer_profile.institutional_credit_score,
      institutional_credit_level: profile.customer_profile.institutional_credit_level,
      risk_action: profile.customer_profile.risk_action,
      risk_status: profile.customer_profile.risk_status,
      sales_owner_name: agentOwnerValue(profile.customer_profile.sales_owner_name),
      credit_limit: profile.customer_profile.credit_limit,
      key_attention_customer: profile.customer_profile.key_attention_customer,
      stop_supply: profile.customer_profile.stop_supply,
    },
    risk_summary: {
      current_receivable_balance: receivableBalance,
      current_credit_level: agentCreditLevel(profile.customer_profile.current_credit_level),
      risk_record_count: risks.length,
      overdue_periods: overduePeriods.map((item) => ({
        period: agentBaseValue(item.period),
        project_name: item.projectName,
        due_date: agentBaseValue(item.dueDate),
        overdue_days: item.overdueDays ?? 0,
        unpaid_amount: item.unpaidAmount,
        aging_bucket: agentBaseValue(item.agingBucket),
      })),
      payment_coverage: {
        total_periods: receivables.length,
        settled_periods: settledCount,
        unsettled_periods: receivables.length - settledCount,
        settled_ratio: receivables.length > 0 ? Number((settledCount / receivables.length).toFixed(4)) : 0,
      },
      latest_risk_event: latestRisk
        ? {
            risk_type: latestRisk.riskType,
            risk_time: latestRisk.riskTime,
            risk_source: latestRisk.riskSource,
            risk_level: latestRisk.riskLevel,
            handled: latestRisk.handled,
            remark: agentRemarkValue(latestRisk.remark),
          }
        : {
            risk_type: "待补数据",
            risk_time: "待补数据",
            risk_source: "待补数据",
            risk_level: "待补数据",
            handled: false,
            remark: "",
          },
      computed_risk: {
        conclusion: computedRisk?.level ?? "低风险",
        reasons: computedRisk?.reasons ?? [],
        actions: computedRisk?.actions ?? [],
      },
      latest_credit_score: customerScores[0]
        ? {
            credit_score: customerScores[0].creditScore,
            total_score: customerScores[0].totalScore,
            credit_level: customerScores[0].creditLevel,
            risk_action: customerScores[0].riskAction,
            risk_status: customerScores[0].riskStatus,
            score_date: customerScores[0].scoreDate,
            key_attention: customerScores[0].keyAttention,
          }
        : null,
      high_risk_customer: Boolean(profile.customer_profile.high_risk_customer),
      key_attention_customer: Boolean(profile.customer_profile.key_attention_customer),
      credit_limit: profile.customer_profile.credit_limit,
      management_summary: managementSummary,
      remark,
    },
  };
}

export async function buildAgentDashboardSummary() {
  const [data, risks, collections] = await Promise.all([
    getDashboardOverview(),
    listRisks(),
    listCollectionItems(),
  ]);

  return {
    meta: buildAgentMeta("dashboard_summary"),
    dashboard_summary: {
      receivable_total_amount: data.stats.find((item) => item.label === "应收账款总额")?.value ?? "待补数据",
      received_total_amount: data.stats.find((item) => item.label === "已收金额")?.value ?? "待补数据",
      unpaid_total_amount: data.stats.find((item) => item.label === "未收金额")?.value ?? "待补数据",
      overdue_customer_count: Number(
        data.stats.find((item) => item.label === "逾期客户数")?.value ?? 0,
      ),
      overdue_amount: data.stats.find((item) => item.label === "逾期金额")?.value ?? "待补数据",
      overdue_60_plus_amount:
        data.stats.find((item) => item.label === "60天以上金额")?.value ?? "待补数据",
      settled_ratio: data.stats.find((item) => item.label === "已结清比例")?.value ?? "待补数据",
      c_level_customer_count: data.focusSummary.cLevelCustomers,
      collection_customer_count: data.focusSummary.collectionCustomers,
      score_down_customer_count: data.focusSummary.scoreDownCustomers,
      litigation_customer_count: data.focusSummary.litigationCustomers,
      high_risk_customer_count: data.focusSummary.highRiskCustomers,
      key_attention_customer_count: data.focusSummary.keyAttentionCustomers,
      risk_record_count: risks.length,
      collection_focus_summary: collections.slice(0, 5).map((item) => ({
        customer_code: item.customerCode || item.customerId,
        customer_name: item.customerName,
        unpaid_amount: item.unpaidAmount,
        current_credit_level: agentCreditLevel(item.currentCreditLevel),
        current_measure: agentBaseValue(item.currentMeasure),
        owner_name: agentOwnerValue(item.ownerName),
        follow_up_status: agentBaseValue(item.followUpStatus),
      })),
    },
  };
}

export async function buildAgentMonthlyReport(month: string) {
  const [customers, receivables, risks, scores, collections, dashboard, highRiskCustomers, keyAttentionCustomers] =
    await Promise.all([
      listCustomers(),
      listReceivables(),
      listRisks(),
      listCreditScores({ scoreMonth: month }),
      listCollectionItems(),
      getDashboardOverview(),
      listHighRiskCustomers(),
      listKeyAttentionCustomers(),
    ]);

  const riskEventsInMonth = risks.filter((item) => item.riskTime.startsWith(month));
  const receivableTotal = receivables.reduce((sum, item) => sum + item.amount, 0);
  const receivedTotal = receivables.reduce((sum, item) => sum + item.receivedAmount, 0);
  const unpaidTotal = receivables.reduce((sum, item) => sum + item.unpaidAmount, 0);
  const gradeDistribution = Object.entries(
    customers.reduce<Record<string, number>>((acc, customer) => {
      const level = agentCreditLevel(customer.currentCreditLevel);
      acc[level] = (acc[level] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([level, count]) => ({ credit_level: level, customer_count: count }));

  return {
    meta: {
      ...buildAgentMeta("monthly_report_package"),
      report_month: month,
    },
    report_month: month,
    monthly_report_package: {
      customer_grade_distribution: gradeDistribution,
      high_risk_customer_list: highRiskCustomers.map((item) => ({
        customer_code: item.customerCode || item.customerId,
        customer_name: item.customerName,
        current_credit_level: agentCreditLevel(item.currentCreditLevel),
        receivable_balance: item.receivableBalance,
        risk_level: item.riskLevel,
        management_summary: item.managementSummary,
        remark: agentRemarkValue(item.riskRemark),
      })),
      key_attention_customer_list: keyAttentionCustomers.map((item) => ({
        customer_code: item.customerCode || item.customerId,
        customer_name: item.customerName,
        current_credit_level: agentCreditLevel(item.currentCreditLevel),
        receivable_balance: item.receivableBalance,
        attention_level: item.attentionLevel,
        management_summary: item.managementSummary,
        remark: agentRemarkValue(item.riskRemark),
      })),
      receivable_overview: {
        receivable_total_amount: receivableTotal,
        received_total_amount: receivedTotal,
        unpaid_total_amount: unpaidTotal,
        overdue_customer_count: Number(
          dashboard.stats.find((item) => item.label === "逾期客户数")?.value ?? 0,
        ),
        overdue_amount: dashboard.stats.find((item) => item.label === "逾期金额")?.value ?? "待补数据",
        overdue_60_plus_amount:
          dashboard.stats.find((item) => item.label === "60天以上金额")?.value ?? "待补数据",
        settled_ratio: dashboard.stats.find((item) => item.label === "已结清比例")?.value ?? "待补数据",
        customer_count: customers.length,
        high_risk_customer_count: dashboard.focusSummary.highRiskCustomers,
        key_attention_customer_count: dashboard.focusSummary.keyAttentionCustomers,
        c_level_customer_count: dashboard.focusSummary.cLevelCustomers,
        collection_customer_count: dashboard.focusSummary.collectionCustomers,
        score_down_customer_count: dashboard.focusSummary.scoreDownCustomers,
        litigation_customer_count: dashboard.focusSummary.litigationCustomers,
      },
      risk_event_summary: {
        risk_record_count: risks.length,
        monthly_risk_event_count: riskEventsInMonth.length,
        risk_events: riskEventsInMonth.map((item) => ({
          customer_code: item.customerCode || item.customerId,
          customer_name: item.customerName,
          risk_type: item.riskType,
          risk_level: item.riskLevel,
          risk_source: item.riskSource,
          risk_time: item.riskTime,
          handled: item.handled,
          remark: agentRemarkValue(item.remark),
        })),
      },
      management_suggestion_raw_data: {
        dashboard_focus_summary: {
          highRiskCustomers: dashboard.focusSummary.highRiskCustomers,
          keyAttentionCustomers: dashboard.focusSummary.keyAttentionCustomers,
        },
        credit_reference: {
          rule_status: "未启用",
          description: "信用额度字段当前仅作为辅助参考信息，不参与默认风险判断。",
        },
        key_collection_targets: dashboard.collectionTopCustomers.map((item) => ({
          customer_name: item.customerName,
          unpaid_amount: item.unpaidAmount,
          overdue_days: item.overdueDays ?? "未计算",
          risk_status: item.riskStatus,
        })),
        collection_focus_summary: collections.slice(0, 10).map((item) => ({
          customer_code: item.customerCode || item.customerId,
          customer_name: item.customerName,
          unpaid_amount: item.unpaidAmount,
          current_credit_level: agentCreditLevel(item.currentCreditLevel),
          current_measure: agentBaseValue(item.currentMeasure),
          owner_name: agentOwnerValue(item.ownerName),
          follow_up_status: agentBaseValue(item.followUpStatus),
          openclaw_summary: agentRemarkValue(item.openclawSummary),
        })),
        overdue_period_snapshot: receivables
          .filter((item) => (item.overdueDays ?? 0) > 0)
          .slice(0, 20)
          .map((item) => ({
            customer_code: item.customerCode || item.customerId,
            customer_name: item.customerName,
            period: agentBaseValue(item.period),
            project_name: item.projectName,
            due_date: agentBaseValue(item.dueDate),
            overdue_days: item.overdueDays ?? 0,
            aging_bucket: agentBaseValue(item.agingBucket),
            is_settled: item.isSettled,
            unpaid_amount: item.unpaidAmount,
          })),
        score_snapshot: scores.map((item) => ({
          customer_code: item.customerCode || item.customerId,
          customer_name: item.customerName,
          credit_score: item.creditScore,
          total_score: item.totalScore,
          credit_level: item.creditLevel,
          risk_action: item.riskAction,
          risk_status: item.riskStatus,
          score_delta: item.scoreDelta,
          key_attention: item.keyAttention,
          description: agentRemarkValue(item.description),
        })),
      },
    },
  };
}
