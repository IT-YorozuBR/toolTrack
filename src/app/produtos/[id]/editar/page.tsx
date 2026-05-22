import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductForm } from "../../ProductForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div>
      <PageHeader
        title="Editar Produto"
        description={`Editando: ${product.code}`}
        action={
          <Link
            href="/produtos"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Voltar
          </Link>
        }
      />
      <div className="max-w-lg">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
