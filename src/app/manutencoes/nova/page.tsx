import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { MaintenanceForm } from "../MaintenanceForm";
import Link from "next/link";

export default async function NovaManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<{ toolId?: string }>;
}) {
  const params = await searchParams;
  const tools = await prisma.tool.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Registrar Manutenção"
        description="Registrar manutenção realizada em ferramental"
        action={
          <Link
            href="/manutencoes"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <MaintenanceForm tools={tools} defaultToolId={params.toolId} />
      </div>
    </div>
  );
}
