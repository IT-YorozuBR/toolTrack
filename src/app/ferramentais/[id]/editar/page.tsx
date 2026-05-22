import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolForm } from "../../ToolForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditarFerramentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool) notFound();

  return (
    <div>
      <PageHeader
        title="Editar Ferramental"
        description={`Editando: ${tool.code}`}
        action={
          <Link href="/ferramentais" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <ToolForm tool={tool} />
      </div>
    </div>
  );
}
