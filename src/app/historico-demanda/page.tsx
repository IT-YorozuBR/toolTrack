import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { formatNumber } from "@/lib/utils";
import { DemandaFilters } from "./DemandaFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const PT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"] as const;

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${PT_MONTHS[parseInt(m) - 1]}/${y}`;
}

function buildMonthWindow(count: number): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - count + i, 1);
    return { key: toMonthKey(d), label: formatMonthLabel(toMonthKey(d)) };
  });
}

export default async function HistoricoDemandaPage({
  searchParams,
}: {
  searchParams: Promise<{ press?: string; search?: string; page?: string; months?: string }>;
}) {
  const params = await searchParams;
  const monthCount = Math.min(12, Math.max(1, parseInt(params.months ?? "6")));
  const monthWindow = buildMonthWindow(monthCount);
  const fromDate = new Date(monthWindow[0].key + "-01");
  const toDate = new Date();

  const [tools, allPresses] = await Promise.all([
    prisma.tool.findMany({
      where: {
        active: true,
        ...(params.press ? { press: params.press } : {}),
        ...(params.search ? { code: { contains: params.search, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        code: true,
        description: true,
        press: true,
        line: true,
        monthlySnapshots: {
          where: { referenceMonth: { gte: fromDate, lt: toDate } },
          select: { referenceMonth: true, forecastStrokes: true },
          orderBy: { referenceMonth: "asc" },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.tool.findMany({
      select: { press: true },
      distinct: ["press"],
      orderBy: { press: "asc" },
    }),
  ]);

  const currentPage = Math.max(1, parseInt(params.page ?? "1"));
  const totalPages = Math.ceil(tools.length / PAGE_SIZE);
  const paginated = tools.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function buildPageUrl(p: number) {
    const urlParams = new URLSearchParams();
    if (params.press) urlParams.set("press", params.press);
    if (params.search) urlParams.set("search", params.search);
    if (params.months) urlParams.set("months", params.months);
    urlParams.set("page", String(p));
    return `/historico-demanda?${urlParams.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Histórico de Demanda"
        description="Demanda prevista por ferramental e mês, congelada no fechamento."
      />

      <div className="mb-4">
        <DemandaFilters presses={allPresses.map((p) => p.press)} />
      </div>

      {tools.length === 0 ? (
        <EmptyState
          title="Nenhum ferramental encontrado"
          description="Ajuste os filtros ou cadastre ferramentais."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] leading-tight">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[160px]">
                    Ferramental
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase min-w-[70px]">
                    Prensa
                  </th>
                  {monthWindow.map((m) => (
                    <th key={m.key} className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase min-w-[80px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase min-w-[80px] bg-gray-100">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((tool) => {
                  const snapshotByKey = new Map(
                    tool.monthlySnapshots.map((s) => [toMonthKey(new Date(s.referenceMonth)), s.forecastStrokes])
                  );
                  const total = monthWindow.reduce((sum, m) => sum + (snapshotByKey.get(m.key) ?? 0), 0);

                  return (
                    <tr key={tool.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <p className="font-medium text-gray-900">{tool.code}</p>
                        {tool.description && (
                          <p className="mt-0.5 truncate text-[10px] text-gray-500" title={tool.description}>
                            {tool.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{tool.press}</td>
                      {monthWindow.map((m) => {
                        const val = snapshotByKey.get(m.key);
                        return (
                          <td key={m.key} className="px-3 py-2 text-right tabular-nums">
                            {val != null ? (
                              <span className="text-gray-800">{formatNumber(val)}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 bg-gray-50">
                        {total > 0 ? formatNumber(total) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} buildPageUrl={buildPageUrl} />
        </div>
      )}
    </div>
  );
}
