import { PageHeader } from "@/components/ui/PageHeader";
import { ProductForm } from "../ProductForm";
import Link from "next/link";

export default function NovoProdutoPage() {
  return (
    <div>
      <PageHeader
        title="Novo Produto"
        description="Cadastrar produto com lista de materiais (BOM)"
        action={
          <Link href="/produtos" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-2xl">
        <ProductForm />
      </div>
    </div>
  );
}
