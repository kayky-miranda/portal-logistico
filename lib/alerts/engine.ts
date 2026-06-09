import { prisma } from "@/lib/db";
import {
  faturamentoPorDia,
  aderenciaPorDia,
  variacaoDemandaPorDia,
  fretePorDia,
} from "@/lib/analytics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export interface EvaluatedAlert {
  id: string;
  organizationId: string;
  ruleId: string;
  module: string;
  metric: string;
  severity: "YELLOW" | "RED";
  value: number;
  message: string;
}

type Operator = "gt" | "gte" | "lt" | "lte";

function breach(value: number, threshold: number, op: Operator): boolean {
  switch (op) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
  }
}

/** Último valor disponível de uma métrica (o dia mais recente com dado). */
async function metricLatestValue(organizationId: string, metric: string): Promise<number | null> {
  const window = 30;
  const lastNonZero = (arr: { date: string }[], key: string): number | null => {
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = Number((arr[i] as Record<string, unknown>)[key]);
      if (v !== 0 && !isNaN(v)) return v;
    }
    return null;
  };

  switch (metric) {
    case "faturamento_dia":
      return lastNonZero(await faturamentoPorDia(organizationId, window), "valor");
    case "aderencia_producao_pct":
      return lastNonZero(await aderenciaPorDia(organizationId, window), "aderencia");
    case "variacao_demanda_pct_abs": {
      const arr = await variacaoDemandaPorDia(organizationId, window);
      const v = lastNonZero(arr, "variacao");
      return v === null ? null : Math.abs(v);
    }
    case "custo_frete_dia":
      return lastNonZero(await fretePorDia(organizationId, window), "custo");
    default:
      return null;
  }
}

function formatValue(metric: string, value: number): string {
  if (metric.includes("pct")) return formatPercent(value);
  if (metric.includes("faturamento") || metric.includes("custo"))
    return formatCurrency(value);
  return formatNumber(value);
}

/**
 * Avalia regras de alerta ativas (opcionalmente filtradas por módulo),
 * cria registros de Alert para as violações e devolve as avaliações.
 * Evita duplicar alertas OPEN para a mesma regra no mesmo dia.
 */
export async function evaluateAlerts(organizationId: string, module?: string): Promise<EvaluatedAlert[]> {
  const rules = await prisma.alertRule.findMany({
    where: { organizationId, active: true, ...(module ? { module } : {}) },
  });

  const created: EvaluatedAlert[] = [];

  for (const rule of rules) {
    const value = await metricLatestValue(organizationId, rule.metric);
    if (value === null) continue;

    const op = rule.operator as Operator;
    let severity: "YELLOW" | "RED" | null = null;

    if (rule.redThreshold !== null && breach(value, rule.redThreshold, op)) {
      severity = "RED";
    } else if (
      rule.yellowThreshold !== null &&
      breach(value, rule.yellowThreshold, op)
    ) {
      severity = "YELLOW";
    }

    if (!severity) continue;

    // dedup: já existe alerta OPEN para esta regra criado hoje?
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const existing = await prisma.alert.findFirst({
      where: { organizationId, ruleId: rule.id, status: "OPEN", createdAt: { gte: since } },
    });
    if (existing) continue;

    const message = `${rule.name}: ${formatValue(rule.metric, value)} (limite ${severity === "RED" ? "Red" : "Yellow"}).`;

    const alert = await prisma.alert.create({
      data: {
        organizationId,
        ruleId: rule.id,
        module: rule.module,
        metric: rule.metric,
        severity,
        value,
        message,
        status: "OPEN",
      },
    });

    created.push({
      id: alert.id,
      organizationId,
      ruleId: rule.id,
      module: rule.module,
      metric: rule.metric,
      severity,
      value,
      message,
    });
  }

  return created;
}
