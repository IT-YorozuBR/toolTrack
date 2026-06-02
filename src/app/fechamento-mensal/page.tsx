import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CloseMonthForm } from "./CloseMonthForm";
import { HistoricoForm } from "./HistoricoForm";

export const dynamic = "force-dynamic";

export default async function FechamentoMensalPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, code: true, description: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          title="Fechamento mensal"
          description="Congela o histórico de batidas do mês anterior para o ciclo 50K."
        />

        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          O fechamento salva snapshots mensais por ferramental. Depois disso, alterações em forecasts antigos não mudam o acumulado fechado do ciclo.
        </div>

        <CloseMonthForm />
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Histórico retroativo</h2>
          <p className="text-sm text-gray-500 mt-1">
            Visualize e corrija batidas reais por produto e ferramental em qualquer período fechado.
          </p>
        </div>

        <HistoricoForm products={products} />
      </div>
    </div>
  );
}
