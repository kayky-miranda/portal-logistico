import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import { requireOrgId } from "@/lib/tenant";
import {
  faturamentoComTendencia,
  faturamentoResumo,
  segmentosFaturamento,
  clientesFaturamento,
  faturamentoPorDia,
  demandaPorDia,
  segmentosDemanda,
  variacaoDemandaSemanal,
  aderenciaPorDia,
  linhasProducao,
  fretePorDia,
  fretePorTransportadora,
  fullRangeDays,
  type FactDataset,
} from "@/lib/analytics";
import { normalizePeriod } from "@/lib/period";
import { metaDiariaDoMes } from "@/lib/meta";
import { generateForecastSmart } from "@/lib/forecast/ai";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/ui";
import { PeriodSelect } from "@/components/period-select";
import { FilterSelect } from "@/components/filter-select";
import { TimeSeriesArea, MultiLine, BarSeries, Donut, FaturamentoTrendChart } from "@/components/charts";
import { Upload } from "lucide-react";

export const dynamic = "force-dynamic";

interface SP {
  days?: string;
  segmento?: string;
  cliente?: string;
  linha?: string;
  semanas?: string;
}

function parseWeeks(v: string | undefined): number {
  const n = Number(v);
  return [4, 8, 12, 26].includes(n) ? n : 8;
}

// Dataset que define o intervalo de "Todo o período" para cada módulo.
function datasetForModule(modulo: string): FactDataset[] {
  if (modulo === "forecast") return ["faturamento"];
  if (["faturamento", "demanda", "producao", "frete"].includes(modulo)) return [modulo as FactDataset];
  return ["faturamento"];
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ modulo: string }>;
  searchParams: Promise<SP>;
}) {
  const { modulo } = await params;
  const sp = await searchParams;
  const moduleSpec = getModule(modulo);
  if (!moduleSpec) notFound();
  const org = await requireOrgId();

  const usesDays = modulo !== "variacao";
  const period = normalizePeriod(sp.days);
  // "Todo o período" → da primeira data do dataset deste módulo até hoje.
  const days =
    period === "all" ? await fullRangeDays(org, datasetForModule(modulo)) : Number(period);

  return (
    <div>
      <PageHeader
        title={moduleSpec.label}
        subtitle={moduleSpec.description}
        icon={moduleSpec.icon}
        action={
          <div className="flex items-center gap-2">
            {usesDays && <PeriodSelect value={period} />}
            {moduleSpec.dataset && (
              <Link href="/upload" className="btn-secondary">
                <Upload className="h-4 w-4" /> Upload
              </Link>
            )}
          </div>
        }
      />
      {modulo === "faturamento" && <Faturamento org={org} days={days} sp={sp} />}
      {modulo === "demanda" && <Demanda org={org} days={days} sp={sp} />}
      {modulo === "variacao" && <Variacao org={org} sp={sp} />}
      {modulo === "producao" && <Producao org={org} days={days} sp={sp} />}
      {modulo === "frete" && <Frete org={org} days={days} />}
      {modulo === "forecast" && <Forecast org={org} days={days} sp={sp} />}
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

// ---------------------------------------------------------------------------
async function Faturamento({ org, days, sp }: { org: string; days: number; sp: SP }) {
  const filter = { segmento: sp.segmento, cliente: sp.cliente };
  const [serie, resumo, meta, segmentos, clientes] = await Promise.all([
    faturamentoComTendencia(org, days, filter),
    faturamentoResumo(org, days, filter),
    metaDiariaDoMes(org),
    segmentosFaturamento(org),
    clientesFaturamento(org),
  ]);
  if (resumo.total === 0)
    return <EmptyState title="Sem dados de faturamento" description="Faça upload de um arquivo de faturamento." icon="DollarSign" />;

  const atingimento = meta.metaDiaria > 0 ? (resumo.media / meta.metaDiaria) * 100 : 0;
  const setaTendencia = meta.tendencia === "alta" ? "↑" : meta.tendencia === "baixa" ? "↓" : "→";

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect param="segmento" value={sp.segmento} options={segmentos} allLabel="Todos os segmentos" />
        <FilterSelect param="cliente" value={sp.cliente} options={clientes} allLabel="Todos os clientes" />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label={`Total (${days}d)`} value={formatCurrency(resumo.total)} icon="DollarSign" />
        <KpiCard label="Média/dia" value={formatCurrency(resumo.media)} icon="TrendingUp" tone="green" />
        <KpiCard
          label={`Meta diária (${meta.mes})`}
          value={`${formatCurrency(meta.metaDiaria)} ${setaTendencia}`}
          icon="Target"
          tone="red"
        />
        <KpiCard
          label="Atingimento da meta"
          value={formatPercent(atingimento)}
          icon="BarChart3"
          tone={atingimento >= 100 ? "green" : atingimento >= 90 ? "amber" : "red"}
        />
      </div>

      <Card title="Faturamento por dia (com tendência e meta)">
        <FaturamentoTrendChart data={serie} meta={meta.metaDiaria} />
        {meta.justificativa && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            🎯 Meta {meta.fonte === "ia" ? "(IA)" : "(projeção)"} para {meta.mes}: {meta.justificativa}
          </p>
        )}
      </Card>

      <Card title="Por segmento">
        <Donut data={resumo.porSegmento} format="currency" />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function Demanda({ org, days, sp }: { org: string; days: number; sp: SP }) {
  const [serie, segmentos] = await Promise.all([
    demandaPorDia(org, days, sp.segmento),
    segmentosDemanda(org),
  ]);
  const totDem = serie.reduce((s, p) => s + Number(p.demanda), 0);
  const totReal = serie.reduce((s, p) => s + Number(p.realizado), 0);
  if (totDem === 0 && totReal === 0)
    return <EmptyState title="Sem dados de demanda" description="Faça upload de um arquivo de demanda (demanda e realizado do dia)." icon="BarChart3" />;
  const atendimento = totDem > 0 ? (totReal / totDem) * 100 : 0;

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect param="segmento" value={sp.segmento} options={segmentos} allLabel="Todos os segmentos" />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Demanda (total)" value={formatNumber(totDem)} icon="BarChart3" />
        <KpiCard label="Realizado (total)" value={formatNumber(totReal)} icon="BarChart3" tone="green" />
        <KpiCard label="Atendimento" value={formatPercent(atendimento)} icon="TrendingUp" tone={atendimento >= 95 ? "green" : atendimento >= 85 ? "amber" : "red"} />
      </div>
      <Card title="Demanda vs realizado por dia">
        <MultiLine
          data={serie}
          series={[
            { key: "demanda", label: "Demanda", color: "#94a3b8" },
            { key: "realizado", label: "Realizado", color: "#1f47f5" },
          ]}
          height={340}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function Variacao({ org, sp }: { org: string; sp: SP }) {
  const weeks = parseWeeks(sp.semanas);
  const [semanal, segmentos] = await Promise.all([
    variacaoDemandaSemanal(org, weeks, sp.segmento),
    segmentosDemanda(org),
  ]);
  const comparaveis = semanal.filter((s) => s.anterior > 0);
  if (comparaveis.length === 0)
    return <EmptyState title="Sem dados de variação" description="A variação compara a demanda de cada semana com a semana anterior (precisa de pelo menos 2 semanas de dados)." icon="ArrowUpDown" />;

  const data = semanal.map((s) => ({ date: s.semana, variacao: s.variacao, atual: s.atual, anterior: s.anterior }));
  const media = comparaveis.reduce((s, p) => s + p.variacao, 0) / comparaveis.length;
  const ultima = comparaveis[comparaveis.length - 1].variacao;

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect param="segmento" value={sp.segmento} options={segmentos} allLabel="Todos os segmentos" />
        <FilterSelect param="semanas" value={String(weeks)} options={["4", "8", "12", "26"]} allLabel="8 semanas" label="Semanas" />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Variação média (semana/semana)" value={formatPercent(media)} icon="ArrowUpDown" tone={Math.abs(media) <= 10 ? "green" : "amber"} />
        <KpiCard label="Última semana" value={formatPercent(ultima)} icon="TrendingUp" tone={ultima >= 0 ? "green" : "red"} />
      </div>
      <Card title="Variação da demanda por semana (%)">
        <BarSeries data={data} series={[{ key: "variacao", label: "Variação % vs semana anterior", color: "#8b5cf6" }]} format="percent" height={320} />
      </Card>
      <Card title="Demanda por semana (atual vs anterior)">
        <MultiLine
          data={data}
          series={[
            { key: "anterior", label: "Semana anterior", color: "#94a3b8" },
            { key: "atual", label: "Semana atual", color: "#1f47f5" },
          ]}
          height={300}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function Producao({ org, days, sp }: { org: string; days: number; sp: SP }) {
  const [serie, linhas] = await Promise.all([
    aderenciaPorDia(org, days, sp.linha),
    linhasProducao(org),
  ]);
  const valid = serie.filter((p) => Number(p.programado) > 0);
  if (valid.length === 0)
    return <EmptyState title="Sem dados de produção" description="Faça upload de um arquivo de produção." icon="Factory" />;
  const media = valid.reduce((s, p) => s + Number(p.aderencia), 0) / valid.length;

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect param="linha" value={sp.linha} options={linhas} allLabel="Todas as linhas" label="Linha produtiva" />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Aderência média" value={formatPercent(media)} icon="Factory" tone={media >= 95 ? "green" : media >= 90 ? "amber" : "red"} />
        <KpiCard label="Linha" value={sp.linha ?? "Todas"} icon="Filter" />
        <KpiCard label="Dias monitorados" value={String(valid.length)} icon="BarChart3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Aderência da produção (%)">
          <MultiLine data={serie} series={[{ key: "aderencia", label: "Aderência %", color: "#10b981" }]} format="percent" />
        </Card>
        <Card title="Programado vs Realizado">
          <BarSeries
            data={serie}
            series={[
              { key: "programado", label: "Programado", color: "#94a3b8" },
              { key: "realizado", label: "Realizado", color: "#1f47f5" },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function Frete({ org, days }: { org: string; days: number }) {
  const [serie, porTransp] = await Promise.all([
    fretePorDia(org, days),
    fretePorTransportadora(org, days),
  ]);
  const totCusto = serie.reduce((s, p) => s + Number(p.custo), 0);
  if (totCusto === 0)
    return <EmptyState title="Sem dados de frete" description="Faça upload de um arquivo de frete." icon="Truck" />;
  const mediaDia = totCusto / days;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={`Custo total (${days}d)`} value={formatCurrency(totCusto)} icon="Truck" tone="amber" />
        <KpiCard label="Custo médio/dia" value={formatCurrency(mediaDia)} icon="DollarSign" />
        <KpiCard label="Transportadoras" value={String(porTransp.length)} icon="BarChart3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Custo de frete por dia" className="lg:col-span-2">
          <BarSeries data={serie} series={[{ key: "custo", label: "Custo", color: "#f59e0b" }]} format="currency" />
        </Card>
        <Card title="Por transportadora">
          <Donut data={porTransp} format="currency" />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function Forecast({ org, days, sp }: { org: string; days: number; sp: SP }) {
  const filter = { segmento: sp.segmento, cliente: sp.cliente };
  // usa o período selecionado como janela de histórico (mín. 14 dias).
  const historyDays = Math.max(14, days);
  const [serie, segmentos, clientes] = await Promise.all([
    faturamentoPorDia(org, historyDays, filter),
    segmentosFaturamento(org),
    clientesFaturamento(org),
  ]);
  const history = serie.map((p) => ({ date: String(p.date), value: Number(p.valor) }));
  const hasData = history.some((p) => p.value > 0);

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect param="segmento" value={sp.segmento} options={segmentos} allLabel="Todos os segmentos" />
        <FilterSelect param="cliente" value={sp.cliente} options={clientes} allLabel="Todos os clientes" />
      </FilterBar>

      {!hasData ? (
        <EmptyState title="Sem histórico para previsão" description="A previsão usa o histórico de faturamento (ajuste os filtros)." icon="TrendingUp" />
      ) : (
        <ForecastBody history={history} />
      )}
    </div>
  );
}

async function ForecastBody({ history }: { history: { date: string; value: number }[] }) {
  const fc = await generateForecastSmart(history, 14);
  const proj = fc.points.filter((p) => p.previsto !== undefined && p.real === undefined);
  const totalProjetado = proj.reduce((s, p) => s + (p.previsto ?? 0), 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Previsão próx. 14 dias" value={formatCurrency(totalProjetado)} icon="TrendingUp" tone="brand" />
        <KpiCard label="Tendência/dia" value={formatCurrency(fc.trendPerDay)} icon="ArrowUpDown" tone={fc.trendPerDay >= 0 ? "green" : "red"} />
        <KpiCard label="Média recente (7d)" value={formatCurrency(fc.avgRecent)} icon="BarChart3" />
      </div>

      {fc.ai && fc.analise && (
        <Card className="border-l-4 border-l-brand-500">
          <div className="mb-1 flex items-center gap-2">
            <span className="badge bg-brand-100 text-brand-700">✨ Análise por IA</span>
            {fc.tendencia && (
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Tendência: {fc.tendencia}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{fc.analise}</p>
        </Card>
      )}

      <Card title="Faturamento: histórico e previsão">
        <MultiLine
          data={fc.points}
          series={[
            { key: "real", label: "Histórico", color: "#1f47f5" },
            { key: "previsto", label: "Previsto", color: "#f59e0b" },
          ]}
          format="currency"
          height={360}
        />
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Método: {fc.method}.{" "}
          {fc.ai
            ? "Previsão gerada pela Claude API."
            : "Baseline estatístico — defina ANTHROPIC_API_KEY no .env para ativar a previsão por IA da Claude."}
        </p>
      </Card>
    </>
  );
}
