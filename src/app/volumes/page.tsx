import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { getWindowDates } from "@/lib/calculations/strokes";
import { VolumeGrid, type WindowCol, type VolumeRow } from "./VolumeGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function VolumesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const windowDates = getWindowDates();

  const cols: WindowCol[] = windowDates.map(({ offset, key, label, date }) => ({
    key,
    label,
    offset,
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
  }));



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
  const windowStart = windowDates[0].date;
  const windowEnd = new Date(
    windowDates[3].date.getFullYear(),
    windowDates[3].date.getMonth() + 1,
    1
  );

  const forecasts = await prisma.productionForecast.findMany({
    where: {
      productId: { in: productIds },
      referenceMonth: { gte: windowStart, lt: windowEnd },
    },
  });

  // Build forecast lookup: productId_monthKey → cell
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

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    params.set("page", String(p));
    return `/volumes?${params.toString()}`;
  }

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

      {/* Legenda da janela */}
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
