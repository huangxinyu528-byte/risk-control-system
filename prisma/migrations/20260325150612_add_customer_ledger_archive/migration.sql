-- CreateTable
CREATE TABLE "customer_ledger_profiles" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "project_id" TEXT,
    "sheet_name" VARCHAR(100) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "project_name" VARCHAR(200),
    "settlement_clause" TEXT,
    "contract_unpaid_total" DECIMAL(14,2),
    "uninvoiced_total" DECIMAL(14,2),
    "extra_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_ledger_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger_rows" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "row_order" INTEGER NOT NULL,
    "statement_date" VARCHAR(50),
    "quantity" DECIMAL(14,2),
    "statement_amount" DECIMAL(14,2),
    "contract_receivable" DECIMAL(14,2),
    "received_date" VARCHAR(50),
    "received_amount" DECIMAL(14,2),
    "cumulative_receivable" DECIMAL(14,2),
    "invoice_date" VARCHAR(50),
    "invoice_quantity" DECIMAL(14,2),
    "invoice_amount" DECIMAL(14,2),
    "remark" TEXT,
    "extra_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_ledger_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_ledger_profiles_customer_id_idx" ON "customer_ledger_profiles"("customer_id");

-- CreateIndex
CREATE INDEX "customer_ledger_profiles_project_id_idx" ON "customer_ledger_profiles"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_ledger_profiles_customer_id_sheet_name_key" ON "customer_ledger_profiles"("customer_id", "sheet_name");

-- CreateIndex
CREATE INDEX "customer_ledger_rows_profile_id_idx" ON "customer_ledger_rows"("profile_id");

-- CreateIndex
CREATE INDEX "customer_ledger_rows_row_order_idx" ON "customer_ledger_rows"("row_order");

-- AddForeignKey
ALTER TABLE "customer_ledger_profiles" ADD CONSTRAINT "customer_ledger_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_profiles" ADD CONSTRAINT "customer_ledger_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_rows" ADD CONSTRAINT "customer_ledger_rows_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "customer_ledger_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
