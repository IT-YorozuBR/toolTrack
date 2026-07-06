"use client";
import { Fragment, useState, useRef, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Search, X } from "lucide-react";
import { upsertProjectForecast } from "@/lib/actions/project-forecasts";
import { upsertBomItemForecastOverride } from "@/lib/actions/bom-item-forecast-overrides";
import {
  getProjectDemandTree,
  findProjectsWithTool,
  type ProjectDemandProductRow,
} from "@/lib/actions/project-demand-tree";
import type { WindowCol } from "./VolumeGrid";

export type ProjectVolumeRow = {
  projectId: string;
  name: string;
  cells: Record<string, { id: string | null; plannedQuantity: number | null }>;
};

interface Props {
  rows: ProjectVolumeRow[];
  cols: WindowCol[];
  windowStart: string; // ISO date, inicio da janela (para buscar a arvore Produto->Ferramenta)
  windowEnd: string;
}

type EditingCell = { projectId: string; monthKey: string };
type EditingToolCell = { bomItemId: string; monthKey: string };

export function ProjectVolumeGrid({ rows, cols, windowStart, windowEnd }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Drill-down Projeto -> Produto -> Ferramenta
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [trees, setTrees] = useState<Map<string, ProjectDemandProductRow[]>>(new Map());
  const [loadingTree, setLoadingTree] = useState<Set<string>>(new Set());
  const [editingTool, setEditingTool] = useState<EditingToolCell | null>(null);
  const [toolInputValue, setToolInputValue] = useState("");
  const toolInputRef = useRef<HTMLInputElement>(null);
  const [savingTool, setSavingTool] = useState<Set<string>>(new Set());
  const [toolSearch, setToolSearch] = useState<Map<string, string>>(new Map());

  // Busca global de ferramenta: digitando um codigo aqui, abre a arvore inteira
  // (Projeto -> Produto -> Ferramenta) direto nos projetos/produtos que tem essa
  // ferramenta, sem precisar expandir manualmente projeto por projeto.
  const [globalToolSearch, setGlobalToolSearch] = useState("");
  const [matchedProjectIds, setMatchedProjectIds] = useState<Set<string> | null>(null);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  function toggleExpandProduct(productId: string) {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function loadTree(projectId: string) {
    if (trees.has(projectId) || loadingTree.has(projectId)) return;
    setLoadingTree((s) => new Set(s).add(projectId));
    const tree = await getProjectDemandTree(projectId, new Date(windowStart), new Date(windowEnd));
    setTrees((prev) => new Map(prev).set(projectId, tree));
    setLoadingTree((s) => {
      const next = new Set(s);
      next.delete(projectId);
      return next;
    });
  }

  async function toggleExpand(projectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    await loadTree(projectId);
  }

  // Snapshot de expanded/toolSearch de ANTES da busca global comecar — usado para
  // restaurar exatamente o estado anterior quando a busca e apagada, em vez de deixar
  // os projetos/filtros que ELA abriu presos (o que atrapalhava a navegacao).
  const searchSnapshot = useRef<{ expanded: Set<string>; toolSearch: Map<string, string> } | null>(null);

  // Busca global (debounce de 300ms): acha os projetos que tem a ferramenta, forca
  // eles abertos e ja filtra a arvore de cada um pelo mesmo termo (reaproveita o
  // filtro por-projeto que ja existe e auto-expande so o produto que bate).
  useEffect(() => {
    const term = globalToolSearch.trim();

    if (!term) {
      // Apagou a busca: volta exatamente ao estado de antes de comecar a buscar,
      // em vez de deixar os projetos abertos pela busca anterior presos.
      if (searchSnapshot.current) {
        setExpanded(searchSnapshot.current.expanded);
        setToolSearch(searchSnapshot.current.toolSearch);
        searchSnapshot.current = null;
      }
      setMatchedProjectIds(null);
      return;
    }

    if (!searchSnapshot.current) {
      searchSnapshot.current = { expanded: new Set(expanded), toolSearch: new Map(toolSearch) };
    }

    setSearchingGlobal(true);
    const timeout = setTimeout(async () => {
      const projectIds = await findProjectsWithTool(term);
      setMatchedProjectIds(new Set(projectIds));
      setExpanded((prev) => new Set([...prev, ...projectIds]));
      setToolSearch((prev) => {
        const next = new Map(prev);
        for (const id of projectIds) next.set(id, term);
        return next;
      });
      await Promise.all(projectIds.map((id) => loadTree(id)));
      setSearchingGlobal(false);
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalToolSearch]);

  function clearGlobalSearch() {
    setGlobalToolSearch("");
  }

  // Reseta tudo para o estado inicial: fecha toda arvore aberta (manual ou por busca),
  // limpa a busca global e os filtros por projeto. Util quando varias buscas/expansoes
  // deixam a tela poluida e o usuario so quer "comecar de novo".
  function clearAllFilters() {
    searchSnapshot.current = null;
    setGlobalToolSearch("");
    setMatchedProjectIds(null);
    setExpanded(new Set());
    setExpandedProducts(new Set());
    setToolSearch(new Map());
  }

  const hasActiveFilters =
    globalToolSearch.trim().length > 0 || expanded.size > 0 || expandedProducts.size > 0 || toolSearch.size > 0;

  function toolCellKey(bomItemId: string, monthKey: string) {
    return `${bomItemId}_${monthKey}`;
  }

  function startEditTool(bomItemId: string, monthKey: string, current: number) {
    setEditingTool({ bomItemId, monthKey });
    setToolInputValue(current ? String(current) : "");
    setTimeout(() => toolInputRef.current?.focus(), 0);
  }

  function cancelEditTool() {
    setEditingTool(null);
    setToolInputValue("");
  }

  async function commitEditTool(projectId: string) {
    if (!editingTool) return;
    const qty = parseInt(toolInputValue) || 0;
    const col = cols.find((c) => c.key === editingTool.monthKey);
    if (!col) return;

    const [year, month] = col.date.split("-").map(Number);
    const { bomItemId, monthKey } = editingTool;
    const key = toolCellKey(bomItemId, monthKey);

    setEditingTool(null);
    setSavingTool((s) => new Set(s).add(key));

    await upsertBomItemForecastOverride({
      bomItemId,
      referenceMonth: new Date(Date.UTC(year, month - 1, 1, 12)),
      plannedQuantity: qty,
    });

    // Atualiza só a arvore desse projeto em memoria (nao precisa recarregar a pagina toda)
    setTrees((prev) => {
      const next = new Map(prev);
      const tree = next.get(projectId);
      if (!tree) return prev;
      next.set(
        projectId,
        tree.map((product) => ({
          ...product,
          tools: product.tools.map((tool) => {
            if (tool.bomItemId !== bomItemId) return tool;
            const overrides = { ...tool.overrides };
            if (qty > 0) overrides[monthKey] = qty;
            else delete overrides[monthKey];
            return { ...tool, overrides };
          }),
        })),
      );
      return next;
    });

    setSavingTool((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    startTransition(() => router.refresh());
  }

  function handleToolKeyDown(e: React.KeyboardEvent, projectId: string) {
    if (e.key === "Enter") commitEditTool(projectId);
    if (e.key === "Escape") cancelEditTool();
  }

  // Drag-to-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ pending: false, dragging: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { pending: true, dragging: false, startX: e.pageX, scrollLeft: el.scrollLeft };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !drag.current.pending) return;
    const delta = e.pageX - drag.current.startX;
    if (!drag.current.dragging && Math.abs(delta) < 5) return;
    drag.current.dragging = true;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
    el.scrollLeft = drag.current.scrollLeft - delta;
  }, []);

  const onMouseUp = useCallback(() => {
    drag.current.pending = false;
    drag.current.dragging = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.style.userSelect = "";
    }
  }, []);

  function cellKey(projectId: string, monthKey: string) {
    return `${projectId}_${monthKey}`;
  }

  function startEdit(projectId: string, monthKey: string, current: number | null) {
    setEditing({ projectId, monthKey });
    setInputValue(current ? String(current) : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(null);
    setInputValue("");
  }

  async function commitEdit() {
    if (!editing) return;
    const qty = parseInt(inputValue) || 0;
    const col = cols.find((c) => c.key === editing.monthKey);
    if (!col) return;

    const [year, month] = col.date.split("-").map(Number);
    const key = cellKey(editing.projectId, editing.monthKey);

    setEditing(null);
    setSaving((s) => new Set(s).add(key));

    await upsertProjectForecast({
      projectId: editing.projectId,
      referenceMonth: new Date(Date.UTC(year, month - 1, 1, 12)),
      plannedQuantity: qty,
    });

    setSaving((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    startTransition(() => router.refresh());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  }

  const colLabel = (col: WindowCol) => (
    <div className="text-center">
      <div className={`text-xs font-medium uppercase ${col.isCurrent ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
        {col.label}
      </div>
      {col.isCurrent && <div className="text-[10px] text-blue-400 mt-0.5">atual</div>}
    </div>
  );

  const visibleRows = matchedProjectIds ? rows.filter((r) => matchedProjectIds.has(r.projectId)) : rows;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-3 border-b border-gray-200 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={globalToolSearch}
              onChange={(e) => setGlobalToolSearch(e.target.value)}
              placeholder="Buscar ferramenta em todos os projetos… (abre a árvore inteira)"
              className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {globalToolSearch && (
              <button
                onClick={clearGlobalSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpar busca"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="shrink-0 text-xs font-medium text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg px-3 py-2 transition-colors"
              title="Fecha toda árvore aberta e limpa todos os filtros"
            >
              Limpar filtros
            </button>
          )}
        </div>
        {matchedProjectIds && (
          <p className="mt-2 text-xs text-gray-500">
            {searchingGlobal
              ? "Buscando…"
              : matchedProjectIds.size === 0
              ? `Nenhum projeto tem uma ferramenta com "${globalToolSearch}".`
              : `${matchedProjectIds.size} projeto(s) com essa ferramenta — árvore aberta abaixo.`}
          </p>
        )}
      </div>
      <div
        ref={scrollRef}
        className="overflow-x-auto cursor-grab"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projeto</th>
              {cols.map((col) => (
                <th key={col.key} className="px-5 py-3 text-center w-36">
                  {colLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row) => {
              const isExpanded = expanded.has(row.projectId);
              const isLoadingTree = loadingTree.has(row.projectId);
              const tree = trees.get(row.projectId);
              const searchTerm = (toolSearch.get(row.projectId) ?? "").trim().toLowerCase();
              const isSearching = searchTerm.length > 0;

              // Com busca ativa: só mostra produtos com ao menos 1 ferramenta batendo,
              // e só as ferramentas que batem (ignora o toggle manual por produto).
              // Sem busca: mostra todos os produtos, cada um com seu toggle proprio.
              const visibleTree = tree
                ?.map((product) => ({
                  ...product,
                  tools: isSearching
                    ? product.tools.filter((t) => t.toolCode.toLowerCase().includes(searchTerm))
                    : product.tools,
                }))
                .filter((product) => !isSearching || product.tools.length > 0);

              return (
              <Fragment key={row.projectId}>
              <tr className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleExpand(row.projectId)}
                    className="flex items-center gap-1.5 font-medium text-gray-900 hover:text-blue-700"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )}
                    {row.name}
                  </button>
                </td>
                {cols.map((col) => {
                  const cell = row.cells[col.key] ?? { id: null, plannedQuantity: null };
                  const key = cellKey(row.projectId, col.key);
                  const isEditing = editing?.projectId === row.projectId && editing.monthKey === col.key;
                  const isSaving = saving.has(key);

                  return (
                    <td key={col.key} className="px-2 py-2 text-center">
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min="0"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full text-center border border-blue-400 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                          placeholder="0"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(row.projectId, col.key, cell.plannedQuantity)}
                          disabled={isSaving}
                          className={`w-full rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors
                            ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-blue-50 hover:text-blue-700"}
                            ${cell.plannedQuantity ? "text-gray-900 font-medium" : "text-gray-300"}
                            ${col.isCurrent ? "bg-blue-50/40" : ""}
                          `}
                        >
                          {isSaving ? (
                            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          ) : cell.plannedQuantity ? (
                            cell.plannedQuantity.toLocaleString("pt-BR")
                          ) : (
                            "—"
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>

              {isExpanded && isLoadingTree && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-8 py-3 text-xs text-gray-400">
                    Carregando produtos e ferramentas…
                  </td>
                </tr>
              )}

              {isExpanded && !isLoadingTree && tree?.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-8 py-3 text-xs text-gray-400">
                    Nenhum produto vinculado a este projeto.
                  </td>
                </tr>
              )}

              {isExpanded && !isLoadingTree && tree && tree.length > 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-8 py-2 bg-white">
                    <input
                      type="text"
                      value={toolSearch.get(row.projectId) ?? ""}
                      onChange={(e) =>
                        setToolSearch((prev) => new Map(prev).set(row.projectId, e.target.value))
                      }
                      placeholder="Buscar ferramenta por código…"
                      className="w-full max-w-xs text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              )}

              {isExpanded && !isLoadingTree && isSearching && visibleTree?.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="px-8 py-3 text-xs text-gray-400">
                    Nenhuma ferramenta encontrada para &quot;{toolSearch.get(row.projectId)}&quot;.
                  </td>
                </tr>
              )}

              {isExpanded && !isLoadingTree && visibleTree?.map((product) => {
                const isProductExpanded = isSearching || expandedProducts.has(product.productId);
                return (
                <Fragment key={product.productId}>
                <tr className="bg-gray-50/60">
                  <td className="px-8 py-2" colSpan={cols.length + 1}>
                    <button
                      onClick={() => toggleExpandProduct(product.productId)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-blue-700"
                    >
                      {isProductExpanded ? (
                        <ChevronDown size={12} className="text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight size={12} className="text-gray-400 shrink-0" />
                      )}
                      {product.productCode}
                      <span className="text-gray-400 font-normal">({product.tools.length})</span>
                    </button>
                  </td>
                </tr>
                {isProductExpanded && product.tools.map((tool) => (
                  <tr key={tool.bomItemId} className="hover:bg-blue-50/30">
                    <td className="pl-14 pr-5 py-1.5 text-xs text-gray-700">
                      {tool.toolCode}
                      <span
                        className="text-gray-400 ml-1"
                        title="Qtd. usada no BOM — multiplica o cálculo de batidas"
                      >
                        uso ×{tool.quantityUsed}
                      </span>
                      <span
                        className={`ml-1 ${
                          tool.quantityUsed > 1 && tool.shotsPerStroke === 1
                            ? "text-amber-700 font-semibold"
                            : "text-gray-400"
                        }`}
                        title="Cavidade da ferramenta (shotsPerStroke) — divide o cálculo de batidas"
                      >
                        cav ÷{tool.shotsPerStroke}
                        {tool.quantityUsed > 1 && tool.shotsPerStroke === 1 && " ⚠"}
                      </span>
                    </td>
                    {cols.map((col) => {
                      const inherited = row.cells[col.key]?.plannedQuantity ?? 0;
                      const override = tool.overrides[col.key];
                      const hasOverride = override !== undefined;
                      const displayValue = hasOverride ? override : inherited;
                      const key = toolCellKey(tool.bomItemId, col.key);
                      const isEditingThis = editingTool?.bomItemId === tool.bomItemId && editingTool.monthKey === col.key;
                      const isSavingThis = savingTool.has(key);

                      return (
                        <td key={col.key} className="px-2 py-1.5 text-center">
                          {isEditingThis ? (
                            <input
                              ref={toolInputRef}
                              type="number"
                              min="0"
                              value={toolInputValue}
                              onChange={(e) => setToolInputValue(e.target.value)}
                              onBlur={() => commitEditTool(row.projectId)}
                              onKeyDown={(e) => handleToolKeyDown(e, row.projectId)}
                              className="w-full text-center border border-blue-400 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                              placeholder={String(inherited)}
                            />
                          ) : (
                            <button
                              onClick={() => startEditTool(tool.bomItemId, col.key, displayValue)}
                              disabled={isSavingThis}
                              title={hasOverride ? "Valor sobrescrito para esta ferramenta — clique para editar" : "Herdado do projeto — clique para sobrescrever"}
                              className={`w-full rounded-md px-2 py-1 text-xs tabular-nums transition-colors
                                ${isSavingThis ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-blue-50 hover:text-blue-700"}
                                ${hasOverride ? "text-amber-700 font-semibold" : "text-gray-400 italic"}
                              `}
                            >
                              {isSavingThis ? (
                                <span className="inline-block w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              ) : displayValue ? (
                                displayValue.toLocaleString("pt-BR")
                              ) : (
                                "—"
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                </Fragment>
                );
              })}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
