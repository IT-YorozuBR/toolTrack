/*
  Warnings:

  - A unique constraint covering the columns `[productId,referenceMonth]` on the table `ProductionForecast` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductionForecast_productId_referenceMonth_key" ON "ProductionForecast"("productId", "referenceMonth");
