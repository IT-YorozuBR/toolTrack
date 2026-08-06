"use client";
import { Fragment, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Search, X } from "lucide-react";
import {
  getProjectToolTree,
  findProjectsWithTool,
  type ProjectToolTreeRow,
} from "@/lib/actions/project-demand-tree";

type ProjectRow = { id: string; name: string };

export function ProjectMaintenanceTree({ projects }: { projects: ProjectRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [trees, setTrees] = useState<Map<string, ProjectToolTreeRow[]>>(new Map());
  const [loadingTree, setLoadingTree] = useState<Set<string>>(new Set());
  const [toolSearch, setToolSearch] = useState<Map<string, string>>(new Map());

  // Busca global de ferramenta: digitando um código aqui, abre a árvore inteira
  // (Projeto -> Produto -> Ferramenta) direto nos projetos/produtos que têm essa
  // ferramenta, sem precisar expandir manualmente projeto por projeto.
  const [globalToolSearch, setGlobalToolSearch] = useState("");
  const [matchedProjectIds, setMatchedProjectIds] = useState<Set<string> | null>(null);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  const searchSnapshot = useRef<{ expanded: Set<string>; toolSearch: Map<string, string> } | null>(null);

  async function loadTree(projectId: string) {
    if (trees.has(projectId) || loadingTree.has(projectId)) return;
    setLoadingTree((s) => new Set(s).add(projectId));
    const tree = await getProjectToolTree(projectId);
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

  function toggleExpandProduct(productId: string) {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  useEffect(() => {
    const term = globalToolSearch.trim();

    if (!term) {
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

  const visibleProjects = matchedProjectIds ? projects.filter((p) => matchedProjectIds.has(p.id)) : projects;

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

      {visibleProjects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Nenhum projeto encontrado.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibleProjects.map((project) => {
            const isExpanded = expanded.has(project.id);
            const isLoadingTree = loadingTree.has(project.id);
            const tree = trees.get(project.id);
            const searchTerm = (toolSearch.get(project.id) ?? "").trim().toLowerCase();
            const isSearching = searchTerm.length > 0;

            const visibleTree = tree
              ?.map((product) => ({
                ...product,
                tools: isSearching
                  ? product.tools.filter((t) => t.toolCode.toLowerCase().includes(searchTerm))
                  : product.tools,
              }))
              .filter((product) => !isSearching || product.tools.length > 0);

            return (
              <li key={project.id}>
                <button
                  onClick={() => toggleExpand(project.id)}
                  className="w-full flex items-center gap-1.5 px-5 py-3 font-medium text-gray-900 hover:bg-gray-50 hover:text-blue-700 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  )}
                  {project.name}
                </button>

                {isExpanded && isLoadingTree && (
                  <p className="px-8 py-3 text-xs text-gray-400">Carregando produtos e ferramentas…</p>
                )}

                {isExpanded && !isLoadingTree && tree?.length === 0 && (
                  <p className="px-8 py-3 text-xs text-gray-400">Nenhum produto vinculado a este projeto.</p>
                )}

                {isExpanded && !isLoadingTree && tree && tree.length > 0 && (
                  <div className="px-8 pb-2">
                    <input
                      type="text"
                      value={toolSearch.get(project.id) ?? ""}
                      onChange={(e) => setToolSearch((prev) => new Map(prev).set(project.id, e.target.value))}
                      placeholder="Buscar ferramenta por código…"
                      className="w-full max-w-xs text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {isExpanded && !isLoadingTree && isSearching && visibleTree?.length === 0 && (
                  <p className="px-8 py-3 text-xs text-gray-400">
                    Nenhuma ferramenta encontrada para &quot;{toolSearch.get(project.id)}&quot;.
                  </p>
                )}

                {isExpanded && !isLoadingTree && visibleTree && visibleTree.length > 0 && (
                  <ul className="pb-2">
                    {visibleTree.map((product) => {
                      const isProductExpanded = isSearching || expandedProducts.has(product.productId);
                      return (
                        <Fragment key={product.productId}>
                          <li className="bg-gray-50/60">
                            <button
                              onClick={() => toggleExpandProduct(product.productId)}
                              className="w-full flex items-center gap-1.5 px-8 py-2 text-xs font-medium text-gray-600 hover:text-blue-700 text-left"
                            >
                              {isProductExpanded ? (
                                <ChevronDown size={12} className="text-gray-400 shrink-0" />
                              ) : (
                                <ChevronRight size={12} className="text-gray-400 shrink-0" />
                              )}
                              {product.productCode}
                              <span className="text-gray-400 font-normal">({product.tools.length})</span>
                            </button>
                          </li>
                          {isProductExpanded &&
                            product.tools.map((tool) => (
                              <li key={tool.toolId}>
                                <Link
                                  href={`/manutencoes?ferramenta=${tool.toolId}`}
                                  className="flex items-center pl-14 pr-5 py-1.5 text-xs text-gray-700 hover:bg-blue-50/60 hover:text-blue-700"
                                >
                                  {tool.toolCode}
                                </Link>
                              </li>
                            ))}
                        </Fragment>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
