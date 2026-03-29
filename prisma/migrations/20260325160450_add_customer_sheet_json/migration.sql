-- AlterTable
ALTER TABLE "customer_ledger_profiles" ADD COLUMN     "sheet_data_json" JSONB,
ADD COLUMN     "workbook_source" VARCHAR(255);
