"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMaintenanceRecord } from "@/lib/actions/maintenance";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ToolCombobox } from "./ToolCombobox";

const MAINTENANCE_TYPES = ["Preventiva", "Corretiva", "Inspeção", "Ajuste"];

type DefaultTool = {
  id: string;
  code: string;
  description: string | null;
  currentStrokes: number;
};

export function MaintenanceForm({ defaultTool }: { defaultTool?: DefaultTool | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(true);
  const [selectedTool, setSelectedTool] = useState<DefaultTool | null>(defaultTool ?? null);
  const [strokes, setStrokes] = useState<string>(String(defaultTool?.currentStrokes ?? ""));

  function handleToolSelect(tool: DefaultTool | null) {
    setSelectedTool(tool);
    setStrokes(tool ? String(tool.currentStrokes) : "");
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!selectedTool) { setError("Selecione um ferramental."); return; }
    const dateStr = formData.get("maintenanceDate") as string;
    const result = await createMaintenanceRecord({
      toolId: selectedTool.id,
      maintenanceDate: new Date(dateStr + "T12:00:00"),
      strokesAtMaintenance: parseInt(formData.get("strokesAtMaintenance") as string),
      maintenanceType: formData.get("maintenanceType") as string,
      responsible: (formData.get("responsible") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      resetCounter,
    });

    if (result.success) {
      router.push("/manutencoes");
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
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ferramental *</label>
        <ToolCombobox defaultTool={defaultTool} onSelect={handleToolSelect} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data da Manutenção *
          </label>
          <input
            name="maintenanceDate"
            type="date"
            defaultValue={today}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batidas no Momento *
          </label>
          <input
            name="strokesAtMaintenance"
            type="number"
            min="0"
            value={strokes}
            onChange={(e) => setStrokes(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Manutenção *
        </label>
        <select
          name="maintenanceType"
          defaultValue="Preventiva"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MAINTENANCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
        <input
          name="responsible"
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nome do responsável"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Observações sobre a manutenção..."
        />
      </div>

      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <input
          id="resetCounter"
          type="checkbox"
          checked={resetCounter}
          onChange={(e) => setResetCounter(e.target.checked)}
          className="h-4 w-4 text-orange-600 rounded border-gray-300"
        />
        <div>
          <label htmlFor="resetCounter" className="text-sm font-medium text-gray-900 cursor-pointer">
            Zerar contador após registrar manutenção
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Ao marcar, as batidas atuais do ferramental serão reiniciadas para zero.
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton>Registrar Manutenção</SubmitButton>
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
