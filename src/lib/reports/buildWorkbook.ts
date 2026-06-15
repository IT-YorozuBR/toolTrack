import * as XLSX from "xlsx";
import type { MaintenanceStatus, ToolProjection } from "@/lib/calculations/strokes";

// Camada pura: recebe dados já buscados/calculados e devolve o Buffer do .xlsx.
// Sem Prisma e sem `next/*` para permitir teste isolado (node --test).

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OK: "OK",
  ATENCAO: "Atenção",
  PROGRAMAR_PREVENTIVA: "Programar Preventiva",
  VENCIDO: "Vencido",
  ERRO_CADASTRO: "Erro de Cadastro",
};

export type MaintenanceReportRow = {
  toolCode: string;
  maintenanceDate: Date;
  maintenanceType: string;
  strokesAtMaintenance: number;
  responsible: string | null;
  resetCounter: boolean;
  notes: string | null;
};

export type DemandReportRow = {
  toolCode: string;
  byMonth: Record<string, number>;
  total: number;
};

export type ReportInput = {
  generatedAt: Date;
  filters: {
    press?: string;
    status?: string;
    search?: string;
    simulateDate?: string;
    saldoSign?: string;
    from: Date;
    to: Date;
  };
  /** Projeções (status 50k) já filtradas e ordenadas como na tela. */
  projections: ToolProjection[];
  maintenances: MaintenanceReportRow[];
  demand: {
    months: { key: string; label: string }[];
    rows: DemandReportRow[];
  };
};

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("pt-BR");
}

function round(n: number | null): number | "" {
  if (n === null || n === undefined || !isFinite(n)) return "";
  return Math.round(n);
}

// Saldo com a convenção escolhida: padrão = restante; "excedente" inverte o sinal.
function saldoValue(remaining: number | null, excedente: boolean): number | "" {
  if (remaining === null || remaining === undefined || !isFinite(remaining)) return "";
  return Math.round(excedente ? -remaining : remaining);
}

function estimatedStatusLabel(p: ToolProjection): string {
  return STATUS_LABEL[p.status];
}

// Status efetivo: real quando há leitura, senão estimado (marcado com "(est.)").
function effectiveStatusLabel(p: ToolProjection): string {
  const base = STATUS_LABEL[p.effectiveStatus];
  return p.statusFromEstimate ? `${base} (est.)` : base;
}

// Define larguras de coluna (em "caracteres") a partir do array de larguras.
function withColWidths<T extends XLSX.WorkSheet>(ws: T, widths: number[]): T {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

function metadataRows(input: ReportInput): (string | number)[][] {
  const f = input.filters;
  const applied: string[] = [];
  if (f.press) applied.push(`Prensa: ${f.press}`);
  if (f.status) applied.push(`Status: ${f.status}`);
  if (f.search) applied.push(`Busca: ${f.search}`);
  if (f.simulateDate) applied.push(`Data simulada: ${formatDate(f.simulateDate)}`);
  const saldoConvencao =
    f.saldoSign === "excedente" ? "excedente (uso − limite)" : "restante (limite − uso)";
  return [
    ["Relatório Controle 50K"],
    [`Gerado em: ${input.generatedAt.toLocaleString("pt-BR")}`],
    [`Período (manutenções/demanda): ${formatDate(f.from)} a ${formatDate(f.to)}`],
    [`Saldo 50k: ${saldoConvencao}`],
    [`Filtros aplicados: ${applied.length ? applied.join("  |  ") : "nenhum"}`],
    [],
  ];
}

function buildStatusSheet(input: ReportInput): XLSX.WorkSheet {
  const windowLabels =
    input.projections[0]?.window.map((w) => w.label) ?? ["N-1", "N", "N+1", "N+2"];

  const header = [
    "Código",
    "Descrição",
    "Última Manut.",
    "Acúmulo Estimado",
    "Acúmulo Real",
    "Data Leitura",
    "Restante Mês",
    ...windowLabels,
    "Projetado 4 Meses",
    "Saldo 50k Estimado",
    "Saldo 50k Real",
    "Status Estimado",
    "Status Efetivo",
    "Atinge Limite",
  ];

  const excedente = input.filters.saldoSign === "excedente";
  const rows = input.projections.map((p) => [
    p.code,
    p.description ?? "",
    formatDate(p.lastMaintenanceDate),
    round(p.estimatedAccumulated),
    round(p.realCycleStrokes),
    formatDate(p.latestRealReadingDate),
    round(p.currentMonthRemainingToDo),
    ...p.window.map((m) => round(m.strokes)),
    round(p.totalProjectedStrokes),
    saldoValue(p.remainingStrokes, excedente),
    saldoValue(p.realRemainingStrokes, excedente),
    estimatedStatusLabel(p),
    effectiveStatusLabel(p),
    p.reachesLimitInMonth ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metadataRows(input), header, ...rows]);
  return withColWidths(ws, [
    16, 28, 13, 18, 13, 13, 13,
    ...windowLabels.map(() => 11),
    16, 16, 16, 18, 16, 13,
  ]);
}

function buildPreventivasSheet(input: ReportInput): XLSX.WorkSheet {
  const ACTION: MaintenanceStatus[] = ["VENCIDO", "PROGRAMAR_PREVENTIVA", "ATENCAO"];
  const ORDER: Record<string, number> = { VENCIDO: 0, PROGRAMAR_PREVENTIVA: 1, ATENCAO: 2 };

  const actionItems = input.projections
    .filter((p) => ACTION.includes(p.effectiveStatus))
    .sort((a, b) => {
      const byStatus = (ORDER[a.effectiveStatus] ?? 9) - (ORDER[b.effectiveStatus] ?? 9);
      if (byStatus !== 0) return byStatus;
      return a.remainingStrokes - b.remainingStrokes;
    });

  const header = [
    "Código",
    "Descrição",
    "Status",
    "Saldo 50k Estimado",
    "Saldo 50k Real",
    "Atinge Limite",
    "Última Manut.",
  ];

  const excedente = input.filters.saldoSign === "excedente";
  const rows = actionItems.map((p) => [
    p.code,
    p.description ?? "",
    effectiveStatusLabel(p),
    saldoValue(p.remainingStrokes, excedente),
    saldoValue(p.realRemainingStrokes, excedente),
    p.reachesLimitInMonth ?? "",
    formatDate(p.lastMaintenanceDate),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metadataRows(input), header, ...rows]);
  return withColWidths(ws, [16, 28, 20, 16, 16, 13, 13]);
}

function buildMaintenanceSheet(input: ReportInput): XLSX.WorkSheet {
  const header = [
    "Data",
    "Ferramental",
    "Tipo",
    "Batidas na Manut.",
    "Responsável",
    "Resetou Contador?",
    "Observações",
  ];

  const rows = input.maintenances.map((m) => [
    formatDate(m.maintenanceDate),
    m.toolCode,
    m.maintenanceType,
    round(m.strokesAtMaintenance),
    m.responsible ?? "",
    m.resetCounter ? "Sim" : "Não",
    m.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metadataRows(input), header, ...rows]);
  return withColWidths(ws, [12, 16, 16, 17, 18, 16, 40]);
}

function buildDemandSheet(input: ReportInput): XLSX.WorkSheet {
  const header = [
    "Ferramental",
    ...input.demand.months.map((m) => m.label),
    "Total",
  ];

  const rows = input.demand.rows.map((r) => [
    r.toolCode,
    ...input.demand.months.map((m) => round(r.byMonth[m.key] ?? 0)),
    round(r.total),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metadataRows(input), header, ...rows]);
  return withColWidths(ws, [16, ...input.demand.months.map(() => 11), 14]);
}

/** Monta o workbook completo (4 abas) e devolve o Buffer .xlsx. */
export function buildReportWorkbook(input: ReportInput): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildStatusSheet(input), "Status 50K");
  XLSX.utils.book_append_sheet(wb, buildPreventivasSheet(input), "Preventivas a Programar");
  XLSX.utils.book_append_sheet(wb, buildMaintenanceSheet(input), "Histórico Manutenções");
  XLSX.utils.book_append_sheet(wb, buildDemandSheet(input), "Demanda → Batidas");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
