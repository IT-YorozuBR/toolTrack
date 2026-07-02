"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIgnoreManualReadings } from "@/lib/actions/stroke-readings";

export function IgnoreReadingsToggle({
  toolId,
  initialIgnored,
}: {
  toolId: string;
  initialIgnored: boolean;
}) {
  const router = useRouter();
  const [ignored, setIgnored] = useState(initialIgnored);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !ignored;
    setIgnored(next);
    setError(null);
    startTransition(async () => {
      const result = await setIgnoreManualReadings(toolId, next);
      if (!result.success) {
        setIgnored(!next); // reverte em caso de erro
        setError(result.error ?? "Erro desconhecido.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Desconsiderar leituras manuais</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {ignored
              ? "As leituras deste ferramental estão sendo ignoradas no Controle 50K (o acúmulo usa o estimado). Os dados continuam salvos."
              : "As leituras manuais deste ferramental são usadas para ancorar o acúmulo real no Controle 50K."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ignored}
          onClick={handleToggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
            ignored ? "bg-orange-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white shadow transition-transform ${
              ignored ? "translate-x-[22px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
