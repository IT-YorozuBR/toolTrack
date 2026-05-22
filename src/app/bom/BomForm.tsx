"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBomItem } from "@/lib/actions/bom";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Product, Tool } from "@prisma/client";

export function BomForm({ products, tools }: { products: Product[]; tools: Tool[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createBomItem({
      productId: formData.get("productId") as string,
      toolId: formData.get("toolId") as string,
      quantityUsed: parseFloat(formData.get("quantityUsed") as string),
    });
    if (result.success) { router.refresh(); (document.getElementById("bom-form") as HTMLFormElement)?.reset(); }
    else setError(result.error ?? "Erro ao adicionar item.");
  }

  return (
    <form id="bom-form" action={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
        <select name="productId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Selecione...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.description}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ferramental *</label>
        <select name="toolId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Selecione...</option>
          {tools.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Usada *</label>
        <input name="quantityUsed" type="number" min="0.001" step="0.001" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1" />
      </div>
      <SubmitButton className="w-full">Adicionar ao BOM</SubmitButton>
    </form>
  );
}
