import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "../../ProjectForm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditarProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) notFound();

  return (
    <div>
      <PageHeader
        title="Editar Projeto"
        description={project.name}
        action={
          <Link href="/projetos" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <ProjectForm project={project} />
      </div>
    </div>
  );
}
