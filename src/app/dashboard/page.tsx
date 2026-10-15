import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  TriangleAlert,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HorizontalBars, type HorizontalBarItem } from "@/components/charts/HorizontalBars";
import { MaintenanceTrendChart } from "@/components/charts/MaintenanceTrendChart";
import { formatNumber } from "@/lib/utils";
import type { MaintenanceStatus, ToolProjection } from "@/lib/calculations/strokes";
import {
  getDashboardData,
  getMaintenanceMonthlyTrend,
  getToolMaintenanceHistory,
  getToolMaintenanceOptions,
  type QualityIssue,
  type SaldoBucket,
  type StatusSlice,
} from "./dashboard-data";
import { DashboardFilters } from "./DashboardFilters";
import { MaintenanceForecastPanel } from "./MaintenanceForecastPanel";
import { ToolMaintenanceChart } from "./ToolMaintenanceChart";

export const dynamic = "force-dynamic";

const ACTION_STATUS: MaintenanceStatus[] = [
  "VENCIDO",
  "PROGRAMAR_PREVENTIVA",
  "ATENCAO",
];

// Ordem operacional para a lista de status (mais crítico primeiro).
const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  VENCIDO: 0,
  ATENCAO: 1,
  PROGRAMAR_PREVENTIVA: 2,
  ERRO_CADASTRO: 3,
  OK: 4,
};

const SALDO_COLORS: Record<string, string> = {
  Vencido: "#dc2626",
  "< 5k": "#ea580c",
  "5–15k": "#f59e0b",
  "15–30k": "#3b82f6",
  "≥ 30k": "#16a34a",
};

const issueToneStyles: Record<QualityIssue["tone"], string> = {
  red: "border-red-200 bg-red-50 text-red-900",
  orange: "border-orange-200 bg-orange-50 text-orange-900",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
};

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function pctOf(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${(Math.round((value / total) * 1000) / 10).toLocaleString("pt-BR")}%`;
}

function priorityHref(status: MaintenanceStatus) {
  return `/controle-50k?status=${status}`;
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function ChartCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** KPI principal. `emphasis` deixa o card de Vencidos com mais peso visual. */
function KpiCard({
  title,
  value,
  total,
  hint,
  href,
  cta,
  icon: Icon,
  tone,
  emphasis = false,
}: {
  title: string;
  value: number;
  total: number;
  hint?: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  tone: "red" | "amber" | "orange" | "green";
  emphasis?: boolean;
}) {
  const tones = {
    red: "border-red-300 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-lg border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        tones[tone]
      } ${emphasis ? "p-5 ring-1 ring-red-200 sm:col-span-2 lg:col-span-1" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
        <Icon className={emphasis ? "h-6 w-6" : "h-5 w-5"} />
      </div>
      <div className="mt-2">
        <p className={`font-bold tabular-nums ${emphasis ? "text-5xl" : "text-4xl"}`}>
          {formatNumber(value)}
        </p>
        <p className="mt-1 text-xs opacity-80">
          {pctOf(value, total)} da frota{hint ? ` · ${hint}` : ""}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-medium opacity-90">
        <span>{cta}</span>
        <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ActionTable({ items }: { items: ToolProjection[] }) {
  if (items.length === 0) {
    return (
      <EmptyPanel>Nenhum ferramental vencido, em preventiva ou em atenção no momento.</EmptyPanel>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Ferramental
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                Batidas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                Saldo atual
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Atinge
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const strokes = Math.round(item.preventiveLimit - item.currentRemainingStrokes);
              return (
                <tr key={item.toolId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.code}</p>
                    {item.description && (
                      <p
                        className="mt-0.5 max-w-56 truncate text-xs text-slate-500"
                        title={item.description}
                      >
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatNumber(strokes)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      item.currentRemainingStrokes < 0
                        ? "text-red-600"
                        : item.currentRemainingStrokes < 5000
                        ? "text-orange-600"
                        : "text-slate-900"
                    }`}
                  >
                    {formatNumber(Math.round(item.currentRemainingStrokes))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.effectiveStatus} />
                    {item.statusFromEstimate && (
                      <span className="ml-1 align-middle text-[10px] font-medium text-slate-400">
                        est.
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.reachesLimitInMonth ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {ACTION_STATUS.includes(item.effectiveStatus) && (
                        <Link
                          href={`/manutencoes/nova?toolId=${item.toolId}`}
                          className="rounded-md bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
                        >
                          Registrar manutenção
                        </Link>
                      )}
                      <Link
                        href={`/controle-50k?search=${encodeURIComponent(item.code)}`}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ver 50K
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadingHealth({
  staleReadings,
  missingReadings,
  staleReadingCount,
}: {
  staleReadings: ToolProjection[];
  missingReadings: number;
  staleReadingCount: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Link href="/leituras" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Sem leitura real no ciclo
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatNumber(missingReadings)}</p>
          <p className="mt-2 text-xs opacity-75">Status usando estimativa como fallback.</p>
        </Link>
        <Link href="/leituras" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Leituras defasadas
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatNumber(staleReadingCount)}</p>
          <p className="mt-2 text-xs opacity-75">Mais de 30 dias sem nova medição.</p>
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Leituras mais antigas</p>
        </div>
        {staleReadings.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma leitura defasada encontrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staleReadings.map((item) => (
              <Link
                key={item.toolId}
                href={`/leituras?ferramenta=${item.toolId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.code}</p>
                  <p className="text-xs text-slate-500">
                    Última leitura em {formatDate(item.latestRealReadingDate)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {item.daysSinceLastReading} dias
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityIssues({ issues }: { issues: QualityIssue[] }) {
  if (issues.length === 0) {
    return <EmptyPanel>Nenhum problema relevante de cadastro ou projeção encontrado.</EmptyPanel>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {issues.map((issue) => (
        <Link
          key={issue.key}
          href={issue.href}
          className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${issueToneStyles[issue.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{issue.title}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(issue.count)}</p>
            </div>
            <Database className="h-5 w-5 opacity-70" />
          </div>
          <p className="mt-2 text-xs opacity-75">{issue.description}</p>
        </Link>
      ))}
    </div>
  );
}

function RecentMaintenances({
  maintenances,
}: {
  maintenances: {
    id: string;
    toolCode: string;
    toolPress: string;
    maintenanceDate: Date;
    maintenanceType: string;
    resetCounter: boolean;
    responsible: string | null;
  }[];
}) {
  if (maintenances.length === 0) {
    return <EmptyPanel>Nenhuma manutenção registrada neste mês.</EmptyPanel>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {maintenances.map((maintenance) => (
          <Link
            key={maintenance.id}
            href="/manutencoes"
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900">{maintenance.toolCode}</p>
              <p className="text-xs text-slate-500">
                {maintenance.toolPress} · {maintenance.maintenanceType}
                {maintenance.responsible ? ` · ${maintenance.responsible}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-700">{formatDate(maintenance.maintenanceDate)}</p>
              <p className="text-xs text-slate-400">
                {maintenance.resetCounter ? "com reset" : "sem reset"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MonthMaintenanceCard({
  total,
  byType,
  previous,
}: {
  total: number;
  byType: { preventiva: number; corretiva: number; outras: number };
  previous: number;
}) {
  const delta = total - previous;
  const deltaLabel =
    delta === 0 ? "igual ao mês anterior" : `${delta > 0 ? "+" : ""}${delta} vs. mês anterior`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Manutenções no mês
      </p>
      <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900">{formatNumber(total)}</p>
      <p className="mt-1 text-xs text-slate-400">{deltaLabel}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-blue-200 bg-blue-50 py-2">
          <dt className="text-[10px] font-medium uppercase text-blue-700">Preventivas</dt>
          <dd className="text-lg font-bold tabular-nums text-blue-900">{byType.preventiva}</dd>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 py-2">
          <dt className="text-[10px] font-medium uppercase text-red-700">Corretivas</dt>
          <dd className="text-lg font-bold tabular-nums text-red-900">{byType.corretiva}</dd>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 py-2">
          <dt className="text-[10px] font-medium uppercase text-slate-500">Outras</dt>
          <dd className="text-lg font-bold tabular-nums text-slate-700">{byType.outras}</dd>
        </div>
      </dl>
    </div>
  );
}

function toSaldoBars(buckets: SaldoBucket[]): HorizontalBarItem[] {
  return buckets.map((bucket) => ({
    key: bucket.label,
    label: bucket.label,
    value: bucket.count,
    color: SALDO_COLORS[bucket.label] ?? "#64748b",
  }));
}

function toStatusBars(slices: StatusSlice[]): HorizontalBarItem[] {
  return [...slices]
    .sort((a, b) => STATUS_PRIORITY[a.key] - STATUS_PRIORITY[b.key])
    .map((slice) => ({
      key: slice.key,
      label: slice.label,
      value: slice.value,
      color: slice.color,
    }));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ press?: string; line?: string; mtool?: string }>;
}) {
  const params = await searchParams;
  const filter = { press: params.press, line: params.line };
  const [data, maintenanceToolOptions, maintenanceHistory, maintenanceTrend] = await Promise.all([
    getDashboardData(filter),
    getToolMaintenanceOptions(),
    params.mtool ? getToolMaintenanceHistory(params.mtool) : Promise.resolve(null),
    getMaintenanceMonthlyTrend(),
  ]);
  const isFiltered = Boolean(filter.press || filter.line);
  const total = data.counts.total;
  const generatedAt = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Controle 50K"
        description="Visão geral da situação dos ferramentais."
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/leituras"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Registrar leitura
            </Link>
            <Link
              href="/controle-50k"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Abrir Controle 50K
            </Link>
          </div>
        }
      />
      <Section
        title="Histórico de manutenções por ferramental"
        description="Escolha um ferramental para ver o ciclo dele em relação aos limites de 45k e 50k."
      >
        <ToolMaintenanceChart
          options={maintenanceToolOptions}
          history={maintenanceHistory}
          selectedToolId={params.mtool}
        />
      </Section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <DashboardFilters
          presses={data.filterOptions.presses}
          lines={data.filterOptions.lines}
          applied={data.appliedFilter}
        />
        <span className="text-xs text-slate-500">
          {isFiltered ? (
            <>
              Escopo: <strong className="text-slate-700">{formatNumber(total)}</strong> ferramentais
            </>
          ) : (
            <>
              <strong className="text-slate-700">{formatNumber(total)}</strong> ferramentais ativos
            </>
          )}
          <span className="ml-2 text-slate-400">· dados de {generatedAt}</span>
        </span>
      </div>

      {/* 1. AÇÃO — KPIs principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Vencidos"
          value={data.counts.vencido}
          total={total}
          hint="intervenção urgente"
          href={priorityHref("VENCIDO")}
          cta="Intervir agora"
          icon={XCircle}
          tone="red"
          emphasis
        />
        <KpiCard
          title="Atenção"
          value={data.counts.atencao}
          total={total}
          hint="monitorar de perto"
          href={priorityHref("ATENCAO")}
          cta="Monitorar"
          icon={TriangleAlert}
          tone="amber"
        />
        <KpiCard
          title="Preventivas"
          value={data.counts.programar}
          total={total}
          hint="agendar manutenção"
          href={priorityHref("PROGRAMAR_PREVENTIVA")}
          cta="Agendar"
          icon={Wrench}
          tone="orange"
        />
        <KpiCard
          title="Frota monitorada"
          value={total}
          total={total}
          hint={`${formatNumber(data.counts.ok)} OK`}
          href="/controle-50k"
          cta="Ver Controle 50K"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      {/* 2. Ferramentais que exigem ação */}
      <Section
        title="Ferramentais que exigem ação"
        description="Prioridade por status e menor saldo 50K atual."
        action={
          <Link
            href="/controle-50k?sort=real_asc"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ver todos
          </Link>
        }
      >
        <ActionTable items={data.actionQueue} />
      </Section>

      {/* 3. Manutenções previstas */}
      <Section
        title="Manutenções previstas"
        description="O que precisa entrar no plano, por prioridade."
        action={
          <Link
            href="/controle-50k?sort=real_asc"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Detalhar
          </Link>
        }
      >
        <MaintenanceForecastPanel forecast={data.maintenanceForecast} />
      </Section>

      {/* 4. DISTRIBUIÇÃO */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Distribuição do saldo 50K"
          description="Ferramentais por faixa de saldo disponível. Saldo = 50.000 − acúmulo atual."
        >
          {total === 0 ? (
            <EmptyPanel>Nenhum ferramental no escopo atual.</EmptyPanel>
          ) : (
            <HorizontalBars items={toSaldoBars(data.saldoDistribution)} total={total} />
          )}
        </ChartCard>

        <ChartCard
          title="Distribuição por status"
          description="Participação de cada status na frota em escopo (mais crítico primeiro)."
        >
          {total === 0 ? (
            <EmptyPanel>Nenhum ferramental no escopo atual.</EmptyPanel>
          ) : (
            <HorizontalBars items={toStatusBars(data.statusDistribution)} total={total} />
          )}
        </ChartCard>
      </div>

      {/* 5. TENDÊNCIA de manutenção */}
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.6fr]">
        <MonthMaintenanceCard
          total={data.maintenancesThisMonth}
          byType={data.maintenancesByType}
          previous={data.maintenancesPrevMonth}
        />
        <ChartCard
          title="Manutenções — últimos 12 meses"
          description="Preventivas vs. corretivas por mês. Um aumento de corretivas indica falha não planejada."
          action={
            <Link href="/manutencoes" className="text-xs font-medium text-blue-600 hover:text-blue-700">
              Abrir histórico
            </Link>
          }
        >
          <MaintenanceTrendChart data={maintenanceTrend} />
        </ChartCard>
      </div>

      {/* 6. Histórico por ferramental */}


      <Section
        title="Saúde das leituras"
        description="Mostra onde o status ainda depende de estimativa ou de leitura antiga."
      >
        <ReadingHealth
          staleReadings={data.staleReadings}
          missingReadings={data.missingReadings}
          staleReadingCount={data.staleReadingCount}
        />
      </Section>
{/* 
      <Section
        title="Qualidade dos dados"
        description="Pontos que podem distorcer previsão, saldo ou status."
      >
        <QualityIssues issues={data.qualityIssues} />
      </Section>
 */}
      <Section
        title="Manutenções recentes"
        description="Últimos registros do mês corrente."
        action={
          <Link href="/manutencoes" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Abrir histórico
          </Link>
        }
      >
        <RecentMaintenances maintenances={data.recentMaintenances} />
      </Section>

      {/* <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-slate-900">Como usar este painel</p>
            <p className="mt-1">
              Use o dashboard para decidir a próxima ação. Use o Controle 50K para investigar
              cálculo, simular datas, exportar relatórios e analisar a projeção completa.
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
}
