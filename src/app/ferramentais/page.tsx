import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { getMaintenanceStatus } from "@/lib/calculations/strokes";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { ToolActions } from "./ToolActions";

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

  const [tools, total] = await Promise.all([
    prisma.tool.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.tool.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
        placeholder="Buscar por código, prensa, linha ou descrição…"
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prensa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linha</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shot</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batidas Atuais</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Limite Prev.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ativo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tools.map((tool) => {
                  const status = getMaintenanceStatus(tool.currentStrokes, 0, tool.preventiveLimit, tool.warningLimit, tool.shotsPerStroke);
                  return (
                    <tr key={tool.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{tool.code}</td>
                      <td className="px-6 py-4 text-gray-600">{tool.description ?? "—"}</td>
                      <td className="px-6 py-4 text-gray-600">{tool.press}</td>
                      <td className="px-6 py-4 text-gray-600">{tool.line ?? "—"}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{formatNumber(tool.shotsPerStroke)}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{formatNumber(tool.currentStrokes)}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{formatNumber(tool.preventiveLimit)}</td>
                      <td className="px-6 py-4"><StatusBadge status={status} /></td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tool.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {tool.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ToolActions tool={tool} />
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
