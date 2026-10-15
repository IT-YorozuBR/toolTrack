import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { ToolGrid } from "./ToolGrid";
import { MaintenanceList } from "./MaintenanceList";
import { ProjectMaintenanceTree } from "./ProjectMaintenanceTree";
import { ViewToggle } from "./ViewToggle";
import { AgendaView, type AgendaCandidate, type AgendaPending } from "./AgendaView";
import { getAllToolsProjection, getToolProjection } from "@/lib/calculations/strokes";
import { autoEnsureMonthlySnapshots } from "@/lib/actions/monthly-stroke-snapshots";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; ferramenta?: string; view?: string; month?: string }>;
}) {
  const { search, page, ferramenta, view, month } = await searchParams;

  /* ── Vista de manutenções de um ferramental ── */
  if (ferramenta) {
    const tool = await prisma.tool.findUnique({
      where: { id: ferramenta },
      select: {
        id: true,
        code: true,
        description: true,
        press: true,
        line: true,
        maintenanceRecords: {
          orderBy: { maintenanceDate: "desc" },
          select: {
            id: true,
            maintenanceDate: true,
            strokesAtMaintenance: true,
            maintenanceType: true,
            responsible: true,
            resetCounter: true,
            notes: true,
          },
        },
      },
    });

    if (!tool) redirect("/manutencoes");

    const backParams = new URLSearchParams();
    if (page && page !== "1") backParams.set("page", page);
    if (search) backParams.set("search", search);
    const backUrl = `/manutencoes${backParams.size > 0 ? `?${backParams.toString()}` : ""}`;

    return (
      <div>
        <PageHeader
          title="Manutenções"
          description="Histórico de manutenções do ferramental"
        />
        <MaintenanceList tool={tool} backUrl={backUrl} />
      </div>
    );
  }

  /* ── Vista de grade de ferramentais (lista ou árvore por projeto) ── */
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";
  const isTreeView = view === "tree";

  const header = (
    <PageHeader
      title="Manutenções"
      description="Selecione um ferramental para ver o histórico de manutenções"
      action={
        <Link
          href="/manutencoes/nova"
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
        >
          + Registrar Manutenção
        </Link>
      }
    />
  );

  if (view === "agenda") {
    await autoEnsureMonthlySnapshots();
    const now = new Date();
    const selectedMonth =
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ? month
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const tools = await prisma.tool.findMany({
      where: { active: true },
      include: {
        bomItems: {
          include: {
            overrides: true,
            product: {
              include: {
                forecasts: true,
                projectProducts: { include: { project: { include: { forecasts: true } } } },
              },
            },
          },
        },
        maintenanceRecords: {
          where: { resetCounter: true },
          orderBy: { maintenanceDate: "desc" },
          take: 1,
        },
        monthlySnapshots: { orderBy: { referenceMonth: "asc" } },
        strokeReadings: { orderBy: { readingDate: "desc" }, take: 12 },
        scheduledMaintenances: { where: { status: "PENDING" }, take: 1 },
      },
      orderBy: { code: "asc" },
    });

    const candidates: AgendaCandidate[] = getAllToolsProjection(
      tools.filter((t) => t.scheduledMaintenances.length === 0),
    )
      .map((p) => ({
        toolId: p.toolId,
        code: p.code,
        description: p.description ?? null,
        press: p.press,
        saldo: Math.round(p.currentRemainingStrokes),
        status: p.effectiveStatus,
      }))
      .sort((a, b) => a.saldo - b.saldo);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pending: AgendaPending[] = tools
      .filter((t) => t.scheduledMaintenances.length > 0)
      .map((t) => {
        const sch = t.scheduledMaintenances[0];
        // Acúmulo real: projeção ignorando o agendamento (a projeção normal já vem zerada).
        const real = getToolProjection({ ...t, scheduledMaintenances: [] });
        return {
          id: sch.id,
          toolId: t.id,
          code: t.code,
          description: t.description,
          press: t.press,
          referenceMonth: sch.referenceMonth.toISOString(),
          overdue: sch.referenceMonth < currentMonthStart,
          accumulated: Math.round(real.estimatedAccumulated),
        };
      })
      .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth) || a.code.localeCompare(b.code));

    return (
      <div>
        {header}
        <ViewToggle current="agenda" />
        <AgendaView
          candidates={candidates}
          pending={pending}
          month={selectedMonth}
        />
      </div>
    );
  }

  if (isTreeView) {
    const projects = await prisma.project.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return (
      <div>
        {header}
        <ViewToggle current="tree" />
        <ProjectMaintenanceTree projects={projects} />
      </div>
    );
  }

  const where = searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { description: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};

  const allTools = await prisma.tool.findMany({
    where,
    select: {
      id: true,
      code: true,
      description: true,
      press: true,
      _count: { select: { maintenanceRecords: true } },
      maintenanceRecords: {
        orderBy: { maintenanceDate: "desc" },
        take: 1,
        select: { maintenanceDate: true, maintenanceType: true },
      },
    },
  });

  allTools.sort((a, b) => {
    const aDate = a.maintenanceRecords[0]?.maintenanceDate ?? null;
    const bDate = b.maintenanceRecords[0]?.maintenanceDate ?? null;
    if (aDate && bDate) return bDate.getTime() - aDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return a.code.localeCompare(b.code);
  });

  const total = allTools.length;
  const tools = allTools.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {header}
      <ViewToggle current="list" />
      <ToolGrid
        tools={tools}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        search={searchTerm}
      />
    </div>
  );
}
