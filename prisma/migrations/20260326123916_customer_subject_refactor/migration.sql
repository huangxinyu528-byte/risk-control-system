-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "is_merged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merged_into_customer_id" TEXT,
ADD COLUMN     "normalized_name" VARCHAR(200),
ADD COLUMN     "source_customer_name" VARCHAR(200);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "derived_from_customer_name" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "normalized_project_name" VARCHAR(200),
ADD COLUMN     "project_alias" VARCHAR(200),
ADD COLUMN     "source_customer_name" VARCHAR(200);

-- CreateTable
CREATE TABLE "customer_merge_mappings" (
    "id" TEXT NOT NULL,
    "source_customer_id" TEXT NOT NULL,
    "target_customer_id" TEXT NOT NULL,
    "source_customer_name" VARCHAR(200) NOT NULL,
    "target_customer_name" VARCHAR(200) NOT NULL,
    "project_alias" VARCHAR(200),
    "split_kind" VARCHAR(50),
    "suggested_action" VARCHAR(100),
    "original_source_name" VARCHAR(200),
    "status" VARCHAR(50) NOT NULL DEFAULT 'applied',
    "notes" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_merge_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_merge_mappings_target_customer_id_idx" ON "customer_merge_mappings"("target_customer_id");

-- CreateIndex
CREATE INDEX "customer_merge_mappings_status_idx" ON "customer_merge_mappings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_merge_mappings_source_customer_id_key" ON "customer_merge_mappings"("source_customer_id");

-- CreateIndex
CREATE INDEX "customers_normalized_name_idx" ON "customers"("normalized_name");

-- CreateIndex
CREATE INDEX "customers_is_merged_idx" ON "customers"("is_merged");

-- CreateIndex
CREATE INDEX "customers_merged_into_customer_id_idx" ON "customers"("merged_into_customer_id");

-- CreateIndex
CREATE INDEX "projects_normalized_project_name_idx" ON "projects"("normalized_project_name");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_customer_id_fkey" FOREIGN KEY ("merged_into_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_merge_mappings" ADD CONSTRAINT "customer_merge_mappings_source_customer_id_fkey" FOREIGN KEY ("source_customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_merge_mappings" ADD CONSTRAINT "customer_merge_mappings_target_customer_id_fkey" FOREIGN KEY ("target_customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
