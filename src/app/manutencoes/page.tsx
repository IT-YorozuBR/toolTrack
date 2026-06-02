import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { ToolGrid } from "./ToolGrid";
import { MaintenanceList } from "./MaintenanceList";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; ferramenta?: string }>;
}) {
  const { search, page, ferramenta } = await searchParams;

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

  /* ── Vista de grade de ferramentais ── */
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

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
