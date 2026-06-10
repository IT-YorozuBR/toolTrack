"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMaintenanceRecord } from "@/lib/actions/maintenance";

export function DeleteMaintenanceButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMaintenanceRecord(id);
      if (result.success) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error ?? "Erro ao excluir.");
        setConfirming(false);
      }
    });
  }

  if (error) {
    return (
      <span className="text-xs text-red-600" title={error}>
        {error}
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Excluindo…" : "Confirmar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Reverte o contador e o status do ferramental ao estado anterior a esta manutenção."
      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
    >
      Excluir
    </button>
  );
}
