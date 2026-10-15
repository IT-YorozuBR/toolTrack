import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarRange } from "lucide-react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber } from "@/lib/utils";
import type { MaintenanceForecast } from "./dashboard-data";

const BUCKET_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  "7_DIAS": "≤ 7 dias",
  "30_DIAS": "≤ 30 dias",
};

function ForecastTile({
  title,
  hint,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  hint: string;
  value: number;
  icon: typeof AlertCircle;
  tone: "red" | "orange" | "slate";
}) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-900",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
      <p className="mt-0.5 text-[11px] opacity-75">{hint}</p>
    </div>
  );
}

export function MaintenanceForecastPanel({ forecast }: { forecast: MaintenanceForecast }) {
  const hasRows = forecast.rows.length > 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <ForecastTile
          title="Urgente"
          hint="Preventiva vencida ou a programar"
          value={forecast.urgent}
          icon={AlertCircle}
          tone="red"
        />
        <ForecastTile
          title="Próximos 7 dias"
          hint="Entram na zona crítica (estimativa)"
          value={forecast.next7}
          icon={CalendarClock}
          tone="orange"
        />
        <ForecastTile
          title="Próximos 30 dias"
          hint="Exigem planejamento (estimativa)"
          value={forecast.next30}
          icon={CalendarRange}
          tone="slate"
        />
      </div>

      {forecast.noEstimate > 0 && (
        <p className="text-[11px] text-slate-400">
          {formatNumber(forecast.noEstimate)} ferramental(is) cruzam o limite na janela
          projetada, mas sem ritmo suficiente para estimar os dias.
        </p>
      )}

      {hasRows ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Ferramental
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">
                  Batidas
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">
                  Saldo
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Situação
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Prazo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecast.rows.map((row) => (
                <tr key={row.toolId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/controle-50k?search=${encodeURIComponent(row.code)}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatNumber(row.strokes)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      row.saldo < 0
                        ? "text-red-600"
                        : row.saldo < 5000
                        ? "text-orange-600"
                        : "text-slate-900"
                    }`}
                  >
                    {formatNumber(row.saldo)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.bucket === "URGENTE"
                      ? BUCKET_LABEL.URGENTE
                      : row.estimatedDays !== null
                      ? `~${row.estimatedDays} d`
                      : BUCKET_LABEL[row.bucket]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Nenhum ferramental vencido ou previsto para a zona crítica nos próximos 30 dias.
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        &quot;Próximos dias&quot; é uma <strong>estimativa</strong> pelo ritmo de batidas já
        projetado (janela de 4 meses); a previsão do sistema é mensal.
      </p>
    </div>
  );
}
