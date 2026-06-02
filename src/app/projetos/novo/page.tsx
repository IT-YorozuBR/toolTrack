import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "../ProjectForm";
import Link from "next/link";

export default function NovoProjetoPage() {
  return (
    <div>
      <PageHeader
        title="Novo Projeto"
        description="Cadastrar novo projeto"
        action={
          <Link href="/projetos" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <ProjectForm />
      </div>
    </div>
  );
}
