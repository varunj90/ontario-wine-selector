-- CreateTable
CREATE TABLE "IngestionDeadLetter" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestionRunId" TEXT,

    CONSTRAINT "IngestionDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionDeadLetter_source_receivedAt_idx" ON "IngestionDeadLetter"("source", "receivedAt");

-- CreateIndex
CREATE INDEX "IngestionDeadLetter_ingestionRunId_idx" ON "IngestionDeadLetter"("ingestionRunId");

-- AddForeignKey
ALTER TABLE "IngestionDeadLetter" ADD CONSTRAINT "IngestionDeadLetter_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
