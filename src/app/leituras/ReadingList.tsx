"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";
import { deleteStrokeReading } from "@/lib/actions/stroke-readings";

type Reading = {
  id: string;
  readingDate: Date;
  cycleStrokes: number;
  notes: string | null;
};

export function ReadingList({ readings }: { readings: Reading[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm("Excluir esta leitura?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteStrokeReading(id);
      setDeletingId(null);
      router.refresh();
    });
  }

  if (readings.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
        <p className="text-gray-400 text-sm">Nenhuma leitura registrada para este ferramental.</p>
        <p className="text-gray-300 text-xs mt-1">Use o formulário ao lado para registrar a primeira.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="text-sm text-gray-500">
          {readings.length} {readings.length === 1 ? "leitura" : "leituras"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acúmulo</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observação</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {readings.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-gray-700">
                  {new Date(r.readingDate).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                  {formatNumber(r.cycleStrokes)}
                </td>
                <td className="px-5 py-4 text-gray-500 max-w-xs truncate" title={r.notes ?? undefined}>
                  {r.notes ?? "—"}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={pending && deletingId === r.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    {pending && deletingId === r.id ? "..." : "Excluir"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
