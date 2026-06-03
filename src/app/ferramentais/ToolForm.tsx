"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTool, updateTool } from "@/lib/actions/tools";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Tool } from "@prisma/client";

export function ToolForm({ tool }: { tool?: Tool }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const data = {
      code: formData.get("code") as string,
      description: formData.get("description") as string || undefined,
      press: formData.get("press") as string,
      line: formData.get("line") as string || undefined,
      shotsPerStroke: parseInt(formData.get("shotsPerStroke") as string),
      currentStrokes: parseInt(formData.get("currentStrokes") as string) || 0,
      preventiveLimit: parseInt(formData.get("preventiveLimit") as string) || 50000,
      warningLimit: parseInt(formData.get("warningLimit") as string) || 45000,
    };

    const result = tool
      ? await updateTool(tool.id, data)
      : await createTool(data);

    if (result.success) {
      router.push("/ferramentais");
      router.refresh();
    } else {
      setError(result.error ?? "Erro desconhecido.");
    }
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
          <input name="code" defaultValue={tool?.code} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 54401 V206AY" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <input name="description" defaultValue={tool?.description ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Descrição opcional" />
        </div>
        {/* Prensa e Linha ocultados da UI — mantidos no sistema via campos ocultos (preserva o valor ao editar). */}
        <input type="hidden" name="press" defaultValue={tool?.press ?? ""} />
        <input type="hidden" name="line" defaultValue={tool?.line ?? ""} />
        {/*
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prensa *</label>
          <input name="press" defaultValue={tool?.press} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 54401" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Linha</label>
          <input name="line" defaultValue={tool?.line ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: V206AY" />
        </div>
        */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade por Shot *</label>
          <input name="shotsPerStroke" type="number" min="1" defaultValue={tool?.shotsPerStroke ?? 1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Batidas Atuais</label>
          <input name="currentStrokes" type="number" min="0" defaultValue={tool?.currentStrokes ?? 0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Limite Preventivo</label>
          <input name="preventiveLimit" type="number" min="1" defaultValue={tool?.preventiveLimit ?? 50000} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Alerta</label>
          <input name="warningLimit" type="number" min="1" defaultValue={tool?.warningLimit ?? 45000} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton>{tool ? "Salvar Alterações" : "Cadastrar Ferramental"}</SubmitButton>
        <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}
