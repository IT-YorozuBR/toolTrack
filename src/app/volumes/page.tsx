import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { getWindowDates } from "@/lib/calculations/strokes";
import { VolumeGrid, type WindowCol, type VolumeRow } from "./VolumeGrid";
import { ProjectVolumeGrid, type ProjectVolumeRow } from "./ProjectVolumeGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function VolumesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; tab?: string }>;
}) {
  const { page, search, tab } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";
  const activeTab = tab === "projeto" ? "projeto" : "produto";

  const windowDates = getWindowDates();
  const cols: WindowCol[] = windowDates.map(({ offset, key, label, date }) => ({
    key,
    label,
    offset,
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
  }));
  const windowStart = windowDates[0].date;
  const windowEnd = new Date(windowDates[3].date.getFullYear(), windowDates[3].date.getMonth() + 1, 1);

  function buildTabUrl(t: string) {
    const params = new URLSearchParams();
    params.set("tab", t);
    return `/volumes?${params.toString()}`;
  }

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (activeTab !== "produto") params.set("tab", activeTab);
    params.set("page", String(p));
    return `/volumes?${params.toString()}`;
  }

  const windowLegend = (
    <div className="flex gap-2 mb-5 flex-wrap">
      {cols.map((col) => (
        <span
          key={col.key}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border
            ${col.offset === 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200"}`}
        >
          <span className="font-semibold">{["N-1", "N", "N+1", "N+2"][col.offset]}</span>
          {col.label}
          {col.offset === 0 && <span className="text-blue-500">(atual)</span>}
        </span>
      ))}
    </div>
  );

  const tabs = (
    <div className="flex gap-1 mb-5 border-b border-gray-200">
      {(["produto", "projeto"] as const).map((t) => (
        <Link
          key={t}
          href={buildTabUrl(t)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === t
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t === "produto" ? "Por Produto" : "Por Projeto"}
        </Link>
      ))}
    </div>
  );

  if (activeTab === "projeto") {
    const projectWhere = searchTerm
      ? { name: { contains: searchTerm, mode: "insensitive" as const }, active: true }
      : { active: true };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: projectWhere,
        orderBy: { name: "asc" },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.project.count({ where: projectWhere }),
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

    return (
      <div>
        <PageHeader
          title="Volumes Previstos"
          description="Previsão de produção na janela de planejamento"
          action={
            <Link href="/projetos/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + Novo Projeto
            </Link>
          }
        />
        {tabs}
        {windowLegend}
        <SearchInput
          basePath="/volumes"
          initialValue={searchTerm}
          placeholder="Buscar por nome do projeto…"
          total={total}
          label={total === 1 ? "projeto" : "projetos"}
          extraParams={{ tab: "projeto" }}
        />
        {projects.length === 0 ? (
          <EmptyState
            title="Nenhum projeto encontrado"
            description={searchTerm ? `Nenhum resultado para "${searchTerm}".` : "Cadastre projetos para lançar volumes."}
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

  // ─── Tab: Por Produto ───
  const where = searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { modelo: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, ...where },
      orderBy: { code: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where: { active: true, ...where } }),
  ]);

  const productIds = products.map((p) => p.id);
  const forecasts = await prisma.productionForecast.findMany({
    where: {
      productId: { in: productIds },
      referenceMonth: { gte: windowStart, lt: windowEnd },
    },
  });

  const forecastMap = new Map<string, { id: string; plannedQuantity: number }>();
  for (const f of forecasts) {
    const key = `${f.productId}_${f.referenceMonth.getFullYear()}-${String(f.referenceMonth.getMonth() + 1).padStart(2, "0")}`;
    forecastMap.set(key, { id: f.id, plannedQuantity: f.plannedQuantity });
  }

  const rows: VolumeRow[] = products.map((p) => ({
    productId: p.id,
    code: p.code,
    modelo: p.modelo,
    cells: Object.fromEntries(
      cols.map((col) => {
        const cell = forecastMap.get(`${p.id}_${col.key}`) ?? { id: null, plannedQuantity: null };
        return [col.key, cell];
      })
    ),
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Volumes Previstos"
        description="Previsão de produção por produto na janela de planejamento"
        action={
          <Link href="/produtos/novo" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Novo Produto
          </Link>
        }
      />
      {tabs}
      {windowLegend}
      <SearchInput
        basePath="/volumes"
        initialValue={searchTerm}
        placeholder="Buscar por código ou modelo…"
        total={total}
        label={total === 1 ? "produto" : "produtos"}
      />
      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={searchTerm ? `Nenhum resultado para "${searchTerm}".` : "Cadastre produtos para lançar volumes."}
        />
      ) : (
        <div className="space-y-4">
          <VolumeGrid rows={rows} cols={cols} />
          <Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} />
        </div>
      )}
    </div>
  );
}
