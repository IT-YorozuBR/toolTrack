import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { getAllToolsProjection } from "@/lib/calculations/strokes";
import Link from "next/link";
import { ToolsTable } from "./ToolsTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function FerramentaisPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const where = searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { press: { contains: searchTerm, mode: "insensitive" as const } },
          { line: { contains: searchTerm, mode: "insensitive" as const } },
          { description: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Relações necessárias para calcular o acúmulo/status igual ao Controle 50K.
  const toolInclude = {
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
      orderBy: { maintenanceDate: "desc" as const },
      take: 1,
    },
    monthlySnapshots: { orderBy: { referenceMonth: "asc" as const } },
    strokeReadings: { orderBy: { readingDate: "desc" as const } },
  } as const;

  const [tools, total] = await Promise.all([
    prisma.tool.findMany({
      where,
      include: toolInclude,
      orderBy: { code: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.tool.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Acúmulo e status calculados (real quando há leitura; senão estimado) — atualiza sozinho.
  const projById = new Map(getAllToolsProjection(tools).map((p) => [p.toolId, p]));

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    params.set("page", String(p));
    return `/ferramentais?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Ferramentais"
        description="Cadastro e gestão de ferramentais de prensa"
        action={
          <Link href="/ferramentais/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Novo Ferramental
          </Link>
        }
      />

      <SearchInput
        basePath="/ferramentais"
        initialValue={searchTerm}
        placeholder="Buscar por código ou descrição…"
        total={total}
        label={total === 1 ? "ferramental" : "ferramentais"}
      />

      {tools.length === 0 ? (
        <EmptyState
          title="Nenhum ferramental encontrado"
          description={searchTerm ? `Nenhum resultado para "${searchTerm}".` : "Cadastre o primeiro ferramental para começar."}
          action={!searchTerm ? <Link href="/ferramentais/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Cadastrar Ferramental</Link> : undefined}
        />
      ) : (
        <ToolsTable
          rows={tools.map((tool) => {
            const proj = projById.get(tool.id);
            const accumulated = proj ? (proj.realEstimatedStrokes ?? proj.estimatedStrokes) : tool.currentStrokes;
            const status = proj?.status ?? "OK";
            return { tool, accumulated, status };
          })}
          searchTerm={searchTerm}
          pagination={<Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} />}
        />
      )}
    </div>
  );
}
