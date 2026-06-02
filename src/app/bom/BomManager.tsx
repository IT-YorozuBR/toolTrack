"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBomItem, deleteBomItem, updateBomItem } from "@/lib/actions/bom";
import { fetchToolProjection } from "@/lib/actions/tool-projection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ToolProjection } from "@/lib/calculations/strokes";
import type { Tool, BomItem, Product } from "@prisma/client";

type SlimTool = Pick<Tool, "id" | "code" | "description" | "shotsPerStroke">;

type ProductWithBom = Product & {
  bomItems: Array<BomItem & { tool: Tool }>;
};

interface Props {
  product: ProductWithBom;
  allTools: SlimTool[];
  backUrl: string;
}

export function BomManager({ product, allTools, backUrl }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [projection, setProjection] = useState<ToolProjection | null>(null);
  const [projectionLoading, setProjectionLoading] = useState<string | null>(null);

  async function handleViewProjection(toolId: string) {
    setProjectionLoading(toolId);
    const result = await fetchToolProjection(toolId);
    setProjectionLoading(null);
    if (result) setProjection(result);
  }

  const addedToolIds = useMemo(
    () => new Set(product.bomItems.map((b) => b.toolId)),
    [product.bomItems]
  );

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTools.filter((t) => {
      if (addedToolIds.has(t.id)) return false;
      if (!q) return true;
      return t.code.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    });
  }, [allTools, addedToolIds, search]);

  async function handleAddTool(toolId: string) {
    setLoading(toolId);
    await createBomItem({ productId: product.id, toolId, quantityUsed: 1 });
    setLoading(null);
    setPickerOpen(false);
    setSearch("");
    router.refresh();
  }

  async function handleRemove(bomItemId: string) {
    setLoading(bomItemId);
    await deleteBomItem(bomItemId);
    setLoading(null);
    router.refresh();
  }

  async function handleQuantityBlur(bomItemId: string, value: number) {
    if (value <= 0) return;
    await updateBomItem(bomItemId, { quantityUsed: value });
    router.refresh();
  }

  return (
    <>
      {/* Cabeçalho do produto selecionado */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <a
            href={backUrl}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← Voltar
          </a>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{product.code}</h2>
            {(product.modelo || product.description) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {[product.modelo, product.description].filter(Boolean).join(" — ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
        >
          <span className="text-lg leading-none">+</span>
          Adicionar Ferramenta
        </button>
      </div>

      {/* Cards de ferramentas */}
      {product.bomItems.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm mb-3">Nenhuma ferramenta vinculada ainda.</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-blue-600 text-sm hover:underline"
          >
            + Adicionar a primeira ferramenta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {product.bomItems.map((item) => (
            <ToolCard
              key={item.id}
              item={item}
              loading={loading === item.id}
              projectionLoading={projectionLoading === item.tool.id}
              onRemove={() => handleRemove(item.id)}
              onQuantityBlur={(val) => handleQuantityBlur(item.id, val)}
              onViewProjection={() => handleViewProjection(item.tool.id)}
            />
          ))}
        </div>
      )}

      {/* Modal picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setPickerOpen(false); setSearch(""); }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Selecionar Ferramenta</h3>
              <button
                onClick={() => { setPickerOpen(false); setSearch(""); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código ou descrição…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {filteredTools.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-gray-400">
                  {search ? "Nenhuma ferramenta encontrada." : "Todas as ferramentas já foram adicionadas."}
                </li>
              ) : (
                filteredTools.map((tool) => (
                  <li key={tool.id}>
                    <button
                      onClick={() => handleAddTool(tool.id)}
                      disabled={loading === tool.id}
                      className="w-full text-left px-5 py-3 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900 text-sm">{tool.code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tool.description ? `${tool.description} · ` : ""}
                        {tool.shotsPerStroke} cav/shot
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Modal de projeção 50K */}
      {projection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProjection(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{projection.code}</h3>
                {projection.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{projection.description}</p>
                )}
              </div>
              <button onClick={() => setProjection(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Status + atinge */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={projection.status} />
                {projection.reachesLimitInMonth && (
                  <span className="text-xs text-gray-500">Atinge limite em <strong>{projection.reachesLimitInMonth}</strong></span>
                )}
              </div>

              {/* Números principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Estimadas", value: Math.round(projection.estimatedStrokes).toLocaleString("pt-BR") },
                  { label: "Projetado total", value: Math.round(projection.totalProjectedStrokes).toLocaleString("pt-BR") },
                  { label: "Saldo 50K", value: Math.round(projection.remainingStrokes).toLocaleString("pt-BR"), highlight: projection.remainingStrokes < 5000 },
                  { label: "Limite", value: projection.preventiveLimit.toLocaleString("pt-BR") },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 uppercase font-medium">{label}</p>
                    <p className={`text-base font-semibold tabular-nums mt-0.5 ${highlight ? "text-red-600" : "text-gray-900"}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Janela de meses */}
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-2">Previsão por mês</p>
                <div className="grid grid-cols-4 gap-2">
                  {projection.window.map((m) => (
                    <div key={m.key} className={`rounded-lg px-3 py-2 text-center ${m.offset === 0 ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                      <p className={`text-[10px] font-medium uppercase ${m.offset === 0 ? "text-blue-600" : "text-gray-500"}`}>{m.label}</p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5 text-gray-800">
                        {m.strokes > 0 ? Math.round(m.strokes).toLocaleString("pt-BR") : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToolCard({
  item,
  loading,
  projectionLoading,
  onRemove,
  onQuantityBlur,
  onViewProjection,
}: {
  item: BomItem & { tool: Tool };
  loading: boolean;
  projectionLoading: boolean;
  onRemove: () => void;
  onQuantityBlur: (val: number) => void;
  onViewProjection: () => void;
}) {
  const [qty, setQty] = useState(Math.round(item.quantityUsed));

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 relative transition-opacity ${
        loading ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <button
        onClick={() => {
          if (window.confirm(`Remover "${item.tool.code}" deste produto?`)) {
            onRemove();
          }
        }}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 text-sm font-bold transition-colors"
        title="Remover ferramenta"
      >
        ×
      </button>
      <p className="font-semibold text-gray-900 text-sm pr-8">{item.tool.code}</p>
      {item.tool.description && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.tool.description}</p>
      )}
      <p className="text-xs text-gray-400 mt-2">{item.tool.shotsPerStroke} cav/shot</p>
      <div className="flex items-center gap-2 mt-3">
        <label className="text-xs text-gray-600 font-medium">Qtd.</label>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value) || 1)}
          onBlur={(e) => onQuantityBlur(parseInt(e.target.value) || 1)}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={onViewProjection}
        disabled={projectionLoading}
        className="mt-3 w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 transition-colors disabled:opacity-50 text-left"
      >
        {projectionLoading ? "Carregando..." : "Ver projeção 50K →"}
      </button>
    </div>
  );
}
