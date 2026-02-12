-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wine" (
    "id" TEXT NOT NULL,
    "lcboProductId" TEXT,
    "name" TEXT NOT NULL,
    "producer" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "varietal" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "subRegion" TEXT NOT NULL,
    "fullRegionLabel" TEXT NOT NULL,
    "lcboUrl" TEXT,
    "vivinoUrl" TEXT,
    "volumeMl" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "lcboStoreCode" TEXT,
    "displayName" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT DEFAULT 'ON',
    "postalPrefix" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WineMarketData" (
    "id" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "listedPriceCents" INTEGER NOT NULL,
    "inventoryQuantity" INTEGER,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WineMarketData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WineQualitySignal" (
    "id" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "ratingCount" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WineQualitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wineId" TEXT,
    "eventName" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTasting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "note" TEXT,
    "contextTag" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "queryHash" TEXT NOT NULL,
    "recommendationIds" JSONB NOT NULL,
    "rankingMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "itemsRead" INTEGER NOT NULL DEFAULT 0,
    "itemsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wine_lcboProductId_key" ON "Wine"("lcboProductId");

-- CreateIndex
CREATE INDEX "Wine_name_idx" ON "Wine"("name");

-- CreateIndex
CREATE INDEX "Wine_type_varietal_country_subRegion_idx" ON "Wine"("type", "varietal", "country", "subRegion");

-- CreateIndex
CREATE UNIQUE INDEX "wine_identity_unique" ON "Wine"("name", "producer", "varietal", "country", "subRegion");

-- CreateIndex
CREATE UNIQUE INDEX "Store_lcboStoreCode_key" ON "Store"("lcboStoreCode");

-- CreateIndex
CREATE INDEX "WineMarketData_wineId_storeId_idx" ON "WineMarketData"("wineId", "storeId");

-- CreateIndex
CREATE INDEX "WineMarketData_sourceUpdatedAt_idx" ON "WineMarketData"("sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "WineQualitySignal_wineId_source_idx" ON "WineQualitySignal"("wineId", "source");

-- CreateIndex
CREATE INDEX "WineQualitySignal_rating_ratingCount_idx" ON "WineQualitySignal"("rating", "ratingCount");

-- CreateIndex
CREATE INDEX "UserEvent_userId_createdAt_idx" ON "UserEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_eventName_idx" ON "UserEvent"("eventName");

-- CreateIndex
CREATE INDEX "UserTasting_userId_createdAt_idx" ON "UserTasting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserTasting_wineId_idx" ON "UserTasting"("wineId");

-- CreateIndex
CREATE INDEX "RecommendationLog_queryHash_createdAt_idx" ON "RecommendationLog"("queryHash", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionRun_source_startedAt_idx" ON "IngestionRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "WineMarketData" ADD CONSTRAINT "WineMarketData_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WineMarketData" ADD CONSTRAINT "WineMarketData_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WineQualitySignal" ADD CONSTRAINT "WineQualitySignal_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTasting" ADD CONSTRAINT "UserTasting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTasting" ADD CONSTRAINT "UserTasting_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
