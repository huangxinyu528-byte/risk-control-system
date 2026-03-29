export type UserRole = "admin" | "finance" | "sales" | "legal" | "management";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
};

export type NavigationItem = {
  label: string;
  href: string;
  roles?: UserRole[];
};

export type PageStat = {
  label: string;
  value: string;
  helper?: string;
};

export type CustomerRecord = {
  id: string;
  customerId: string;
  customerCode: string;
  name: string;
  normalizedName?: string;
  sourceCustomerName?: string;
  isMerged?: boolean;
  mergedIntoCustomerId?: string | null;
  creditStatus?: string;
  currentStatus?: string;
  customerNature?: string;
  hasGuarantee?: boolean;
  creditStanding?: string;
  dueDiligenceCompleted?: boolean;
  unifiedSocialCreditCode: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  salesOwnerName: string;
  currentCreditLevel: string;
  creditScore?: number | null;
  creditLevel?: string;
  riskAction?: string;
  riskStatus?: string;
  scoreDelta?: number | null;
  creditLimit: number | null;
  stopSupply: boolean;
  remark: string;
  riskRemark?: string;
  receivableBalance?: number;
  creditUtilizationRate?: number | null;
  creditUtilizationStatus?: "正常" | "预警" | "风险" | "超额度" | "未启用";
  highRiskCustomer?: boolean;
  keyAttentionCustomer?: boolean;
  ruleFlags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerPayload = Omit<
  CustomerRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type ReceivableRecord = {
  id: string;
  receivableNo: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  salesOwnerName: string;
  projectName: string;
  contractReceivable: number;
  cumulativeReceivable: number;
  statementDate: string | null;
  businessType: string;
  timeNode: string;
  remark: string;
  extraFields?: Record<string, unknown> | null;
  period: string;
  paymentTerm: string | null;
  baseDate: string | null;
  amount: number;
  receivedAmount: number;
  unpaidAmount: number;
  monthlyReceivedAmount: number;
  paymentRate: number;
  billingPeriodDays: number | null;
  dueDate: string | null;
  receivedDate: string | null;
  isSettled: boolean;
  overdueDays: number | null;
  agingBucket: string | null;
  riskStatus: string;
  receivableStatus: string;
  overdueRuleEnabled?: boolean;
  overdueRuleStatus?: "未启用" | "正常" | "预警";
  manualStatusMaintained?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReceivablePayload = {
  customerId: string;
  projectName: string;
  contractReceivable: number;
  cumulativeReceivable: number;
  statementDate: string | null;
  businessType: string;
  timeNode: string;
  remark: string;
  extraFields?: Record<string, unknown> | null;
  period: string;
  paymentTerm: string | null;
  baseDate: string | null;
  amount: number;
  receivedAmount: number;
  monthlyReceivedAmount: number;
  salesOwnerName: string;
  billingPeriodDays: number | null;
  dueDate: string | null;
  receivedDate: string | null;
  overdueDays: number | null;
  agingBucket: string | null;
  riskStatus: string;
  receivableStatus: string;
};

export type ProjectRecord = {
  id: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  projectName: string;
  normalizedProjectName?: string;
  projectAlias?: string | null;
  projectBelonging?: string | null;
  creditStatus?: string | null;
  currentStatus?: string | null;
  sourceCustomerName?: string | null;
  derivedFromCustomerName?: boolean;
  projectStatus: string;
  businessType?: string;
  paymentRate?: number;
  isOverdue?: boolean;
  tags?: string[];
  remark: string;
  receivableAmount: number;
  receivedAmount: number;
  unpaidAmount: number;
};

export type CustomerSummaryRecord = {
  totalReceivable: number;
  totalReceived: number;
  totalUnpaid: number;
  projectCount: number;
  riskConclusion: "高风险" | "中风险" | "低风险";
  riskReasons: string[];
  riskActions: string[];
};

export type CustomerFullProfileRecord = {
  customer: Pick<CustomerRecord, "id" | "customerId" | "customerCode" | "name" | "creditStatus" | "currentStatus" | "remark">;
  traceability?: {
    mergedSourceNames: string[];
  };
  summary: {
    totalReceivable: number;
    totalReceived: number;
    totalUnpaid: number;
    projectCount: number;
  };
  projects: Array<{
    id: string;
    projectName: string;
    projectAlias?: string | null;
    normalizedProjectName?: string;
    sourceCustomerName?: string | null;
    derivedFromCustomerName?: boolean;
    receivableAmount: number;
    receivedAmount: number;
    unpaidAmount: number;
    businessType: string;
    timeNode: string;
    remark: string;
  }>;
  risk: {
    conclusion: "高风险" | "中风险" | "低风险";
    reasons: string[];
    actions: string[];
    creditStatus: string;
    currentStatus: string;
    remark: string;
  };
};

export type CustomerLedgerArchiveRowRecord = {
  id: string;
  rowOrder: number;
  statementDate: string | null;
  quantity: number | null;
  statementAmount: number | null;
  contractReceivable: number | null;
  receivedDate: string | null;
  receivedAmount: number | null;
  cumulativeReceivable: number | null;
  invoiceDate: string | null;
  invoiceQuantity: number | null;
  invoiceAmount: number | null;
  remark: string;
  extraFields?: Record<string, unknown> | null;
};

export type CustomerLedgerArchiveBlock = {
  id: string;
  projectId?: string | null;
  sheetName: string;
  workbookSource?: string;
  projectName: string;
  settlementClause: string;
  sheetData?: Record<string, unknown> | null;
  summary: {
    contractUnpaidTotal: number | null;
    uninvoicedTotal: number | null;
    extraSummary?: Record<string, unknown> | null;
  };
  rows: CustomerLedgerArchiveRowRecord[];
};

export type CustomerLedgerArchiveRecord = {
  customer: {
    id: string;
    customerId: string;
    customerCode: string;
    name: string;
  };
  archives: CustomerLedgerArchiveBlock[];
};

export type DashboardTrendPoint = {
  month: string;
  value: number;
};

export type DashboardOverviewData = {
  stats: PageStat[];
  gradeDistribution: Array<{ level: string; count: number }>;
  collectionTopCustomers: Array<{
    customerName: string;
    unpaidAmount: number;
    overdueDays: number | null;
    riskStatus: string;
  }>;
  riskTrend: DashboardTrendPoint[];
  ruleSummary: Array<{
    name: string;
    status: "已启用" | "未启用";
    description: string;
  }>;
  focusSummary: {
    highRiskCustomers: number;
    keyAttentionCustomers: number;
    creditLimitWarnings: number;
    creditLimitRisks: number;
    cLevelCustomers: number;
    collectionCustomers: number;
    scoreDownCustomers: number;
    litigationCustomers: number;
  };
};

export type HighRiskCustomerRecord = {
  customerId: string;
  customerCode: string;
  customerName: string;
  currentCreditLevel: string;
  receivableBalance: number;
  riskLevel: "高" | "重大";
  managementSummary: string;
  collectionSummary: string;
  riskTags: string[];
  riskRemark: string;
  keyAttention: boolean;
  salesOwnerName: string;
  highRiskReasons: string[];
};

export type HighRiskCustomerFilters = {
  keyword?: string;
  riskLevel?: string;
  salesOwnerName?: string;
};

export type KeyAttentionCustomerRecord = {
  customerId: string;
  customerCode: string;
  customerName: string;
  currentCreditLevel: string;
  receivableBalance: number;
  attentionLevel: "持续关注" | "重点跟进";
  attentionTags: string[];
  managementSummary: string;
  collectionSummary: string;
  riskRemark: string;
  keyAttention: boolean;
  salesOwnerName: string;
  attentionReasons: string[];
};

export type KeyAttentionCustomerFilters = {
  keyword?: string;
  attentionLevel?: string;
  salesOwnerName?: string;
};

export type CustomerFilters = {
  keyword?: string;
};

export type CustomerEntityType = "公司" | "个人" | "自运" | "其他";

export type CustomerLedgerSortField =
  | "unpaidAmount"
  | "receivableAmount"
  | "riskLevel"
  | "projectCount";

export type CustomerLedgerSortOrder = "asc" | "desc";

export type ExecutableRiskLevel = "低风险" | "中风险" | "高风险" | "极高风险";

export type ExecutableRiskRuleCode = "R-002" | "R-009" | "R-011";

export type ExecutableRiskRuleResult = {
  ruleCode: ExecutableRiskRuleCode;
  matched: boolean;
  riskLevel: ExecutableRiskLevel;
  reason: string;
  detail: string;
  action: string;
};

export type CustomerLedgerFilters = {
  keyword?: string;
  customerType?: CustomerEntityType | "";
  hasUnclassifiedArchives?: boolean;
  riskLevel?: ExecutableRiskLevel | "";
  sortBy?: CustomerLedgerSortField;
  sortOrder?: CustomerLedgerSortOrder;
  page?: number;
  pageSize?: number;
};

export type CustomerLedgerProjectRow = {
  projectId: string;
  projectName: string;
  projectAlias: string | null;
  normalizedProjectName: string;
  sourceCustomerName: string | null;
  projectBelonging: string;
  receivableAmount: number;
  contractReceivable: number;
  receivedAmount: number;
  unpaidAmount: number;
  remarkRaw?: string | null;
  creditStatusRaw?: string | null;
  currentStatusRaw?: string | null;
  remarkSummary: string;
  creditStatusSummary: string;
  currentStatusSummary: string;
  businessType: string;
  timeNode: string;
  ledgerArchiveCount: number;
  hasLedgerArchive: boolean;
  riskLevel: ExecutableRiskLevel;
  riskReasons: string[];
  riskActions: string[];
  triggeredRules: ExecutableRiskRuleCode[];
  ruleResults: ExecutableRiskRuleResult[];
};

export type CustomerLedgerCustomerRow = {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerType: CustomerEntityType;
  normalizedName: string;
  projectCount: number;
  totalReceivableAmount: number;
  totalContractReceivable: number;
  totalReceivedAmount: number;
  totalUnpaidAmount: number;
  projectNamesPreview: string;
  projectBelongingSummary: string;
  remarkSummary: string;
  creditStatusSummary: string;
  currentStatusSummary: string;
  riskLevel: ExecutableRiskLevel;
  riskReasons: string[];
  riskActions: string[];
  triggeredRules: ExecutableRiskRuleCode[];
  hasUnclassifiedArchives: boolean;
  unclassifiedArchiveCount: number;
  projects: CustomerLedgerProjectRow[];
};

export type CustomerLedgerResponse = {
  summary: {
    customerCount: number;
    projectCount: number;
    totalReceivableAmount: number;
    totalContractReceivable: number;
    totalReceivedAmount: number;
    totalUnpaidAmount: number;
    totalUnclassifiedArchiveCount: number;
  };
  customers: CustomerLedgerCustomerRow[];
};

export type RiskOverviewData = {
  metrics: {
    highRiskCustomerCount: number;
    highRiskProjectCount: number;
    extremeRiskProjectCount: number;
    totalUnpaidAmount: number;
    largeExposureProjectCount: number;
    litigationProjectCount: number;
    unclosedProjectCount: number;
    newAlertCount: number | null;
  };
  distributions: {
    riskLevel: Array<{ label: ExecutableRiskLevel; count: number }>;
    customerType: Array<{ label: CustomerEntityType; count: number }>;
    riskReason: Array<{ label: string; count: number }>;
  };
  topCustomers: RiskCustomerRow[];
  topProjects: RiskProjectRow[];
};

export type RiskCustomerFilters = {
  keyword?: string;
  riskLevel?: ExecutableRiskLevel | "";
  customerType?: CustomerEntityType | "";
  isImportantCustomer?: boolean;
  hasUnclosedProjects?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "unpaidAmount" | "riskLevel" | "highRiskProjectCount" | "projectCount";
  sortOrder?: CustomerLedgerSortOrder;
};

export type RiskProjectFilters = {
  keyword?: string;
  riskLevel?: ExecutableRiskLevel | "";
  projectBelongingCategory?: "" | "央企" | "国企" | "民营" | "项目类" | "未标注";
  businessType?: string;
  hasLedgerArchive?: boolean;
  isUnclosed?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "unpaidAmount" | "riskLevel" | "collectionRate" | "receivableAmount";
  sortOrder?: CustomerLedgerSortOrder;
};

export type RiskCustomerRow = {
  customerId: string;
  customerName: string;
  customerType: CustomerEntityType;
  riskLevel: ExecutableRiskLevel;
  riskReasons: string[];
  riskActions: string[];
  totalReceivableAmount: number;
  totalReceivedAmount: number;
  totalUnpaidAmount: number;
  projectCount: number;
  highRiskProjectCount: number;
  hasLitigationProject: boolean;
  hasUnclosedProjects: boolean;
  hasUnclassifiedArchives: boolean;
  isImportantCustomer: boolean;
  triggeredRules: ExecutableRiskRuleCode[];
  remarkSummary: string;
  creditStatusSummary: string;
  currentStatusSummary: string;
  updatedAt?: string;
};

export type RiskCustomerResponse = {
  summary: {
    customerCount: number;
    totalUnpaidAmount: number;
    highRiskCustomerCount: number;
    extremeRiskCustomerCount: number;
  };
  customers: RiskCustomerRow[];
};

export type RiskProjectRow = {
  customerId: string;
  customerName: string;
  customerType: CustomerEntityType;
  projectId: string;
  projectName: string;
  projectBelonging: string;
  projectBelongingCategory: "央企" | "国企" | "民营" | "项目类" | "未标注";
  businessType: string;
  riskLevel: ExecutableRiskLevel;
  riskReasons: string[];
  riskActions: string[];
  receivableAmount: number;
  contractReceivable: number;
  receivedAmount: number;
  unpaidAmount: number;
  collectionRate: number | null;
  triggeredRules: ExecutableRiskRuleCode[];
  isUnclosed: boolean;
  hasLedgerArchive: boolean;
  hasUnclassifiedArchives: boolean;
  remarkSummary: string;
  creditStatusSummary: string;
  currentStatusSummary: string;
};

export type RiskProjectResponse = {
  summary: {
    projectCount: number;
    totalUnpaidAmount: number;
    highRiskProjectCount: number;
    extremeRiskProjectCount: number;
    projectBelongingCategories: Array<{
      label: "央企" | "国企" | "民营" | "项目类" | "未标注";
      count: number;
    }>;
  };
  projects: RiskProjectRow[];
};

export type ReceivableFilters = {
  keyword?: string;
  customerId?: string;
  salesOwnerName?: string;
  riskStatus?: string;
  businessType?: string;
};

export type ContractRecord = {
  id: string;
  contractId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  projectName: string;
  contractNo: string;
  amount: number;
  signedAt: string | null;
  billingPeriodDays: number | null;
  salesOwnerName: string;
  projectStatus: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type ContractPayload = Omit<
  ContractRecord,
  "id" | "customerCode" | "customerName" | "createdAt" | "updatedAt"
>;

export type ContractFilters = {
  keyword?: string;
  customerId?: string;
  projectStatus?: string;
};

export type RiskTypeOption =
  | "诉讼"
  | "被执行人"
  | "失信被执行人"
  | "经营异常"
  | "税务异常"
  | "付款逾期"
  | "沟通异常"
  | "订单波动"
  | "财务异常";

export type RiskSourceLabel = "人工录入" | "系统计算" | "天眼查同步" | "Excel导入";

export type RiskLevelLabel = "低" | "中" | "高" | "重大";

export type RiskRecordItem = {
  id: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  riskType: RiskTypeOption;
  riskTime: string;
  riskSource: RiskSourceLabel;
  riskLevel: RiskLevelLabel;
  handled: boolean;
  handlingAction?: string;
  followUpRecord?: string;
  riskStatus?: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskPayload = Omit<
  RiskRecordItem,
  "id" | "customerName" | "createdAt" | "updatedAt"
>;

export type RiskFilters = {
  keyword?: string;
  customerId?: string;
  riskType?: string;
  riskLevel?: string;
};

export type CreditScoreRecord = {
  id: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  creditRiskScore: number;
  businessRiskScore: number;
  financialRiskScore: number;
  totalScore: number;
  creditScore: number;
  creditLevel: string;
  riskAction: string;
  riskStatus: string;
  scoreDelta?: number | null;
  scoreDate: string;
  scoreMonth: string;
  description: string;
  keyAttention: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreditScorePayload = Omit<
  CreditScoreRecord,
  | "id"
  | "customerName"
  | "totalScore"
  | "creditScore"
  | "creditLevel"
  | "riskAction"
  | "riskStatus"
  | "scoreDelta"
  | "keyAttention"
  | "createdAt"
  | "updatedAt"
>;

export type CreditScoreFilters = {
  scoreMonth?: string;
  creditLevel?: string;
};

export type CollectionItemRecord = {
  id: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  unpaidAmount: number;
  currentCreditLevel: string;
  maxOverdueDays: number | null;
  collectionLevel: string | null;
  currentMeasure: string;
  ownerName: string;
  followUpStatus: string;
  handoffToLegal: boolean;
  openclawSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionItemPayload = Omit<
  CollectionItemRecord,
  "id" | "customerName" | "unpaidAmount" | "currentCreditLevel" | "createdAt" | "updatedAt"
>;

export type ReportEntry = {
  id: string;
  title: string;
  description: string;
  type: string;
  openclawHint: string;
};
