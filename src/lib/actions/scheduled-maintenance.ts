"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createMaintenanceRecord } from "@/lib/actions/maintenance";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function revalidateAll() {
  revalidatePath("/manutencoes");
  revalidatePath("/controle-50k");
  revalidatePath("/dashboard");
}

// Agendamentos PENDING (todos os meses): inclui os atrasados, que seguem pendentes até
// alguém confirmar ou cancelar.
export async function getPendingScheduledMaintenances() {
  const rows = await prisma.scheduledMaintenance.findMany({
    where: { status: "PENDING" },
    include: {
      tool: { select: { id: true, code: true, description: true, press: true } },
    },
    orderBy: [{ referenceMonth: "asc" }, { createdAt: "asc" }],
  });
  const currentMonthStart = startOfMonth(new Date());
  return rows.map((r) => ({
    id: r.id,
    toolId: r.toolId,
    referenceMonth: r.referenceMonth.toISOString(),
    overdue: r.referenceMonth < currentMonthStart,
    tool: r.tool,
  }));
}

// Agenda a preventiva de várias ferramentas para um mês. Não altera contador nem histórico.
export async function scheduleMaintenances(data: { toolIds: string[]; referenceMonth: string }) {
  try {
    const toolIds = [...new Set(data.toolIds)];
    if (toolIds.length === 0) {
      return { success: false, error: "Selecione ao menos um ferramental." };
    }
    const [year, month] = data.referenceMonth.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, error: "Mês inválido." };
    }
    // Âncora ao meio-dia UTC (mesma convenção dos volumes): meia-noite local no servidor (UTC)
    // viraria o mês anterior no fuso do navegador (America/Sao_Paulo).
    const referenceMonth = new Date(Date.UTC(year, month - 1, 1, 12));

    const [tools, alreadyPending] = await Promise.all([
      prisma.tool.findMany({ where: { id: { in: toolIds } }, select: { id: true, code: true } }),
      prisma.scheduledMaintenance.findMany({
        where: { toolId: { in: toolIds }, status: "PENDING" },
        select: { toolId: true },
      }),
    ]);
    const pendingIds = new Set(alreadyPending.map((p) => p.toolId));
    const toCreate = tools.filter((t) => !pendingIds.has(t.id));
    if (toCreate.length === 0) {
      return { success: false, error: "Os ferramentais selecionados já possuem manutenção agendada." };
    }

    const created = await prisma.$transaction(
      toCreate.map((t) =>
        prisma.scheduledMaintenance.create({ data: { toolId: t.id, referenceMonth } }),
      ),
    );

    const codeById = new Map(tools.map((t) => [t.id, t.code]));
    for (const row of created) {
      await logAudit({
        entity: "ScheduledMaintenance",
        entityId: row.id,
        action: "CREATE",
        summary: `${codeById.get(row.toolId)}: preventiva agendada para ${data.referenceMonth}`,
        after: row,
      });
    }

    revalidateAll();
    return {
      success: true,
      data: { created: created.length, skipped: toolIds.length - created.length },
    };
  } catch {
    return { success: false, error: "Erro ao agendar manutenção." };
  }
}

// Cancelar só muda o status: como o agendamento nunca gravou nada no ferramental, a
// projeção volta exatamente ao estado anterior.
export async function cancelScheduledMaintenance(id: string) {
  try {
    const existing = await prisma.scheduledMaintenance.findUnique({
      where: { id },
      include: { tool: { select: { code: true } } },
    });
    if (!existing || existing.status !== "PENDING") {
      return { success: false, error: "Agendamento não encontrado ou já resolvido." };
    }
    const { tool, ...before } = existing;
    const updated = await prisma.scheduledMaintenance.update({
      where: { id },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });
    await logAudit({
      entity: "ScheduledMaintenance",
      entityId: id,
      action: "UPDATE",
      summary: `${tool.code}: agendamento cancelado`,
      before,
      after: updated,
    });
    revalidateAll();
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao cancelar agendamento." };
  }
}

// Confirma que a manutenção foi realizada: cria a manutenção preventiva real (que zera o
// contador e re-ancora os snapshots) e marca o agendamento como CONFIRMED.
export async function confirmScheduledMaintenance(
  id: string,
  data: {
    maintenanceDate: Date;
    strokesAtMaintenance: number;
    responsible?: string;
    notes?: string;
  },
) {
  try {
    const existing = await prisma.scheduledMaintenance.findUnique({
      where: { id },
      include: { tool: { select: { code: true } } },
    });
    if (!existing || existing.status !== "PENDING") {
      return { success: false, error: "Agendamento não encontrado ou já resolvido." };
    }

    const result = await createMaintenanceRecord({
      toolId: existing.toolId,
      maintenanceDate: data.maintenanceDate,
      strokesAtMaintenance: data.strokesAtMaintenance,
      maintenanceType: "Preventiva",
      responsible: data.responsible,
      notes: data.notes,
      resetCounter: true,
    });
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Erro ao registrar a manutenção." };
    }

    const { tool, ...before } = existing;
    const updated = await prisma.scheduledMaintenance.update({
      where: { id },
      data: { status: "CONFIRMED", resolvedAt: new Date(), maintenanceRecordId: result.data.id },
    });
    await logAudit({
      entity: "ScheduledMaintenance",
      entityId: id,
      action: "UPDATE",
      summary: `${tool.code}: agendamento confirmado`,
      before,
      after: updated,
    });
    revalidateAll();
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao confirmar agendamento." };
  }
}
