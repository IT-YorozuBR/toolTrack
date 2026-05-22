import { PageHeader } from "@/components/ui/PageHeader";
import { ToolForm } from "../ToolForm";
import Link from "next/link";

export default function NovoFerramentalPage() {
  return (
    <div>
      <PageHeader
        title="Novo Ferramental"
        description="Cadastrar um novo ferramental de prensa"
        action={
          <Link href="/ferramentais" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <ToolForm />
      </div>
    </div>
  );
}
