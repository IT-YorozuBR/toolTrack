import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Gauge,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Donut } from "@/components/charts/Donut";
import { BarSeries } from "@/components/charts/BarSeries";
import { formatNumber } from "@/lib/utils";
import type { MaintenanceStatus, ToolProjection } from "@/lib/calculations/strokes";
import { getDashboardData, type QualityIssue, type SaldoBucket } from "./dashboard-data";
import { DashboardFilters } from "./DashboardFilters";

export const dynamic = "force-dynamic";

const ACTION_STATUS: MaintenanceStatus[] = [
  "VENCIDO",
  "PROGRAMAR_PREVENTIVA",
  "ATENCAO",
];

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

function priorityHref(status: MaintenanceStatus) {
  return `/controle-50k?status=${status}`;
}

function KpiCard({
  title,
  value,
  description,
  href,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: LucideIcon;
  tone?: "default" | "green" | "yellow" | "orange" | "red" | "blue";
}) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-900",
    green: "border-green-200 bg-green-50 text-green-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };

  return (
    <Link
      href={href}
      className={`group rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatNumber(value)}</p>
        </div>
        <span className="rounded-md bg-white/70 p-2 ring-1 ring-black/5">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs opacity-75">
        <span>{description}</span>
        <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
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

function ActionTable({ items }: { items: ToolProjection[] }) {
  if (items.length === 0) {
    return (
      <EmptyPanel>
        Nenhum ferramental vencido, em preventiva ou em atenção no momento.
      </EmptyPanel>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Ferramental</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Prensa</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Saldo atual</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Saldo projetado</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Atinge</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.toolId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.code}</p>
                  {item.description && (
                    <p className="mt-0.5 max-w-56 truncate text-xs text-slate-500" title={item.description}>
                      {item.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.press}</td>
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
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    item.remainingStrokes < 0
                      ? "text-red-600"
                      : item.remainingStrokes < 5000
                      ? "text-orange-600"
                      : "text-slate-900"
                  }`}
                >
                  {formatNumber(Math.round(item.remainingStrokes))}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.effectiveStatus} />
                  {item.statusFromEstimate && (
                    <span className="ml-1 align-middle text-[10px] font-medium text-slate-400">est.</span>
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
            ))}
          </tbody>
        </table>
      </div>
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

function SaldoDistributionCard({
  buckets,
  total,
}: {
  buckets: SaldoBucket[];
  total: number;
}) {
  return (
    <ChartCard
      title="Distribuição do saldo 50K"
      description="Ferramentais por faixa de saldo atual (limite − acúmulo de hoje)."
    >
      {total === 0 ? (
        <EmptyPanel>Nenhum ferramental no escopo atual.</EmptyPanel>
      ) : (
        <BarSeries
          items={buckets.map((bucket) => ({
            label: bucket.label,
            value: bucket.count,
            highlight: bucket.urgent ? bucket.count : 0,
          }))}
          highlightLabel="crítico"
        />
      )}
    </ChartCard>
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
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Sem leitura real no ciclo</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatNumber(missingReadings)}</p>
          <p className="mt-2 text-xs opacity-75">Status usando estimativa como fallback.</p>
        </Link>
        <Link href="/leituras" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Leituras defasadas</p>
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ press?: string; line?: string }>;
}) {
  const params = await searchParams;
  const filter = { press: params.press, line: params.line };
  const data = await getDashboardData(filter);
  const isFiltered = Boolean(filter.press || filter.line);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Painel rápido de riscos, prioridades e saúde dos dados do ciclo 50K."
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <DashboardFilters
          presses={data.filterOptions.presses}
          lines={data.filterOptions.lines}
          applied={data.appliedFilter}
        />
        <span className="text-xs text-slate-500">
          {isFiltered ? (
            <>
              Escopo: <strong className="text-slate-700">{formatNumber(data.counts.total)}</strong> ferramentais
            </>
          ) : (
            <>
              <strong className="text-slate-700">{formatNumber(data.counts.total)}</strong> ferramentais ativos
            </>
          )}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          title="Total"
          value={data.counts.total}
          description="Ferramentais ativos"
          href="/controle-50k"
          icon={Gauge}
          tone="default"
        />
        <KpiCard
          title="OK"
          value={data.counts.ok}
          description="Sem ação imediata"
          href={priorityHref("OK")}
          icon={CheckCircle2}
          tone="green"
        />
        <KpiCard
          title="Atenção"
          value={data.counts.atencao}
          description="Monitorar de perto"
          href={priorityHref("ATENCAO")}
          icon={AlertTriangle}
          tone="yellow"
        />
        <KpiCard
          title="Preventiva"
          value={data.counts.programar}
          description="Agendar manutenção"
          href={priorityHref("PROGRAMAR_PREVENTIVA")}
          icon={CalendarClock}
          tone="orange"
        />
        <KpiCard
          title="Vencidos"
          value={data.counts.vencido}
          description="Intervenção urgente"
          href={priorityHref("VENCIDO")}
          icon={XCircle}
          tone="red"
        />
        <KpiCard
          title="Manutenções"
          value={data.maintenancesThisMonth}
          description="Registradas no mês"
          href="/manutencoes"
          icon={Wrench}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SaldoDistributionCard buckets={data.saldoDistribution} total={data.counts.total} />

        <ChartCard
          title="Distribuição por status"
          description="Participação de cada status na frota em escopo."
        >
          {data.counts.total === 0 ? (
            <EmptyPanel>Nenhum ferramental no escopo atual.</EmptyPanel>
          ) : (
            <Donut slices={data.statusDistribution} />
          )}
        </ChartCard>

        <ChartCard
          title="Manutenções previstas"
          description="Ferramentais que cruzam o limite por mês."
          action={
            <Link href="/controle-50k?sort=real_asc" className="text-xs font-medium text-blue-600 hover:text-blue-700">
              Detalhar
            </Link>
          }
        >
          {data.planningBuckets.length === 0 ? (
            <EmptyPanel>Nenhum ferramental alcança o limite na janela calculada.</EmptyPanel>
          ) : (
            <BarSeries
              items={data.planningBuckets.map((bucket) => ({
                label: bucket.label.replace(/\/(\d{2})(\d{2})$/, "/$2"),
                value: bucket.count,
                highlight: bucket.urgent,
                href: `/controle-50k?reachesMonth=${encodeURIComponent(bucket.label)}`,
              }))}
            />
          )}
        </ChartCard>
      </div>

      <Section
        title="Fila de ação"
        description="Prioridade por status e menor saldo 50K atual."
        action={
          <Link href="/controle-50k?sort=real_asc" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Ver tabela completa
          </Link>
        }
      >
        <ActionTable items={data.actionQueue} />
      </Section>

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

      <Section
        title="Qualidade dos dados"
        description="Pontos que podem distorcer previsão, saldo ou status."
      >
        <QualityIssues issues={data.qualityIssues} />
      </Section>

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

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-slate-900">Como usar este painel</p>
            <p className="mt-1">
              Use o dashboard para decidir a próxima ação. Use o Controle 50K para investigar
              cálculo, simular datas, exportar relatórios e analisar a projeção completa.
            </p>
          </div>
          <Activity className="ml-auto hidden h-5 w-5 shrink-0 text-slate-300 sm:block" />
        </div>
      </div>
    </div>
  );
}
