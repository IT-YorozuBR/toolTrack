"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Product } from "@prisma/client";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const data = {
      code: (formData.get("code") as string).trim(),
      modelo: (formData.get("modelo") as string).trim() || undefined,
      description: (formData.get("description") as string).trim() || undefined,
    };

    const result = product
      ? await updateProduct(product.id, data)
      : await createProduct(data);

    if (result.success) {
      router.push("/produtos");
      router.refresh();
    } else {
      setError(result.error ?? "Erro desconhecido.");
    }
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
          <input
            name="code"
            defaultValue={product?.code}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: PROD-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
          <input
            name="modelo"
            defaultValue={product?.modelo ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Civic 2024"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <input
            name="description"
            defaultValue={product?.description ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descrição opcional"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <SubmitButton>{product ? "Salvar Alterações" : "Cadastrar Produto"}</SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
