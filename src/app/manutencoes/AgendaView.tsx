"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  scheduleMaintenances,
  cancelScheduledMaintenance,
  confirmScheduledMaintenance,
} from "@/lib/actions/scheduled-maintenance";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber } from "@/lib/utils";
import type { MaintenanceStatus } from "@/lib/calculations/strokes";

export type AgendaCandidate = {
  toolId: string;
  code: string;
  description: string | null;
  press: string;
  saldo: number;
  status: MaintenanceStatus;
};

export type AgendaPending = {
  id: string;
  toolId: string;
  code: string;
  description: string | null;
  press: string;
  referenceMonth: string;
  overdue: boolean;
  // Acúmulo real do ferramental ignorando o agendamento (o que seria gravado na manutenção).
  accumulated: number;
};

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthLabel(iso: string) {
  const d = new Date(iso);
  // Datas de referência são ancoradas em UTC; ler em UTC evita cair no mês anterior.
  // O valor local `${month}-15T12:00:00` (diálogo de confirmação) continua correto: dia 15 ao meio-dia.
  return `${PT_MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

type Dialog =
  | { kind: "schedule" }
  | { kind: "confirm"; item: AgendaPending }
  | { kind: "cancel"; item: AgendaPending }
  | null;

export function AgendaView({
  candidates,
  pending,
  month,
}: {
  candidates: AgendaCandidate[];
  pending: AgendaPending[];
  month: string; // YYYY-MM
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (!q || c.code.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)),
    );
  }, [candidates, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.toolId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.toolId));
      else filtered.forEach((c) => next.add(c.toolId));
      return next;
    });
  }

  function changeMonth(value: string) {
    if (value) router.push(`/manutencoes?view=agenda&month=${value}`);
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
  }

  function runSchedule() {
    setError(null);
    startTransition(async () => {
      const res = await scheduleMaintenances({ toolIds: [...selected], referenceMonth: month });
      if (!res.success) return setError(res.error ?? "Erro ao agendar.");
      setSelected(new Set());
      closeDialog();
      router.refresh();
    });
  }

  function runCancel(item: AgendaPending) {
    setError(null);
    startTransition(async () => {
      const res = await cancelScheduledMaintenance(item.id);
      if (!res.success) return setError(res.error ?? "Erro ao cancelar.");
      closeDialog();
      router.refresh();
    });
  }

  function runConfirm(item: AgendaPending, formData: FormData) {
    setError(null);
    const maintenanceDate = new Date(`${formData.get("maintenanceDate")}T12:00:00`);
    const strokesAtMaintenance = parseInt(formData.get("strokesAtMaintenance") as string);
    if (isNaN(maintenanceDate.getTime()) || isNaN(strokesAtMaintenance) || strokesAtMaintenance < 0) {
      return setError("Informe uma data e uma quantidade de batidas válidas.");
    }
    startTransition(async () => {
      const res = await confirmScheduledMaintenance(item.id, {
        maintenanceDate,
        strokesAtMaintenance,
        responsible: ((formData.get("responsible") as string) || "").trim() || undefined,
        notes: ((formData.get("notes") as string) || "").trim() || undefined,
      });
      if (!res.success) return setError(res.error ?? "Erro ao confirmar.");
      closeDialog();
      router.refresh();
    });
  }

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-8">
      {/* ── Agendadas ── */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-gray-900">
          Manutenções agendadas ({pending.length})
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Enquanto pendentes, estes ferramentais contam como se a manutenção já tivesse sido feita
          (acúmulo zerado no Controle 50K). Confirme quando a manutenção for realizada, ou cancele
          para voltar ao estado anterior.
        </p>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            Nenhuma manutenção agendada.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ferramental</th>
                  <th className="px-3 py-2 text-left font-medium">Mês agendado</th>
                  <th className="px-3 py-2 text-right font-medium">Acúmulo atual</th>
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map((p) => (
                  <tr key={p.id} className={p.overdue ? "bg-red-50" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{p.code}</p>
                      {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {monthLabel(p.referenceMonth)}
                      {p.overdue && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          ⚠ Atrasada
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(p.accumulated)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDialog({ kind: "confirm", item: p })}
                        className="mr-2 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Confirmar realizada
                      </button>
                      <button
                        onClick={() => setDialog({ kind: "cancel", item: p })}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Novo agendamento ── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Agendar preventiva</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">
            Mês
            <input
              type="month"
              value={month}
              onChange={(e) => changeMonth(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-xs text-gray-600">
            Buscar
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código ou descrição"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={selected.size === 0}
            onClick={() => setDialog({ kind: "schedule" })}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Agendar selecionadas ({selected.size})
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    aria-label="Selecionar todas as listadas"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">Ferramental</th>
                <th className="px-3 py-2 text-right font-medium">Saldo 50k atual</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr
                  key={c.toolId}
                  onClick={() => toggle(c.toolId)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected.has(c.toolId) ? "bg-orange-50" : ""}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(c.toolId)}
                      onChange={() => toggle(c.toolId)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar ${c.code}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{c.code}</p>
                    {c.description && <p className="text-xs text-gray-500">{c.description}</p>}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${c.saldo < 0 ? "text-red-600" : ""}`}>
                    {formatNumber(c.saldo)}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={c.status} size="sm" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum ferramental disponível para agendar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Diálogos ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            {dialog.kind === "schedule" && (
              <>
                <h3 className="mb-2 text-base font-semibold">Confirmar agendamento</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Agendar preventiva de <strong>{selected.size}</strong> ferramental(is) para{" "}
                  <strong>{monthLabel(`${month}-15T12:00:00`)}</strong>? Eles passarão a contar como
                  manutenção feita no Controle 50K até você confirmar ou cancelar.
                </p>
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={closeDialog} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    Voltar
                  </button>
                  <button
                    onClick={runSchedule}
                    disabled={isPending}
                    className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isPending ? "Agendando..." : "Agendar"}
                  </button>
                </div>
              </>
            )}

            {dialog.kind === "cancel" && (
              <>
                <h3 className="mb-2 text-base font-semibold">Cancelar agendamento</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Cancelar a manutenção agendada de <strong>{dialog.item.code}</strong>? O ferramental
                  volta ao estado de antes do agendamento (acúmulo e status originais).
                </p>
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={closeDialog} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    Voltar
                  </button>
                  <button
                    onClick={() => runCancel(dialog.item)}
                    disabled={isPending}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isPending ? "Cancelando..." : "Cancelar agendamento"}
                  </button>
                </div>
              </>
            )}

            {dialog.kind === "confirm" && (
              <form action={(fd) => runConfirm(dialog.item, fd)}>
                <h3 className="mb-2 text-base font-semibold">
                  Confirmar manutenção — {dialog.item.code}
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  Isto registra uma manutenção <strong>Preventiva</strong> real, zera o contador e
                  remove o agendamento.
                </p>
                <div className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    Data da manutenção
                    <input
                      type="date"
                      name="maintenanceDate"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Batidas no momento da manutenção
                    <input
                      type="number"
                      name="strokesAtMaintenance"
                      required
                      min={0}
                      defaultValue={dialog.item.accumulated}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Responsável (opcional)
                    <input type="text" name="responsible" className={`mt-1 ${inputClass}`} />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Observação (opcional)
                    <textarea name="notes" rows={2} className={`mt-1 ${inputClass}`} />
                  </label>
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeDialog} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isPending ? "Registrando..." : "Confirmar realizada"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
