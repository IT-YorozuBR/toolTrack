"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addProductToProject, removeProductFromProject } from "@/lib/actions/project-products";
import { toggleProjectActive } from "@/lib/actions/projects";
import type { Project, Product, ProjectProduct } from "@prisma/client";

type SlimProduct = Pick<Product, "id" | "code" | "modelo" | "description"> & {
  _count: { bomItems: number };
};

type ProjectWithProducts = Project & {
  projectProducts: Array<ProjectProduct & { product: SlimProduct }>;
};

interface Props {
  project: ProjectWithProducts;
  allProducts: SlimProduct[];
  backUrl: string;
}

export function ProjectManager({ project, allProducts, backUrl }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const addedProductIds = useMemo(
    () => new Set(project.projectProducts.map((pp) => pp.productId)),
    [project.projectProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (addedProductIds.has(p.id)) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        (p.modelo ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [allProducts, addedProductIds, search]);

  async function handleAddProduct(productId: string) {
    setLoading(productId);
    await addProductToProject(project.id, productId);
    setLoading(null);
    setPickerOpen(false);
    setSearch("");
    router.refresh();
  }

  async function handleRemove(productId: string) {
    if (!window.confirm("Remover este produto do projeto?")) return;
    setLoading(productId);
    await removeProductFromProject(project.id, productId);
    setLoading(null);
    router.refresh();
  }

  async function handleToggleActive() {
    setToggling(true);
    await toggleProjectActive(project.id, !project.active);
    setToggling(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href={backUrl} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            ← Voltar
          </a>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
              {!project.active && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  Inativo
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/projetos/${project.id}/editar`}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Editar
          </Link>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`px-3 py-2 border rounded-lg text-sm disabled:opacity-50 transition-colors ${
              project.active
                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                : "border-green-300 text-green-700 hover:bg-green-50"
            }`}
          >
            {project.active ? "Desativar" : "Ativar"}
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <span className="text-lg leading-none">+</span>
            Adicionar Produto
          </button>
        </div>
      </div>

      {project.projectProducts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm mb-3">Nenhum produto vinculado a este projeto.</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="text-blue-600 text-sm hover:underline"
          >
            + Adicionar o primeiro produto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {project.projectProducts.map(({ product, productId }) => (
            <div
              key={productId}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 relative transition-opacity ${
                loading === productId ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <button
                onClick={() => handleRemove(productId)}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 text-sm font-bold transition-colors"
                title="Remover produto"
              >
                ×
              </button>
              <Link
                href={`/bom?produto=${productId}&back=${encodeURIComponent(`/projetos?projeto=${project.id}`)}`}
                className="block pr-8 group"
                title="Ver ferramentas no BOM"
              >
                <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{product.code}</p>
                {product.modelo && (
                  <p className="text-xs text-gray-500 mt-0.5">{product.modelo}</p>
                )}
                {product.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{product.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    product._count.bomItems > 0 ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {product._count.bomItems} {product._count.bomItems === 1 ? "ferramenta" : "ferramentas"}
                  </span>
                  <span className="text-[10px] text-blue-400 group-hover:text-blue-600">Ver →</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setPickerOpen(false); setSearch(""); }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Selecionar Produto</h3>
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
                placeholder="Buscar por código, modelo ou descrição…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-gray-400">
                  {search ? "Nenhum produto encontrado." : "Todos os produtos já foram adicionados."}
                </li>
              ) : (
                filteredProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => handleAddProduct(product.id)}
                      disabled={loading === product.id}
                      className="w-full text-left px-5 py-3 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900 text-sm">{product.code}</p>
                      {(product.modelo || product.description) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[product.modelo, product.description].filter(Boolean).join(" — ")}
                        </p>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
