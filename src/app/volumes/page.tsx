import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { ProjectVolumeGrid, type ProjectVolumeRow } from "./ProjectVolumeGrid";
import type { WindowCol } from "./VolumeGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

function getFiscalYearCols(): WindowCol[] {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Fiscal year: April (month 3) → March. Starts in April of current year if month >= April, else previous year.
  const fiscalStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);

  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: `${PT_MONTHS[date.getMonth()]}/${date.getFullYear()}`,
      offset: i,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
      isCurrent: key === currentMonthKey,
    };
  });
}

export default async function VolumesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const cols = getFiscalYearCols();
  // Parse date strings as local dates to avoid UTC offset shifting the month
  const [sy, sm] = cols[0].date.split("-").map(Number);
  const [ey, em] = cols[11].date.split("-").map(Number);
  const windowStart = new Date(sy, sm - 1, 1);
  const windowEnd = new Date(ey, em, 1); // em is 1-indexed month → em as 0-indexed = next month

  const where = searchTerm
    ? { name: { contains: searchTerm, mode: "insensitive" as const }, active: true }
    : { active: true };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where }),
  ]);

  const projectIds = projects.map((p) => p.id);
  const forecasts = await prisma.projectForecast.findMany({
    where: {
      projectId: { in: projectIds },
      referenceMonth: { gte: windowStart, lt: windowEnd },
    },
  });

  const forecastMap = new Map<string, { id: string; plannedQuantity: number }>();
  for (const f of forecasts) {
    const key = `${f.projectId}_${f.referenceMonth.getFullYear()}-${String(f.referenceMonth.getMonth() + 1).padStart(2, "0")}`;
    forecastMap.set(key, { id: f.id, plannedQuantity: f.plannedQuantity });
  }

  const rows: ProjectVolumeRow[] = projects.map((p) => ({
    projectId: p.id,
    name: p.name,
    cells: Object.fromEntries(
      cols.map((col) => {
        const cell = forecastMap.get(`${p.id}_${col.key}`) ?? { id: null, plannedQuantity: null };
        return [col.key, cell];
      })
    ),
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    params.set("page", String(p));
    return `/volumes?${params.toString()}`;
  }

  // Fiscal year label e.g. "2026/2027"
  const fiscalYearLabel = `${new Date(cols[0].date).getFullYear()}/${new Date(cols[11].date).getFullYear()}`;

  return (
    <div>
      <PageHeader
        title="Volumes Previstos"
        description={`Ano fiscal ${fiscalYearLabel} — Abr a Mar`}
        action={
          <Link href="/projetos/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Novo Projeto
          </Link>
        }
      />

      <SearchInput
        basePath="/volumes"
        initialValue={searchTerm}
        placeholder="Buscar por nome do projeto…"
        total={total}
        label={total === 1 ? "projeto" : "projetos"}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description={searchTerm ? `Nenhum resultado para "${searchTerm}".` : "Cadastre projetos para lançar volumes."}
          action={
            !searchTerm ? (
              <Link href="/projetos/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                + Novo Projeto
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <ProjectVolumeGrid rows={rows} cols={cols} />
          <Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} />
        </div>
      )}
    </div>
  );
}
