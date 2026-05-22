"use client";
import Link from "next/link";
import { toggleProductActive } from "@/lib/actions/products";
import { useRouter } from "next/navigation";
import type { Product } from "@prisma/client";

export function ProductActions({ product }: { product: Product }) {
  const router = useRouter();

  async function handleToggle() {
    await toggleProductActive(product.id, !product.active);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/produtos/${product.id}/editar`}
        className="px-2 py-1 text-xs text-blue-600 hover:underline"
      >
        Editar
      </Link>
      <button
        onClick={handleToggle}
        className="px-2 py-1 text-xs text-gray-600 hover:underline"
      >
        {product.active ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}
