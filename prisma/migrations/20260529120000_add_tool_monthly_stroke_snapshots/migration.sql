-- CreateTable
CREATE TABLE "ToolMonthlyStrokeSnapshot" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "strokes" INTEGER NOT NULL,
    "cycleStartedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'forecast',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolMonthlyStrokeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToolMonthlyStrokeSnapshot_toolId_referenceMonth_key" ON "ToolMonthlyStrokeSnapshot"("toolId", "referenceMonth");

-- CreateIndex
CREATE INDEX "ToolMonthlyStrokeSnapshot_referenceMonth_idx" ON "ToolMonthlyStrokeSnapshot"("referenceMonth");

-- AddForeignKey
ALTER TABLE "ToolMonthlyStrokeSnapshot" ADD CONSTRAINT "ToolMonthlyStrokeSnapshot_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
