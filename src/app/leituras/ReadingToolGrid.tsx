"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

type ToolCard = {
  id: string;
  code: string;
  description: string | null;
  press: string;
  _count: { strokeReadings: number };
  strokeReadings: {
    readingDate: Date;
    cycleStrokes: number;
  }[];
};

interface Props {
  tools: ToolCard[];
  currentPage: number;
  totalPages: number;
  total: number;
  search: string;
}

export function ReadingToolGrid({ tools, currentPage, totalPages, total, search }: Props) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (inputValue.trim()) params.set("search", inputValue.trim());
      params.set("page", "1");
      router.push(`/leituras?${params.toString()}`);
    }, 400);
    return () => clearTimeout(t);
  }, [inputValue, router]);

  function buildPageUrl(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    return `/leituras?${params.toString()}`;
  }

  function buildToolUrl(toolId: string) {
    const params = new URLSearchParams();
    params.set("ferramenta", toolId);
    if (search) params.set("search", search);
    if (currentPage > 1) params.set("page", String(currentPage));
    return `/leituras?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Buscar por código ou descrição…"
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-400 shrink-0">
          {total} {total === 1 ? "ferramental" : "ferramentais"}
        </span>
      </div>

      {tools.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <p className="text-gray-400 text-sm">Nenhum ferramental encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tools.map((tool) => {
            const last = tool.strokeReadings[0];
            const count = tool._count.strokeReadings;
            return (
              <Link
                key={tool.id}
                href={buildToolUrl(tool.id)}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-400 hover:shadow-md transition-all group block"
              >
                <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {tool.code}
                </p>
                {tool.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{tool.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">{tool.press}</p>

                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      count > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {count} {count === 1 ? "leitura" : "leituras"}
                  </span>
                </div>

                {last ? (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <span className="tabular-nums font-medium text-gray-700">
                      {formatNumber(last.cycleStrokes)} batidas
                    </span>
                    <span className="text-gray-300">·</span>
                    <span>{new Date(last.readingDate).toLocaleDateString("pt-BR")}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-300 italic">Sem leituras</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {currentPage > 1 ? (
            <Link href={buildPageUrl(currentPage - 1)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
              ← Anterior
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-200 text-gray-300 rounded-lg text-sm cursor-not-allowed">← Anterior</span>
          )}
          <span className="text-sm text-gray-500">Página {currentPage} de {totalPages}</span>
          {currentPage < totalPages ? (
            <Link href={buildPageUrl(currentPage + 1)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
              Próxima →
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-200 text-gray-300 rounded-lg text-sm cursor-not-allowed">Próxima →</span>
          )}
        </div>
      )}
    </div>
  );
}
