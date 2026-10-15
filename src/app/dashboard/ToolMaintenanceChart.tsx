"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, RefreshCw, TriangleAlert, Wrench, X } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/utils";
import type {
  ToolMaintenanceHistory,
  ToolMaintenanceOption,
  ToolMaintenancePoint,
} from "./dashboard-data";

const TOOL_PARAM = "mtool";
const CHART_HEIGHT = 300;
const X_AXIS_HEIGHT = 48;
const Y_TICKS = [0, 15000, 30000, 45000, 50000];

const PREVENTIVE_COLOR = "#2563eb";
const CORRECTIVE_COLOR = "#dc2626";
const WARNING_COLOR = "#f59e0b";

/** Largura observada de um elemento (para os gráficos Recharts ocuparem a largura
 * real do card e não um valor fixo). Retorna 0 até a primeira medição. */
function useMeasuredWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    setWidth(node.clientWidth);
    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, width];
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ToolMaintenanceChart({
  options,
  history,
  selectedToolId,
}: {
  options: ToolMaintenanceOption[];
  history: ToolMaintenanceHistory | null;
  selectedToolId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectTool(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(TOOL_PARAM, value);
    else params.delete(TOOL_PARAM);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Ciclo de manutenção
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Evolução das batidas acumuladas e dos intervalos entre manutenções.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <select
            aria-label="Escolher ferramental"
            className="max-w-[18rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedToolId ?? ""}
            onChange={(event) => selectTool(event.target.value)}
          >
            <option value="">Selecione um ferramental…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code}
                {" "}({option.count})
              </option>
            ))}
          </select>
          {selectedToolId && (
            <button
              type="button"
              onClick={() => selectTool("")}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {options.length === 0 ? (
        <EmptyState>Nenhum ferramental com manutenção registrada ainda.</EmptyState>
      ) : !history ? (
        <EmptyState>Selecione um ferramental no menu acima para ver o gráfico.</EmptyState>
      ) : history.points.length === 0 ? (
        <EmptyState>{history.code} ainda não tem manutenções registradas.</EmptyState>
      ) : (
        <HistoryBody history={history} />
      )}
    </div>
  );
}

const Y_AXIS_WIDTH = 44;
const MIN_POINT_SPACING = 64;

function HistoryBody({ history }: { history: ToolMaintenanceHistory }) {
  const points = history.points;
  const [wrapRef, wrapWidth] = useMeasuredWidth<HTMLDivElement>();

  // O gráfico ocupa a largura real do card; só passa disso (e gera scroll
  // horizontal) quando há pontos demais para caber com espaçamento legível.
  const minPlotWidth = points.length * MIN_POINT_SPACING;
  const plotWidth =
    wrapWidth > 0 ? Math.max(wrapWidth - Y_AXIS_WIDTH, minPlotWidth) : Math.max(600, minPlotWidth);
  const intervalWidth =
    wrapWidth > 0 ? Math.max(wrapWidth, minPlotWidth) : Math.max(560, minPlotWidth);

  const utilizationPct =
    history.avgCycleUtilization !== null
      ? Math.round(history.avgCycleUtilization * 1000) / 10
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="text-sm font-semibold text-slate-800">{history.code}</span>
        {history.description && <span>— {history.description}</span>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Manutenções" value={formatNumber(history.totalMaintenances)} />
        <Kpi
          label="Intervalo médio"
          value={history.avgIntervalDays !== null ? `${history.avgIntervalDays} d` : "—"}
        />
        <Kpi
          label="Maior ciclo"
          value={
            history.maxCycleStrokes !== null ? formatNumber(history.maxCycleStrokes) : "—"
          }
        />
        <Kpi
          label="Menor ciclo"
          value={
            history.minCycleStrokes !== null ? formatNumber(history.minCycleStrokes) : "—"
          }
        />
        <Kpi
          label="Corretivas"
          value={formatNumber(history.correctiveCount)}
          tone={history.correctiveCount > 0 ? "warn" : "default"}
        />
      </dl>

      {utilizationPct !== null && history.avgCycleStrokes !== null && (
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium uppercase tracking-wide text-slate-500">
              Utilização média do ciclo
            </span>
            <span className="tabular-nums text-slate-600">
              {formatNumber(history.avgCycleStrokes)} / {formatNumber(history.preventiveLimit)} ·{" "}
              <strong className="text-slate-900">
                {utilizationPct.toLocaleString("pt-BR")}%
              </strong>
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={utilizationPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={
                utilizationPct >= 90
                  ? "h-full rounded-full bg-red-500"
                  : utilizationPct >= 70
                  ? "h-full rounded-full bg-emerald-500"
                  : "h-full rounded-full bg-amber-400"
              }
              style={{ width: `${Math.min(100, utilizationPct)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Média de batidas nas manutenções ÷ limite preventivo. Abaixo de ~70% pode
            indicar manutenção antecipada demais.
          </p>
        </div>
      )}

      {/* Gráfico principal: escala vertical FIXA 0–50.000, com as linhas de 45k e 50k. */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Batidas acumuladas por manutenção
        </p>
        <div ref={wrapRef} className="flex">
          <LineChart
            width={Y_AXIS_WIDTH}
            height={CHART_HEIGHT}
            data={points}
            margin={{ top: 8, right: 0, bottom: X_AXIS_HEIGHT, left: 0 }}
          >
            <YAxis
              domain={[0, 50000]}
              ticks={Y_TICKS}
              tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Line dataKey="strokes" stroke="transparent" dot={false} isAnimationActive={false} />
          </LineChart>

          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            <ComposedChart
              width={plotWidth}
              height={CHART_HEIGHT}
              data={points}
              margin={{ top: 8, right: 28, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                interval={0}
                height={X_AXIS_HEIGHT}
                angle={-40}
                textAnchor="end"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis domain={[0, 50000]} ticks={Y_TICKS} hide />
              <ReferenceLine
                y={history.warningLimit}
                stroke={WARNING_COLOR}
                strokeDasharray="5 4"
                label={{
                  value: `${formatNumber(history.warningLimit)} atenção`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#b45309",
                }}
              />
              <ReferenceLine
                y={history.preventiveLimit}
                stroke={CORRECTIVE_COLOR}
                strokeDasharray="5 4"
                label={{
                  value: `${formatNumber(history.preventiveLimit)} preventivo`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#b91c1c",
                }}
              />
              <Tooltip
                cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                content={<HistoryTooltip />}
              />
              <Line
                type="linear"
                dataKey="strokes"
                stroke={PREVENTIVE_COLOR}
                strokeWidth={2}
                isAnimationActive={false}
                dot={<MaintenanceDot />}
                activeDot={false}
              >
                <LabelList
                  dataKey="strokes"
                  position="top"
                  offset={10}
                  fontSize={9}
                  fill="#475569"
                  formatter={(value) => formatNumber(Number(value))}
                />
              </Line>
            </ComposedChart>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PREVENTIVE_COLOR }} />
            Preventiva
          </span>
          <span className="flex items-center gap-1.5">
            <RotatedSquare color={CORRECTIVE_COLOR} />
            Corretiva
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-slate-500" />
            Contador zerado (reset)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: WARNING_COLOR }} />
            {formatNumber(history.warningLimit)} atenção
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: CORRECTIVE_COLOR }}
            />
            {formatNumber(history.preventiveLimit)} preventivo
          </span>
        </div>
      </div>

      {/* Intervalo entre manutenções */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Intervalo entre manutenções (dias)
        </p>
        {points.length < 2 ? (
          <p className="text-xs text-slate-400">
            Só há uma manutenção registrada — sem intervalo para comparar.
          </p>
        ) : (
          <>
            <div className="h-40 overflow-x-auto overflow-y-hidden">
              <LineChart
                width={intervalWidth}
                height={150}
                data={points}
                margin={{ top: 8, right: 28, bottom: 24, left: 8 }}
              >
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={40}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<IntervalTooltip />} />
                <Line
                  type="linear"
                  dataKey="daysSincePrevious"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: "#7c3aed" }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="daysSincePrevious"
                    position="top"
                    fontSize={9}
                    fill="#7c3aed"
                    formatter={(value) =>
                      value === null || value === undefined || value === ""
                        ? ""
                        : `${value}d`
                    }
                  />
                </Line>
              </LineChart>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              A primeira manutenção não tem intervalo anterior.
            </p>
          </>
        )}
      </div>

      <HistoryTable points={points} />

      <div className="flex justify-end">
        <Link
          href={`/manutencoes?ferramenta=${history.toolId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Wrench className="h-3.5 w-3.5" />
          Abrir histórico completo
        </Link>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          tone === "warn" ? "text-amber-800" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function RotatedSquare({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rotate-45"
      style={{ background: color }}
      aria-hidden
    />
  );
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ToolMaintenancePoint;
};

function MaintenanceDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const corretiva = payload.type === "Corretiva";
  const color = corretiva ? CORRECTIVE_COLOR : PREVENTIVE_COLOR;

  return (
    <g>
      {payload.resetCounter && (
        <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={color} strokeWidth={1.5} />
      )}
      {corretiva ? (
        <rect
          x={cx - 3.5}
          y={cy - 3.5}
          width={7}
          height={7}
          fill={color}
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ) : (
        <circle cx={cx} cy={cy} r={3.5} fill={color} />
      )}
    </g>
  );
}

function HistoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ToolMaintenancePoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{formatFullDate(point.date)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-slate-600">
        {point.type === "Corretiva" ? (
          <TriangleAlert className="h-3 w-3 text-red-500" />
        ) : (
          <Wrench className="h-3 w-3 text-blue-500" />
        )}
        {point.type}
      </p>
      <p className="text-slate-600">
        <strong className="text-slate-900">{formatNumber(point.strokes)}</strong> batidas
      </p>
      <p className="text-slate-600">
        {point.daysSincePrevious !== null
          ? `${point.daysSincePrevious} dias desde a anterior`
          : "Primeira manutenção"}
      </p>
      <p className="text-slate-600">Responsável: {point.responsible ?? "—"}</p>
      <p className="text-slate-500">Reset: {point.resetCounter ? "Sim" : "Não"}</p>
    </div>
  );
}

function IntervalTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ToolMaintenancePoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{formatFullDate(point.date)}</p>
      <p className="mt-1 text-slate-600">
        {point.daysSincePrevious !== null
          ? `${point.daysSincePrevious} dias desde a manutenção anterior`
          : "Sem manutenção anterior"}
      </p>
    </div>
  );
}

function HistoryTable({ points }: { points: ToolMaintenancePoint[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Data</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
              Manutenção
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">
              Batidas
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">
              Intervalo
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
              Responsável
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...points].reverse().map((point) => (
            <tr key={point.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{point.label}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      point.type === "Corretiva"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : point.type === "Preventiva"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {point.type === "Corretiva" && <TriangleAlert className="mr-1 h-3 w-3" />}
                    {point.type}
                  </span>
                  {point.resetCounter && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500"
                      title="Contador zerado nesta manutenção"
                    >
                      <RefreshCw className="h-3 w-3" />
                      reset
                    </span>
                  )}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                {formatNumber(point.strokes)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                {point.daysSincePrevious !== null ? `${point.daysSincePrevious} d` : "—"}
              </td>
              <td className="px-3 py-2 text-slate-600">{point.responsible ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
