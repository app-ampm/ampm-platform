-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_name" VARCHAR(128) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'running',
    "detail_json" JSONB,
    "error" VARCHAR(1024),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_job_name_created_at_idx" ON "job_runs"("job_name", "created_at");
