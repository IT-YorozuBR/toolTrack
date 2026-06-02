-- AlterTable
ALTER TABLE "ToolMonthlyStrokeSnapshot" ADD COLUMN     "actualStrokes" INTEGER;

-- CreateTable
CREATE TABLE "ToolStrokeReading" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "cycleStrokes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolStrokeReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolStrokeReading_toolId_readingDate_idx" ON "ToolStrokeReading"("toolId", "readingDate");

-- AddForeignKey
ALTER TABLE "ToolStrokeReading" ADD CONSTRAINT "ToolStrokeReading_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
