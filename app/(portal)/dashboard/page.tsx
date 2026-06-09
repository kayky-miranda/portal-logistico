import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrgId } from "@/lib/tenant";
import {
  faturamentoPorDia,
  faturamentoResumo,
  demandaPorDia,
  aderenciaPorDia,
  fretePorDia,
  fullRangeDays,
} from "@/lib/analytics";
import { normalizePeriod } from "@/lib/period";
import { formatCurrency, formatNumber, formatPercent, formatDateTime } from "@/lib/utils";
import { PageHeader, KpiCard, Card, SeverityBadge } from "@/components/ui";
import { PeriodSelect } from "@/components/period-select";
import { TimeSeriesArea, MultiLine, BarSeries } from "@/components/charts";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const period = normalizePeriod(sp.days);
  const org = await requireOrgId();

  // "Todo o período" usa o intervalo real (primeira data no banco → hoje).
  const days =
    period === "all"
      ? await fullRangeDays(org, ["faturamento", "demanda", "producao", "frete"])
      : Number(period);

  const [fatDia, fatResumo, demDia, aderDia, freteDia, alerts] = await Promise.all([
    faturamentoPorDia(org, days),
    faturamentoResumo(org, days),
    demandaPorDia(org, days),
    aderenciaPorDia(org, days),
    fretePorDia(org, days),
    prisma.alert.findMany({
      where: { organizationId: org, status: "OPEN" },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const aderenciaMedia =
    aderDia.length > 0
      ? aderDia.reduce((s, p) => s + Number(p.aderencia), 0) / aderDia.length
      : 0;
  const freteTotal = freteDia.reduce((s, p) => s + Number(p.custo), 0);
  const demandaRealizada = demDia.reduce((s, p) => s + Number(p.realizado), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard Principal"
        subtitle="Visão geral das operações"
        icon="LayoutDashboard"
        action={<PeriodSelect value={period} />}
      />

      {/* Banner de alertas ativos */}
      {alerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-800">
            <Icon name="AlertTriangle" className="h-5 w-5" />
            <span className="font-semibold">
              {alerts.length} alerta(s) ativo(s)
            </span>
            <Link href="/alertas" className="ml-auto text-sm font-medium text-amber-700 underline">
              Ver todos
            </Link>
          </div>
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm text-amber-900">
                <SeverityBadge severity={a.severity} />
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`Faturamento (${days}d)`}
          value={formatCurrency(fatResumo.total)}
          hint={`Média/dia: ${formatCurrency(fatResumo.media)}`}
          icon="DollarSign"
          tone="brand"
        />
        <KpiCard
          label="Aderência média produção"
          value={formatPercent(aderenciaMedia)}
          icon="Factory"
          tone={aderenciaMedia >= 95 ? "green" : aderenciaMedia >= 90 ? "amber" : "red"}
        />
        <KpiCard
          label={`Demanda realizada (${days}d)`}
          value={formatNumber(demandaRealizada)}
          icon="BarChart3"
          tone="green"
        />
        <KpiCard
          label={`Custo de frete (${days}d)`}
          value={formatCurrency(freteTotal)}
          icon="Truck"
          tone="amber"
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Faturamento por dia">
          <TimeSeriesArea data={fatDia} serie={{ key: "valor", label: "Faturamento" }} format="currency" />
        </Card>
        <Card title="Demanda vs realizado">
          <MultiLine
            data={demDia}
            series={[
              { key: "demanda", label: "Demanda", color: "#94a3b8" },
              { key: "realizado", label: "Realizado", color: "#1f47f5" },
            ]}
          />
        </Card>
        <Card title="Aderência da produção (%)">
          <MultiLine
            data={aderDia}
            series={[{ key: "aderencia", label: "Aderência %", color: "#10b981" }]}
            format="percent"
          />
        </Card>
        <Card title="Custo de frete por dia">
          <BarSeries data={freteDia} series={[{ key: "custo", label: "Custo", color: "#f59e0b" }]} format="currency" />
        </Card>
      </div>

      <p className="mt-6 text-right text-xs text-slate-400 dark:text-slate-500">
        Atualizado em {formatDateTime(new Date())}
      </p>
    </div>
  );
}
