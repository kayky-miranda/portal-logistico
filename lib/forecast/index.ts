// Módulo de previsão (forecast).
//
// MVP: baseline estatístico = regressão linear simples (tendência) combinada
// com a média móvel recente. É determinístico e não depende de serviço externo.
//
// 👉 Ponto de extensão para IA: a função generateForecast() é o único ponto a
// trocar. Basta substituir a implementação por uma chamada à Claude API (ou
// Prophet/ARIMA) mantendo a mesma assinatura — o resto do app não muda.

export interface SeriesPoint {
  date: string; // yyyy-MM-dd
  value: number;
}

export interface ForecastPoint {
  date: string;
  real?: number; // histórico
  previsto?: number; // projeção
  [key: string]: string | number | undefined;
}

export interface ForecastResult {
  points: ForecastPoint[];
  method: string;
  // métricas auxiliares
  trendPerDay: number;
  avgRecent: number;
  // preenchidos quando a previsão é gerada por IA (Claude)
  ai?: boolean;
  analise?: string;
  tendencia?: "alta" | "estavel" | "baixa";
}

/** Soma `n` dias a uma data ISO (yyyy-MM-dd). Exportado para a camada de IA. */
export function addDaysIso(iso: string, n: number): string {
  return addDays(iso, n);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Regressão linear simples (mínimos quadrados) sobre y indexado por x=0..n-1. */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Gera a previsão para `horizon` dias à frente a partir do histórico.
 * Combina a tendência (regressão linear) com a média móvel recente para
 * suavizar o ponto de partida.
 */
export function generateForecast(
  history: SeriesPoint[],
  horizon = 14,
): ForecastResult {
  const values = history.map((p) => p.value);
  const n = values.length;

  const { slope, intercept } = linearRegression(values);
  const recentWindow = Math.min(7, n);
  const avgRecent =
    recentWindow > 0
      ? values.slice(n - recentWindow).reduce((s, v) => s + v, 0) / recentWindow
      : 0;

  const points: ForecastPoint[] = history.map((p) => ({
    date: p.date,
    real: Math.round(p.value * 100) / 100,
  }));

  // valor base = média entre o último ajuste da reta e a média recente
  const lastTrend = intercept + slope * (n - 1);
  const base = n > 0 ? (lastTrend + avgRecent) / 2 : 0;

  const lastDate = history.length > 0 ? history[history.length - 1].date : new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= horizon; i++) {
    const projected = Math.max(0, base + slope * i);
    points.push({
      date: addDays(lastDate, i),
      previsto: Math.round(projected * 100) / 100,
    });
  }

  // conecta a linha de previsão ao último ponto real
  if (points.length > horizon && history.length > 0) {
    const lastRealIdx = history.length - 1;
    points[lastRealIdx].previsto = points[lastRealIdx].real;
  }

  return {
    points,
    method: "Baseline (tendência linear + média móvel 7d)",
    trendPerDay: Math.round(slope * 100) / 100,
    avgRecent: Math.round(avgRecent * 100) / 100,
  };
}
