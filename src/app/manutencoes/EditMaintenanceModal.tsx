"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMaintenanceRecord } from "@/lib/actions/maintenance";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  buildMaintenanceChange,
  toDateInputValue,
  type PendingChange,
} from "./buildMaintenanceChange";

const MAINTENANCE_TYPES = ["Preventiva", "Corretiva", "Inspeção", "Ajuste"];

type MaintenanceRecord = {
  id: string;
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  maintenanceType: string;
  responsible: string | null;
  resetCounter: boolean;
  notes: string | null;
};


export function EditMaintenanceModal({
  record,
  isLatest,
  onClose,
}: {
  record: MaintenanceRecord;
  isLatest: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(record.resetCounter);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ao enviar o formulário, ainda não grava nada — só monta a mudança
  // pendente e pede confirmação explícita antes de alterar em definitivo.
  function handleSubmit(formData: FormData) {
    setError(null);
    setPending(buildMaintenanceChange(record, isLatest, resetCounter, formData));
  }

  function handleConfirm() {
    if (!pending) return;
    startTransition(async () => {
      const result = await updateMaintenanceRecord(record.id, pending);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? "Erro desconhecido.");
        setPending(null);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Editar Manutenção</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {pending ? (
          <div className="space-y-4 px-6 py-5">
            <div
              className={`p-4 rounded-lg border text-sm ${
                pending.cycleFieldsChanged
                  ? "bg-orange-50 border-orange-200 text-orange-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}
            >
              <p className="font-medium mb-1">
                {pending.cycleFieldsChanged
                  ? "Confirmar alteração definitiva do ciclo desta manutenção?"
                  : "Confirmar alteração desta manutenção?"}
              </p>
              <p className="text-xs">
                {pending.cycleFieldsChanged ? (
                  <>
                    Você alterou a data, as batidas e/ou o "zerar contador" desta manutenção.
                    Ao confirmar, o contador atual do ferramental e os snapshots mensais do
                    ciclo serão recalculados a partir dos novos valores, substituindo em
                    definitivo o cálculo anterior. Essa ação não tem desfazer automático.
                  </>
                ) : (
                  <>
                    Os dados desta manutenção serão atualizados em definitivo. Como você não
                    alterou data, batidas ou contador, isso não afeta o cálculo do ferramental.
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {isPending ? "Salvando…" : "Confirmar alteração"}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Voltar e revisar
              </button>
            </div>
          </div>
        ) : (
        <form action={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {!isLatest && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Esta não é a manutenção mais recente do ferramental. Data, batidas e contador
              não podem ser alterados aqui — apenas tipo, responsável e observação.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Manutenção *
              </label>
              <input
                name="maintenanceDate"
                type="date"
                defaultValue={toDateInputValue(record.maintenanceDate)}
                required
                disabled={!isLatest}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
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
                defaultValue={record.strokesAtMaintenance}
                required
                disabled={!isLatest}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Manutenção *
            </label>
            <select
              name="maintenanceType"
              defaultValue={record.maintenanceType}
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
              defaultValue={record.responsible ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={record.notes ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Observações sobre a manutenção..."
            />
          </div>

          {isLatest && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <input
                id="resetCounter"
                type="checkbox"
                checked={resetCounter}
                onChange={(e) => setResetCounter(e.target.checked)}
                className="h-4 w-4 text-orange-600 rounded border-gray-300"
              />
              <div>
                <label
                  htmlFor="resetCounter"
                  className="text-sm font-medium text-gray-900 cursor-pointer"
                >
                  Zerar contador após esta manutenção
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ao marcar, as batidas atuais do ferramental serão reiniciadas para zero.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <SubmitButton>Salvar Alterações</SubmitButton>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
