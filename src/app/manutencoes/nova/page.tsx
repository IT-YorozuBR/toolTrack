import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { MaintenanceForm } from "../MaintenanceForm";
import Link from "next/link";

export default async function NovaManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<{ toolId?: string }>;
}) {
  const { toolId } = await searchParams;

  const defaultTool = toolId
    ? await prisma.tool.findUnique({
        where: { id: toolId },
        select: { id: true, code: true, description: true, currentStrokes: true },
      })
    : null;

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
        <MaintenanceForm defaultTool={defaultTool} />
      </div>
    </div>
  );
}
