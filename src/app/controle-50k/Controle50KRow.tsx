"use client";

import { useState } from "react";
import type { ToolProjection } from "@/lib/calculations/strokes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber } from "@/lib/utils";
import { RegisterMaintenanceButton } from "./RegisterMaintenanceButton";
import { ToolBreakdown } from "./ToolBreakdown";

type WindowDate = { key: string; label: string; planningLabel: string; offset: number };

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

// Detalha de quais produtos vieram as batidas previstas de um mês.
function monthBreakdownText(p: ToolProjection, monthKey: string): string {
  const parts = p.productBreakdown
    .map((b) => ({ code: b.productCode, strokes: Math.round(b.strokesByMonth[monthKey] ?? 0) }))
    .filter((x) => x.strokes > 0);
  if (parts.length === 0) return "Sem previsão de volume para este mês.";
  const sum = parts.map((x) => `${x.code}: ${formatNumber(x.strokes)}`).join("  +  ");
  const total = formatNumber(parts.reduce((s, x) => s + x.strokes, 0));
  return parts.length > 1 ? `${sum}  =  ${total}` : sum;
}

export function Controle50KRow({
  p,
  windowDates,
  isRealView,
  saldoExcedente,
}: {
  p: ToolProjection;
  windowDates: WindowDate[];
  isRealView: boolean;
  saldoExcedente: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const status = isRealView ? p.effectiveStatus : p.status;
  const showSaldo = (remaining: number) => Math.round(saldoExcedente ? -remaining : remaining);
  const limit = formatNumber(p.preventiveLimit);
  const accum = Math.round(p.estimatedAccumulated);
  const futureWindow = Math.round(
    p.window.filter((m) => m.offset > 0).reduce((s, m) => s + m.strokes, 0),
  );
  const hasCycle = p.lastMaintenanceDate !== null || p.realCycleStrokes !== null;
  const projetadoTitle = hasCycle
    ? `Projeção do ciclo até o fim da janela:\nacúmulo atual (${formatNumber(accum)}) + falta no mês (${formatNumber(p.currentMonthRemainingToDo)}) + meses futuros N+1..N+2 (${formatNumber(futureWindow)}) = ${formatNumber(Math.round(p.totalProjectedStrokes))}.`
    : `Acúmulo atual (${formatNumber(accum)}) + previsão da janela de 4 meses (${formatNumber(Math.round(p.forecastedStrokes))}) = ${formatNumber(Math.round(p.totalProjectedStrokes))}.`;

  return (
    <>
      <tr
        className={`hover:bg-gray-50 ${
          status === "VENCIDO"
            ? "bg-red-50"
            : status === "PROGRAMAR_PREVENTIVA"
            ? "bg-orange-50"
            : status === "ATENCAO"
            ? "bg-yellow-50"
            : ""
        }`}
      >
        <td className="px-3 py-2">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label={expanded ? "Recolher" : "Expandir produtos e projetos"}
              title={expanded ? "Recolher" : "Ver produtos e projetos que usam este ferramental"}
            >
              {expanded ? "▼" : "▶"}
            </button>
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{p.code}</p>
              {p.description && (
                <p className="mt-0.5 truncate text-[10px] text-gray-500" title={p.description}>
                  {p.description}
                </p>
              )}
              {p.errors.length > 0 && (
                <p className="mt-0.5 truncate text-[10px] text-red-600">⚠ {p.errors[0]}</p>
              )}
            </div>
          </div>
        </td>
        <td
          className="px-3 py-2 text-[10px] text-gray-600"
          title={
            p.lastMaintenanceDate
              ? `Início do ciclo atual: última manutenção com reset do contador em ${formatDate(p.lastMaintenanceDate)}. Nada anterior a essa data conta para as 50k.`
              : "Sem manutenção com reset registrada — o ciclo conta desde o início dos dados / batidas atuais cadastradas."
          }
        >
          {formatDate(p.lastMaintenanceDate)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <span
            className="inline-flex items-center justify-end gap-1 font-medium text-purple-600"
            title={
              p.realCycleStrokes !== null
                ? `Acúmulo Estimado (ancorado na leitura real):\nleitura ${formatNumber(p.realCycleStrokes)} (em ${formatDate(p.latestRealReadingDate)}) + ${formatNumber(accum - p.realCycleStrokes)} estimado pelos dias decorridos = ${formatNumber(accum)} batidas no ciclo.`
                : `Acúmulo Estimado desde a última manutenção (sem leitura física neste ciclo).\nFórmula: meses fechados (volume × qtd no BOM ÷ batidas por golpe) + parte já decorrida do mês atual rateada por dias = ${formatNumber(accum)} batidas.`
            }
          >
            {p.cycleRecentlyReset && (
              <span
                className="rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-indigo-300"
                title={`Ciclo reiniciado há ${p.daysSinceReset} dia(s) — acúmulo parcial do novo ciclo (conta poucos dias).`}
              >
                🔧
              </span>
            )}
            <span>{formatNumber(accum)}</span>
          </span>
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums ${
            p.realCycleStrokes !== null ? "font-medium text-blue-600" : "text-gray-400"
          }`}
          title={
            p.realCycleStrokes !== null
              ? `Leitura física crua do contador no ciclo: ${formatNumber(p.realCycleStrokes)} batidas em ${formatDate(p.latestRealReadingDate)}${
                  p.daysSinceLastReading !== null ? ` (há ${p.daysSinceLastReading} dia(s))` : ""
                }.\nSaldo Real = ${limit} − ${formatNumber(p.realCycleStrokes)} = ${formatNumber(p.preventiveLimit - p.realCycleStrokes)}.`
              : "Sem leitura física registrada neste ciclo. Registre uma leitura na página Leituras para ancorar o acúmulo real."
          }
        >
          <div className="flex items-center justify-end gap-1">
            {p.readingStale && (
              <span
                className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-300"
                title={`Leitura defasada: ${p.daysSinceLastReading} dias sem nova medição. O acúmulo real pode estar subcontando — registre uma nova leitura.`}
              >
                ⚠ {p.daysSinceLastReading}d
              </span>
            )}
            <span>{p.realCycleStrokes !== null ? formatNumber(p.realCycleStrokes) : "—"}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
          <span
            title={`Batidas que ainda faltam produzir no mês corrente.\nPrevisão do mês (${formatNumber(Math.round(p.currentMonthForecastedStrokes))}) − já decorrido desde o dia 1 rateado por dias (${formatNumber(Math.round(Math.max(0, p.currentMonthForecastedStrokes - p.currentMonthRemainingToDo)))}) = ${formatNumber(p.currentMonthRemainingToDo)}.${
              p.hasMaintenanceInReferenceMonth ? "\n(Há manutenção neste mês: o ciclo novo começou no meio do mês.)" : ""
            }`}
          >
            {formatNumber(p.currentMonthRemainingToDo)}
          </span>
        </td>
        {p.window.map((m) => (
          <td
            key={m.key}
            className={`px-3 py-2 text-right tabular-nums ${m.offset === 0 ? "font-medium text-blue-700" : "text-gray-700"}`}
            title={`Batidas previstas em ${m.label} = Σ(volume previsto × qtd no BOM ÷ batidas por golpe) dos produtos:\n${monthBreakdownText(p, m.key)}`}
          >
            {m.strokes > 0 ? formatNumber(Math.round(m.strokes)) : "—"}
          </td>
        ))}
        <td className="px-3 py-2 text-right tabular-nums font-semibold" title={projetadoTitle}>
          {formatNumber(Math.round(p.totalProjectedStrokes))}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums font-semibold ${
            p.remainingStrokes < 0
              ? "text-red-600"
              : p.remainingStrokes < 5000
              ? "text-orange-600"
              : "text-gray-900"
          }`}
          title={`Saldo projetado ao fim da janela de 4 meses.\n${limit} (limite) − Projetado 4 Meses (${formatNumber(Math.round(p.totalProjectedStrokes))}) = ${formatNumber(Math.round(p.remainingStrokes))} batidas restantes.${
            saldoExcedente ? "\n(Exibido como excedente: sinal invertido.)" : ""
          }`}
        >
          {formatNumber(showSaldo(p.remainingStrokes))}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums font-semibold ${
            p.currentRemainingStrokes < 0
              ? "text-red-600"
              : p.currentRemainingStrokes < 5000
              ? "text-orange-600"
              : "text-gray-900"
          }`}
          title={`Saldo de hoje, sem projetar meses futuros.\n${limit} (limite) − Acúmulo Estimado atual (${formatNumber(accum)}) = ${formatNumber(Math.round(p.currentRemainingStrokes))} batidas restantes.${
            saldoExcedente ? "\n(Exibido como excedente: sinal invertido.)" : ""
          }`}
        >
          {formatNumber(showSaldo(p.currentRemainingStrokes))}
        </td>
        <td
          className="px-3 py-2"
          title={`Status ${isRealView ? "Real" : "Estimado"}${
            isRealView && p.statusFromEstimate ? " (sem leitura real — caiu para o estimado)" : ""
          }.\nFaixas: OK < ${formatNumber(p.warningLimit - 5000)} · ATENÇÃO ${formatNumber(p.warningLimit - 5000)}–${formatNumber(p.warningLimit - 1)} · PROGRAMAR ${formatNumber(p.warningLimit)}–${formatNumber(p.preventiveLimit - 1)} · VENCIDO ≥ ${limit}.`}
        >
          <div className="flex items-center gap-1">
            <StatusBadge status={status} size="sm" />
            {isRealView && p.statusFromEstimate && (
              <span
                className="text-[9px] font-medium text-gray-400"
                title="Sem leitura real neste ciclo — status estimado pela previsão"
              >
                est.
              </span>
            )}
          </div>
        </td>
        <td
          className="px-3 py-2 text-[10px] text-gray-600"
          title={
            p.reachesLimitInMonth
              ? `Mês projetado em que o acúmulo alcança o limite de ${limit} batidas, somando mês a mês a previsão a partir do acúmulo atual (${formatNumber(accum)}).`
              : `Nos próximos 24 meses a projeção não alcança o limite de ${limit} batidas.`
          }
        >
          {p.reachesLimitInMonth ?? "—"}
        </td>
        <td className="px-3 py-2">
          {(status === "PROGRAMAR_PREVENTIVA" || status === "VENCIDO") && (
            <RegisterMaintenanceButton toolId={p.toolId} toolCode={p.code} />
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={15} className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <p className="mb-2 text-[10px] font-medium uppercase text-gray-500">
              Produtos e projetos que usam {p.code}
            </p>
            <ToolBreakdown
              breakdown={p.productBreakdown}
              windowDates={windowDates.map((w) => ({ key: w.key, label: w.label }))}
            />
          </td>
        </tr>
      )}
    </>
  );
}
