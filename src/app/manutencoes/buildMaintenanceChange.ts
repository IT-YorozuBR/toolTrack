export type MaintenanceChangeRecord = {
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  resetCounter: boolean;
};

export type PendingChange = {
  maintenanceDate: Date;
  strokesAtMaintenance: number;
  maintenanceType: string;
  responsible?: string;
  notes?: string;
  resetCounter: boolean;
  cycleFieldsChanged: boolean;
};

export function toDateInputValue(date: Date) {
  return new Date(date).toISOString().split("T")[0];
}

// Monta a mudança pendente a partir do FormData do modal de edição.
// Inputs desabilitados (manutenção não mais recente) não vão no FormData;
// nesse caso reenvia os valores originais para não alterar o ciclo.
// Data inalterada (mesmo dia) também mantém o timestamp original exato.
export function buildMaintenanceChange(
  record: MaintenanceChangeRecord,
  isLatest: boolean,
  resetCounter: boolean,
  formData: FormData,
): PendingChange {
  const dateStr = formData.get("maintenanceDate") as string | null;
  const maintenanceDate =
    !isLatest || !dateStr || dateStr === toDateInputValue(record.maintenanceDate)
      ? record.maintenanceDate
      : new Date(dateStr + "T12:00:00");
  const strokesRaw = formData.get("strokesAtMaintenance") as string | null;
  const strokesAtMaintenance =
    !isLatest || strokesRaw === null || strokesRaw === ""
      ? record.strokesAtMaintenance
      : parseInt(strokesRaw);
  const nextResetCounter = isLatest ? resetCounter : record.resetCounter;

  const cycleFieldsChanged =
    record.maintenanceDate.getTime() !== maintenanceDate.getTime() ||
    record.strokesAtMaintenance !== strokesAtMaintenance ||
    record.resetCounter !== nextResetCounter;

  return {
    maintenanceDate,
    strokesAtMaintenance,
    maintenanceType: formData.get("maintenanceType") as string,
    responsible: (formData.get("responsible") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    resetCounter: nextResetCounter,
    cycleFieldsChanged,
  };
}
