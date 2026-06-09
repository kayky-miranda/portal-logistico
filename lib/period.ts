// Opções do filtro de período dos dashboards. "all" = todo o período (da
// primeira data no banco até hoje, calculado por organização).

export const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

/** Normaliza o parâmetro de query para um valor de período válido. */
export function normalizePeriod(v: string | string[] | undefined): PeriodValue {
  const s = Array.isArray(v) ? v[0] : v;
  return (PERIOD_OPTIONS.some((o) => o.value === s) ? s : "30") as PeriodValue;
}

/** Converte um período fixo em número de dias (ignora "all", tratado à parte). */
export function periodToDays(p: PeriodValue): number {
  return p === "all" ? 30 : Number(p);
}
