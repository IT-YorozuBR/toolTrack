-- CreateTable
CREATE TABLE "ProjectProduct" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectForecast" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProduct_projectId_productId_key" ON "ProjectProduct"("projectId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectForecast_projectId_referenceMonth_key" ON "ProjectForecast"("projectId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "ProjectProduct" ADD CONSTRAINT "ProjectProduct_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProduct" ADD CONSTRAINT "ProjectProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectForecast" ADD CONSTRAINT "ProjectForecast_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
