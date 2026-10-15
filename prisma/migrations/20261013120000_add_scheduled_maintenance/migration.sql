-- CreateTable
CREATE TABLE "ScheduledMaintenance" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "referenceMonth" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "maintenanceRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledMaintenance_status_referenceMonth_idx" ON "ScheduledMaintenance"("status", "referenceMonth");

-- CreateIndex
CREATE INDEX "ScheduledMaintenance_toolId_idx" ON "ScheduledMaintenance"("toolId");

-- Garante no máximo um agendamento PENDING por ferramental
CREATE UNIQUE INDEX "ScheduledMaintenance_toolId_pending_key" ON "ScheduledMaintenance"("toolId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ScheduledMaintenance" ADD CONSTRAINT "ScheduledMaintenance_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
