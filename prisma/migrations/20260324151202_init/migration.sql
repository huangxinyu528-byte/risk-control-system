-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'finance', 'sales', 'legal', 'management');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'inactive', 'archived', 'blocked');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'active', 'completed', 'terminated', 'suspended');

-- CreateEnum
CREATE TYPE "RiskSource" AS ENUM ('manual', 'system', 'tianyancha', 'excel');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "CollectionTaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'canceled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(120),
    "phone" VARCHAR(30),
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customer_id" VARCHAR(50) NOT NULL,
    "customer_code" VARCHAR(20),
    "name" VARCHAR(200) NOT NULL,
    "credit_status" VARCHAR(100),
    "current_status" VARCHAR(200),
    "customer_nature" VARCHAR(100),
    "has_guarantee" BOOLEAN NOT NULL DEFAULT false,
    "credit_standing" VARCHAR(100),
    "due_diligence_completed" BOOLEAN NOT NULL DEFAULT false,
    "short_name" VARCHAR(120),
    "unified_social_credit_code" VARCHAR(32),
    "industry" VARCHAR(100),
    "sales_owner_name" VARCHAR(100),
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(30),
    "contact_email" VARCHAR(120),
    "region" VARCHAR(100),
    "address" TEXT,
    "current_credit_level" VARCHAR(20),
    "credit_limit" DECIMAL(14,2),
    "stop_supply" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "risk_remark" TEXT,
    "customer_status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "sales_owner_id" TEXT,
    "finance_owner_id" TEXT,
    "legal_owner_id" TEXT,
    "latest_credit_score" INTEGER,
    "latest_credit_score_month" VARCHAR(7),
    "openclaw_summary" TEXT,
    "openclaw_tags" JSONB,
    "receivable_summary" JSONB,
    "risk_summary" JSONB,
    "external_data_snapshot" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" VARCHAR(100),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_no" VARCHAR(60) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "contract_business_id" VARCHAR(60),
    "contract_status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "amount" DECIMAL(14,2),
    "signed_at" TIMESTAMP(3),
    "billing_period_days" INTEGER,
    "sales_owner_name" VARCHAR(100),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "payment_terms" TEXT,
    "invoice_requirement" TEXT,
    "remark" TEXT,
    "summary" TEXT,
    "openclaw_summary" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "receivable_no" VARCHAR(60) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "project_id" TEXT,
    "project_name" VARCHAR(200),
    "contract_receivable" DECIMAL(14,2),
    "cumulative_receivable" DECIMAL(14,2),
    "statement_date" TIMESTAMP(3),
    "business_type" VARCHAR(50),
    "time_node" VARCHAR(50),
    "remark" TEXT,
    "period" VARCHAR(20),
    "payment_term" VARCHAR(50),
    "base_date" TIMESTAMP(3),
    "receivable_amount" DECIMAL(14,2) NOT NULL,
    "received_amount" DECIMAL(14,2),
    "received_date" TIMESTAMP(3),
    "unpaid_amount" DECIMAL(14,2),
    "monthly_received_amount" DECIMAL(14,2),
    "sales_owner_name" VARCHAR(100),
    "billing_period_days" INTEGER,
    "due_date" TIMESTAMP(3),
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "overdue_days" INTEGER,
    "aging_bucket" VARCHAR(50),
    "collection_level" VARCHAR(50),
    "risk_status" VARCHAR(50),
    "receivable_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "last_collection_at" TIMESTAMP(3),
    "expected_payment_date" TIMESTAMP(3),
    "openclaw_summary" TEXT,
    "receivable_snapshot" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "project_id" TEXT,
    "risk_code" VARCHAR(60),
    "type" VARCHAR(100) NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "source" "RiskSource" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handling_action" VARCHAR(200),
    "follow_up_record" TEXT,
    "event_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "source_detail" VARCHAR(200),
    "remark" TEXT,
    "openclaw_summary" TEXT,
    "payload" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "score_month" VARCHAR(7) NOT NULL,
    "credit_risk_score" INTEGER NOT NULL DEFAULT 0,
    "business_risk_score" INTEGER NOT NULL DEFAULT 0,
    "financial_risk_score" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL,
    "score_level" VARCHAR(50),
    "risk_action" VARCHAR(50),
    "risk_status" VARCHAR(50),
    "score_delta" INTEGER,
    "score_version" VARCHAR(50),
    "score_reason" TEXT,
    "key_attention" BOOLEAN NOT NULL DEFAULT false,
    "risk_flags" JSONB,
    "openclaw_summary" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_tasks" (
    "id" TEXT NOT NULL,
    "task_no" VARCHAR(60) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "receivable_id" TEXT,
    "assigned_to_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "collection_level" VARCHAR(50),
    "priority" VARCHAR(50),
    "due_date" TIMESTAMP(3),
    "task_status" "CollectionTaskStatus" NOT NULL DEFAULT 'pending',
    "handoff_to_legal" BOOLEAN NOT NULL DEFAULT false,
    "result_summary" TEXT,
    "next_action" TEXT,
    "current_measure" TEXT,
    "openclaw_summary" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_reports" (
    "id" TEXT NOT NULL,
    "report_month" VARCHAR(7) NOT NULL,
    "customer_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "report_type" VARCHAR(50),
    "overview" TEXT,
    "metrics_snapshot" JSONB,
    "openclaw_summary" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "customer_id" TEXT,
    "module" VARCHAR(60) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(60),
    "target_id" VARCHAR(100),
    "message" TEXT,
    "detail" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_id_key" ON "customers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_name_key" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_unified_social_credit_code_key" ON "customers"("unified_social_credit_code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_current_status_idx" ON "customers"("current_status");

-- CreateIndex
CREATE INDEX "customers_customer_status_idx" ON "customers"("customer_status");

-- CreateIndex
CREATE INDEX "customers_sales_owner_id_idx" ON "customers"("sales_owner_id");

-- CreateIndex
CREATE INDEX "customers_finance_owner_id_idx" ON "customers"("finance_owner_id");

-- CreateIndex
CREATE INDEX "customers_legal_owner_id_idx" ON "customers"("legal_owner_id");

-- CreateIndex
CREATE INDEX "customers_last_synced_at_idx" ON "customers"("last_synced_at");

-- CreateIndex
CREATE INDEX "projects_customer_id_idx" ON "projects"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_customer_id_name_key" ON "projects"("customer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_no_key" ON "contracts"("contract_no");

-- CreateIndex
CREATE INDEX "contracts_customer_id_idx" ON "contracts"("customer_id");

-- CreateIndex
CREATE INDEX "contracts_contract_status_idx" ON "contracts"("contract_status");

-- CreateIndex
CREATE INDEX "contracts_signed_at_idx" ON "contracts"("signed_at");

-- CreateIndex
CREATE INDEX "contracts_end_date_idx" ON "contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_receivable_no_key" ON "receivables"("receivable_no");

-- CreateIndex
CREATE INDEX "receivables_customer_id_idx" ON "receivables"("customer_id");

-- CreateIndex
CREATE INDEX "receivables_contract_id_idx" ON "receivables"("contract_id");

-- CreateIndex
CREATE INDEX "receivables_project_id_idx" ON "receivables"("project_id");

-- CreateIndex
CREATE INDEX "receivables_due_date_idx" ON "receivables"("due_date");

-- CreateIndex
CREATE INDEX "receivables_overdue_days_idx" ON "receivables"("overdue_days");

-- CreateIndex
CREATE INDEX "receivables_aging_bucket_idx" ON "receivables"("aging_bucket");

-- CreateIndex
CREATE INDEX "receivables_collection_level_idx" ON "receivables"("collection_level");

-- CreateIndex
CREATE INDEX "receivables_receivable_status_idx" ON "receivables"("receivable_status");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_customer_id_project_id_key" ON "receivables"("customer_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "risks_risk_code_key" ON "risks"("risk_code");

-- CreateIndex
CREATE INDEX "risks_customer_id_idx" ON "risks"("customer_id");

-- CreateIndex
CREATE INDEX "risks_project_id_idx" ON "risks"("project_id");

-- CreateIndex
CREATE INDEX "risks_type_idx" ON "risks"("type");

-- CreateIndex
CREATE INDEX "risks_level_idx" ON "risks"("level");

-- CreateIndex
CREATE INDEX "risks_source_idx" ON "risks"("source");

-- CreateIndex
CREATE INDEX "risks_detected_at_idx" ON "risks"("detected_at");

-- CreateIndex
CREATE INDEX "risks_status_idx" ON "risks"("status");

-- CreateIndex
CREATE INDEX "credit_scores_score_month_idx" ON "credit_scores"("score_month");

-- CreateIndex
CREATE INDEX "credit_scores_score_idx" ON "credit_scores"("score");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scores_customer_id_score_month_key" ON "credit_scores"("customer_id", "score_month");

-- CreateIndex
CREATE UNIQUE INDEX "collection_tasks_task_no_key" ON "collection_tasks"("task_no");

-- CreateIndex
CREATE INDEX "collection_tasks_customer_id_idx" ON "collection_tasks"("customer_id");

-- CreateIndex
CREATE INDEX "collection_tasks_receivable_id_idx" ON "collection_tasks"("receivable_id");

-- CreateIndex
CREATE INDEX "collection_tasks_assigned_to_id_idx" ON "collection_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "collection_tasks_due_date_idx" ON "collection_tasks"("due_date");

-- CreateIndex
CREATE INDEX "collection_tasks_collection_level_idx" ON "collection_tasks"("collection_level");

-- CreateIndex
CREATE INDEX "collection_tasks_task_status_idx" ON "collection_tasks"("task_status");

-- CreateIndex
CREATE INDEX "monthly_reports_report_month_idx" ON "monthly_reports"("report_month");

-- CreateIndex
CREATE INDEX "monthly_reports_customer_id_idx" ON "monthly_reports"("customer_id");

-- CreateIndex
CREATE INDEX "system_logs_user_id_idx" ON "system_logs"("user_id");

-- CreateIndex
CREATE INDEX "system_logs_customer_id_idx" ON "system_logs"("customer_id");

-- CreateIndex
CREATE INDEX "system_logs_module_idx" ON "system_logs"("module");

-- CreateIndex
CREATE INDEX "system_logs_action_idx" ON "system_logs"("action");

-- CreateIndex
CREATE INDEX "system_logs_target_type_target_id_idx" ON "system_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sales_owner_id_fkey" FOREIGN KEY ("sales_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_finance_owner_id_fkey" FOREIGN KEY ("finance_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_legal_owner_id_fkey" FOREIGN KEY ("legal_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
