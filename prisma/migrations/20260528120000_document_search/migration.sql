-- CreateTable
CREATE TABLE "document_sources" (
    "id" TEXT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_key" VARCHAR(120) NOT NULL,
    "customer_id" TEXT,
    "project_id" TEXT,
    "profile_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255),
    "sheet_name" VARCHAR(120),
    "metadata" JSONB,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "project_id" TEXT,
    "profile_id" TEXT,
    "row_id" TEXT,
    "chunk_type" VARCHAR(50) NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "sheet_name" VARCHAR(120),
    "row_order" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_sources_source_key_key" ON "document_sources"("source_key");

-- CreateIndex
CREATE INDEX "document_sources_source_type_idx" ON "document_sources"("source_type");
CREATE INDEX "document_sources_customer_id_idx" ON "document_sources"("customer_id");
CREATE INDEX "document_sources_project_id_idx" ON "document_sources"("project_id");
CREATE INDEX "document_sources_profile_id_idx" ON "document_sources"("profile_id");
CREATE INDEX "document_sources_indexed_at_idx" ON "document_sources"("indexed_at");
CREATE INDEX "document_chunks_source_id_idx" ON "document_chunks"("source_id");
CREATE INDEX "document_chunks_customer_id_idx" ON "document_chunks"("customer_id");
CREATE INDEX "document_chunks_project_id_idx" ON "document_chunks"("project_id");
CREATE INDEX "document_chunks_profile_id_idx" ON "document_chunks"("profile_id");
CREATE INDEX "document_chunks_row_id_idx" ON "document_chunks"("row_id");
CREATE INDEX "document_chunks_chunk_type_idx" ON "document_chunks"("chunk_type");
CREATE INDEX "document_chunks_row_order_idx" ON "document_chunks"("row_order");

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "customer_ledger_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "document_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "customer_ledger_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "customer_ledger_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
