// Meta de faturamento DIÁRIO, recalculada a cada mês.
//
// A meta considera o histórico de faturamento e a tendência projetada
// (se está em alta ou queda) para definir um alvo realista para o mês.
// É persistida em MetaFaturamento (uma linha por mês "yyyy-MM"), então só é
// recalculada quando vira o mês — mantendo o valor estável durante o mês.

import { prisma } from "@/lib/db";
import { faturamentoPorDia } from "@/lib/analytics";

export interface MetaInfo {
  mes: string; // yyyy-MM
  metaDiaria: number;
  fonte: string; // projecao | ia | manual
  tendencia: "alta" | "estavel" | "baixa";
  justificativa: string;
}

function mesAtual(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function regSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}

/**
 * Calcula a meta diária a partir dos últimos ~90 dias de faturamento.
 * meta = média diária projetada ~15 dias à frente pela tendência linear.
 */
async function computeMeta(organizationId: string, mes: string): Promise<MetaInfo> {
  const serie = await faturamentoPorDia(organizationId, 90);
  const values = serie.map((p) => Number(p.valor)).filter((v) => v > 0);

  if (values.length === 0) {
    return {
      mes,
      metaDiaria: 0,
      fonte: "projecao",
      tendencia: "estavel",
      justificativa: "Sem histórico suficiente para projetar a meta.",
    };
  }

  const media = values.reduce((s, v) => s + v, 0) / values.length;
  const slope = regSlope(values);
  // projeta a média ~15 dias à frente (meio do próximo período)
  const projetada = Math.max(0, media + slope * 15);
  // arredonda para a centena mais próxima
  const metaDiaria = Math.round(projetada / 100) * 100;

  const variacaoPct = media > 0 ? (slope * 30) / media * 100 : 0;
  const tendencia: MetaInfo["tendencia"] =
    variacaoPct > 2 ? "alta" : variacaoPct < -2 ? "baixa" : "estavel";

  const justificativa =
    `Baseada na média diária de ${media.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ` +
    `dos últimos ${values.length} dias e na tendência ${tendencia} ` +
    `(${variacaoPct >= 0 ? "+" : ""}${variacaoPct.toFixed(1)}% projetado no mês).`;

  return { mes, metaDiaria, fonte: "projecao", tendencia, justificativa };
}

/**
 * Retorna a meta diária do mês corrente, calculando e persistindo se ainda
 * não existir para o mês.
 */
export async function metaDiariaDoMes(organizationId: string): Promise<MetaInfo> {
  const mes = mesAtual();
  const existing = await prisma.metaFaturamento.findUnique({
    where: { organizationId_mes: { organizationId, mes } },
  });
  if (existing) {
    return {
      mes: existing.mes,
      metaDiaria: existing.metaDiaria,
      fonte: existing.fonte,
      tendencia: (existing.tendencia as MetaInfo["tendencia"]) ?? "estavel",
      justificativa: existing.justificativa ?? "",
    };
  }

  const meta = await computeMeta(organizationId, mes);
  try {
    await prisma.metaFaturamento.create({
      data: {
        organizationId,
        mes: meta.mes,
        metaDiaria: meta.metaDiaria,
        fonte: meta.fonte,
        tendencia: meta.tendencia,
        justificativa: meta.justificativa,
      },
    });
  } catch {
    // corrida entre requisições: outra já criou — segue com o valor calculado
  }
  return meta;
}
