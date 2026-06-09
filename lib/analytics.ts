import { prisma } from "./db";

export interface Point {
  date: string; // yyyy-MM-dd
  [key: string]: number | string;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeStart(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export type FactDataset = "faturamento" | "demanda" | "producao" | "frete";

/** Data do registro mais antigo de um dataset na organização. */
async function firstDateOf(organizationId: string, dataset: FactDataset): Promise<Date | null> {
  const args = { where: { organizationId }, orderBy: { data: "asc" as const }, select: { data: true } };
  let row: { data: Date } | null = null;
  switch (dataset) {
    case "faturamento": row = await prisma.faturamento.findFirst(args); break;
    case "demanda": row = await prisma.demanda.findFirst(args); break;
    case "producao": row = await prisma.producao.findFirst(args); break;
    case "frete": row = await prisma.frete.findFirst(args); break;
  }
  return row?.data ?? null;
}

/**
 * Número de dias entre o registro mais antigo (dentre os datasets informados)
 * e hoje — usado pelo filtro "Todo o período". Sem dados, retorna 30.
 */
export async function fullRangeDays(organizationId: string, datasets: FactDataset[]): Promise<number> {
  const firsts = await Promise.all(datasets.map((d) => firstDateOf(organizationId, d)));
  const valid = firsts.filter((d): d is Date => d != null);
  if (valid.length === 0) return 30;
  const earliest = new Date(Math.min(...valid.map((d) => d.getTime())));
  earliest.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - earliest.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

/** Regressão linear simples sobre y indexado por x=0..n-1. */
function linreg(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// ===========================================================================
// Faturamento
// ===========================================================================
export interface FaturamentoFilter {
  segmento?: string;
  cliente?: string;
}

function faturamentoWhere(organizationId: string, start: Date, f?: FaturamentoFilter) {
  return {
    organizationId,
    data: { gte: start },
    ...(f?.segmento ? { segmento: f.segmento } : {}),
    ...(f?.cliente ? { cliente: f.cliente } : {}),
  };
}

/** Soma de faturamento por dia (com filtros opcionais). */
export async function faturamentoPorDia(organizationId: string, days = 30, f?: FaturamentoFilter): Promise<Point[]> {
  const start = rangeStart(days);
  const rows = await prisma.faturamento.findMany({
    where: faturamentoWhere(organizationId, start, f),
    select: { data: true, valor: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.data);
    map.set(k, (map.get(k) ?? 0) + r.valor);
  }
  return toSeries(map, days, (v) => ({ valor: round(v) }));
}

/**
 * Faturamento por dia + linha de tendência (regressão linear) por ponto.
 */
export async function faturamentoComTendencia(organizationId: string, days = 30, f?: FaturamentoFilter): Promise<Point[]> {
  const serie = await faturamentoPorDia(organizationId, days, f);
  const values = serie.map((p) => Number(p.valor));
  const { slope, intercept } = linreg(values);
  return serie.map((p, i) => ({
    ...p,
    tendencia: round(intercept + slope * i),
  }));
}

/** Faturamento total, por segmento e por cliente no período. */
export async function faturamentoResumo(organizationId: string, days = 30, f?: FaturamentoFilter) {
  const start = rangeStart(days);
  const rows = await prisma.faturamento.findMany({
    where: faturamentoWhere(organizationId, start, f),
    select: { valor: true, segmento: true, cliente: true },
  });
  const total = rows.reduce((s, r) => s + r.valor, 0);
  const porSegmento = new Map<string, number>();
  const porCliente = new Map<string, number>();
  for (const r of rows) {
    const seg = r.segmento || "Sem segmento";
    const cli = r.cliente || "Sem cliente";
    porSegmento.set(seg, (porSegmento.get(seg) ?? 0) + r.valor);
    porCliente.set(cli, (porCliente.get(cli) ?? 0) + r.valor);
  }
  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value);
  return {
    total: round(total),
    media: round(total / days),
    porSegmento: toSorted(porSegmento),
    porCliente: toSorted(porCliente),
  };
}

/** Valores distintos de segmento no faturamento (para filtros). */
export async function segmentosFaturamento(organizationId: string): Promise<string[]> {
  const rows = await prisma.faturamento.findMany({ where: { organizationId }, select: { segmento: true }, distinct: ["segmento"] });
  return rows.map((r) => r.segmento).filter((s): s is string => Boolean(s)).sort();
}

/** Valores distintos de cliente no faturamento (para filtros). */
export async function clientesFaturamento(organizationId: string): Promise<string[]> {
  const rows = await prisma.faturamento.findMany({ where: { organizationId }, select: { cliente: true }, distinct: ["cliente"] });
  return rows.map((r) => r.cliente).filter((s): s is string => Boolean(s)).sort();
}

// ===========================================================================
// Demanda (sem previsão: demanda x realizado)
// ===========================================================================
/** Demanda e realizado por dia (com filtro opcional de segmento). */
export async function demandaPorDia(organizationId: string, days = 30, segmento?: string): Promise<Point[]> {
  const start = rangeStart(days);
  const rows = await prisma.demanda.findMany({
    where: { organizationId, data: { gte: start }, ...(segmento ? { segmento } : {}) },
    select: { data: true, demanda: true, realizado: true },
  });
  const dem = new Map<string, number>();
  const real = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.data);
    dem.set(k, (dem.get(k) ?? 0) + r.demanda);
    real.set(k, (real.get(k) ?? 0) + r.realizado);
  }
  return lastDayKeys(days).map((k) => ({
    date: k,
    demanda: round(dem.get(k) ?? 0),
    realizado: round(real.get(k) ?? 0),
  }));
}

/** Segmentos distintos na demanda (para filtros). */
export async function segmentosDemanda(organizationId: string): Promise<string[]> {
  const rows = await prisma.demanda.findMany({ where: { organizationId }, select: { segmento: true }, distinct: ["segmento"] });
  return rows.map((r) => r.segmento).filter((s): s is string => Boolean(s)).sort();
}

/**
 * Variação diária realizado x demanda (%), usada pelo motor de alertas.
 */
export async function variacaoDemandaPorDia(organizationId: string, days = 30): Promise<Point[]> {
  const base = await demandaPorDia(organizationId, days);
  return base.map((p) => {
    const demanda = Number(p.demanda) || 0;
    const realizado = Number(p.realizado) || 0;
    const variacao = demanda > 0 ? ((realizado - demanda) / demanda) * 100 : 0;
    return { date: p.date, variacao: round(variacao) };
  });
}

// ===========================================================================
// Variação da demanda — semana a semana
// ===========================================================================
function weekStart(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  return dayKey(x);
}

export interface VariacaoSemana {
  semana: string;
  atual: number;
  anterior: number;
  variacao: number;
}

export async function variacaoDemandaSemanal(organizationId: string, weeks = 8, segmento?: string): Promise<VariacaoSemana[]> {
  const rows = await prisma.demanda.findMany({
    where: { organizationId, ...(segmento ? { segmento } : {}) },
    select: { data: true, demanda: true },
    orderBy: { data: "asc" },
  });
  const porSemana = new Map<string, number>();
  for (const r of rows) {
    const k = weekStart(r.data);
    porSemana.set(k, (porSemana.get(k) ?? 0) + r.demanda);
  }
  const ordered = [...porSemana.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const out: VariacaoSemana[] = ordered.map(([semana, atual], i) => {
    const anterior = i > 0 ? ordered[i - 1][1] : 0;
    const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
    return { semana, atual: round(atual), anterior: round(anterior), variacao: round(variacao) };
  });
  return out.slice(-weeks);
}

// ===========================================================================
// Aderência da produção (com filtro por linha)
// ===========================================================================
export async function aderenciaPorDia(organizationId: string, days = 30, linha?: string): Promise<Point[]> {
  const start = rangeStart(days);
  const rows = await prisma.producao.findMany({
    where: { organizationId, data: { gte: start }, ...(linha ? { linha } : {}) },
    select: { data: true, programado: true, realizado: true },
  });
  const prog = new Map<string, number>();
  const real = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.data);
    prog.set(k, (prog.get(k) ?? 0) + r.programado);
    real.set(k, (real.get(k) ?? 0) + r.realizado);
  }
  return lastDayKeys(days).map((k) => {
    const p = prog.get(k) ?? 0;
    const rr = real.get(k) ?? 0;
    return {
      date: k,
      aderencia: p > 0 ? round((rr / p) * 100) : 0,
      programado: round(p),
      realizado: round(rr),
    };
  });
}

/** Linhas produtivas distintas (para filtros). */
export async function linhasProducao(organizationId: string): Promise<string[]> {
  const rows = await prisma.producao.findMany({ where: { organizationId }, select: { linha: true }, distinct: ["linha"] });
  return rows.map((r) => r.linha).filter((s): s is string => Boolean(s)).sort();
}

// ===========================================================================
// Frete (sem peso)
// ===========================================================================
export async function fretePorDia(organizationId: string, days = 30): Promise<Point[]> {
  const start = rangeStart(days);
  const rows = await prisma.frete.findMany({
    where: { organizationId, data: { gte: start } },
    select: { data: true, custo: true },
  });
  const custo = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.data);
    custo.set(k, (custo.get(k) ?? 0) + r.custo);
  }
  return lastDayKeys(days).map((k) => ({ date: k, custo: round(custo.get(k) ?? 0) }));
}

export async function fretePorTransportadora(organizationId: string, days = 30) {
  const start = rangeStart(days);
  const rows = await prisma.frete.findMany({
    where: { organizationId, data: { gte: start } },
    select: { transportadora: true, custo: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const t = r.transportadora || "Sem transportadora";
    map.set(t, (map.get(t) ?? 0) + r.custo);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value);
}

// ---- helpers --------------------------------------------------------------
function round(v: number): number {
  return Math.round((v || 0) * 100) / 100;
}

function lastDayKeys(days: number): string[] {
  const start = rangeStart(days);
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(dayKey(d));
  }
  return keys;
}

function toSeries(
  map: Map<string, number>,
  days: number,
  build: (v: number) => Record<string, number>,
): Point[] {
  return lastDayKeys(days).map((k) => ({ date: k, ...build(map.get(k) ?? 0) }));
}
