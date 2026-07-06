-- CreateTable
CREATE TABLE "BomItemForecastOverride" (
    "id" TEXT NOT NULL,
    "bomItemId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomItemForecastOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BomItemForecastOverride_bomItemId_referenceMonth_key" ON "BomItemForecastOverride"("bomItemId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "BomItemForecastOverride" ADD CONSTRAINT "BomItemForecastOverride_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
