import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { VolumeActions } from "./VolumeActions";
import { VolumeForm } from "./VolumeForm";
import { formatMonth } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VolumesPage() {
  const [forecasts, products] = await Promise.all([
    prisma.productionForecast.findMany({ include: { product: true }, orderBy: [{ referenceMonth: "desc" }, { product: { code: "asc" } }] }),
    prisma.product.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Volumes Previstos" description="Previsão de produção por produto e mês" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {forecasts.length === 0 ? (
            <EmptyState title="Nenhum volume previsto cadastrado" description="Lance os volumes mensais para calcular as batidas previstas nos ferramentais." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês de Referência</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Volume Previsto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {forecasts.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{f.product.code}</p>
                        {f.product.description && <p className="text-xs text-gray-500">{f.product.description}</p>}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{formatMonth(f.referenceMonth)}</td>
                      <td className="px-6 py-4 text-right tabular-nums font-medium">{f.plannedQuantity.toLocaleString("pt-BR")}</td>
                      <td className="px-6 py-4"><VolumeActions forecast={f} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Lançar Volume Previsto</h2>
            <VolumeForm products={products} />
          </div>
        </div>
      </div>
    </div>
  );
}
