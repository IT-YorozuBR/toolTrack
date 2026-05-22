"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductionForecast } from "@/lib/actions/forecasts";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Product } from "@prisma/client";

export function VolumeForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const monthStr = formData.get("referenceMonth") as string; // "YYYY-MM"
    const [year, month] = monthStr.split("-").map(Number);
    const result = await createProductionForecast({
      productId: formData.get("productId") as string,
      referenceMonth: new Date(year, month - 1, 1),
      plannedQuantity: parseInt(formData.get("plannedQuantity") as string),
    });
    if (result.success) { router.refresh(); (document.getElementById("volume-form") as HTMLFormElement)?.reset(); }
    else setError(result.error ?? "Erro ao lançar volume.");
  }

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <form id="volume-form" action={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
        <select name="productId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Selecione...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.description}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência *</label>
        <input name="referenceMonth" type="month" defaultValue={currentMonthValue} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Volume Previsto *</label>
        <input name="plannedQuantity" type="number" min="0" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 5000" />
      </div>
      <SubmitButton className="w-full">Lançar Volume</SubmitButton>
    </form>
  );
}
