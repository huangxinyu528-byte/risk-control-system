-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "source" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" TEXT NOT NULL,
    "import_log_id" TEXT NOT NULL,
    "row_ref" VARCHAR(100),
    "message" TEXT NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_logs_imported_at_idx" ON "import_logs"("imported_at");

-- CreateIndex
CREATE INDEX "import_errors_import_log_id_idx" ON "import_errors"("import_log_id");

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_import_log_id_fkey" FOREIGN KEY ("import_log_id") REFERENCES "import_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
