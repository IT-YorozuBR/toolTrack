"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStrokeReading } from "@/lib/actions/stroke-readings";
import { SubmitButton } from "@/components/ui/SubmitButton";

type DefaultTool = {
  id: string;
  code: string;
  description: string | null;
  currentStrokes: number;
};

export function ReadingForm({ defaultTool }: { defaultTool: DefaultTool }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const dateStr = formData.get("readingDate") as string;
    const cycleStrokes = parseInt(formData.get("cycleStrokes") as string, 10);
    if (!dateStr) { setError("Informe a data da leitura."); return; }
    if (!Number.isFinite(cycleStrokes) || cycleStrokes < 0) { setError("Informe um acúmulo de batidas válido."); return; }

    const result = await createStrokeReading({
      toolId: defaultTool.id,
      readingDate: new Date(dateStr + "T12:00:00"),
      cycleStrokes,
      notes: (formData.get("notes") as string) || undefined,
    });

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "Erro desconhecido.");
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form
      action={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Registrar leitura</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Acúmulo do contador no ciclo atual (zera a cada manutenção com reset).
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data da Leitura *</label>
          <input
            name="readingDate"
            type="date"
            defaultValue={today}
            max={today}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Acúmulo de Batidas *</label>
          <input
            name="cycleStrokes"
            type="number"
            min="0"
            required
            placeholder="Ex.: 30000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Observações sobre a leitura..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton>Registrar Leitura</SubmitButton>
      </div>
    </form>
  );
}
