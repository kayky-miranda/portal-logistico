import Anthropic from "@anthropic-ai/sdk";
import {
  generateForecast,
  addDaysIso,
  type SeriesPoint,
  type ForecastResult,
  type ForecastPoint,
} from "./index";

const MODEL = "claude-opus-4-8";

// JSON Schema nativo para structured outputs (sem dependência de versão do Zod).
const FORECAST_SCHEMA = {
  type: "object",
  properties: {
    previsao: {
      type: "array",
      items: { type: "number" },
      description: "valores previstos de faturamento (R$) para cada um dos próximos dias, em ordem",
    },
    tendencia: {
      type: "string",
      enum: ["alta", "estavel", "baixa"],
      description: "tendência geral identificada no histórico",
    },
    analise: {
      type: "string",
      description: "análise objetiva em português (2 a 4 frases) sobre a previsão, sazonalidade e recomendações",
    },
  },
  required: ["previsao", "tendencia", "analise"],
  additionalProperties: false,
} as const;

interface ForecastJson {
  previsao: number[];
  tendencia: "alta" | "estavel" | "baixa";
  analise: string;
}

const SYSTEM = `Você é um analista de previsão de demanda e faturamento de uma operação logística.
Recebe uma série temporal diária de faturamento (em reais) e deve projetar os próximos dias.
Considere tendência, sazonalidade semanal (quedas em fins de semana são comuns) e ruído.
Seja realista: as previsões devem seguir o nível e a variação do histórico, nunca valores negativos.
Responda exclusivamente no formato estruturado solicitado, com a análise em português do Brasil.`;

/** Indica se a previsão por IA está disponível (chave configurada). */
export function isForecastAIEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Gera a previsão usando a Claude API (saída estruturada). Em caso de ausência
 * de chave ou erro, retorna o baseline estatístico — o módulo nunca quebra.
 */
export async function generateForecastSmart(
  history: SeriesPoint[],
  horizon = 14,
): Promise<ForecastResult> {
  if (!isForecastAIEnabled()) {
    return { ...generateForecast(history, horizon), ai: false };
  }

  try {
    const client = new Anthropic();
    const recent = history.slice(-60);
    const serie = recent.map((p) => `${p.date}: ${p.value.toFixed(2)}`).join("\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      // Instruções estáveis no system (cacheáveis); dados voláteis no user.
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content:
            `Histórico diário de faturamento (R$), do mais antigo ao mais recente:\n` +
            `${serie}\n\n` +
            `Projete os próximos ${horizon} dias. Retorne exatamente ${horizon} valores em "previsao".`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: FORECAST_SCHEMA } },
    });

    const text = response.content.find((b) => b.type === "text");
    const parsed: ForecastJson | null = text ? JSON.parse(text.text) : null;

    if (!parsed || !Array.isArray(parsed.previsao) || parsed.previsao.length === 0) {
      return { ...generateForecast(history, horizon), ai: false };
    }

    const values = parsed.previsao
      .slice(0, horizon)
      .map((v) => Math.max(0, Math.round(Number(v) * 100) / 100));

    const points: ForecastPoint[] = history.map((p) => ({
      date: p.date,
      real: Math.round(p.value * 100) / 100,
    }));

    const lastDate =
      history.length > 0 ? history[history.length - 1].date : new Date().toISOString().slice(0, 10);

    // conecta a linha de previsão ao último ponto real
    if (history.length > 0) {
      points[history.length - 1].previsto = points[history.length - 1].real;
    }
    values.forEach((v, i) => {
      points.push({ date: addDaysIso(lastDate, i + 1), previsto: v });
    });

    const recentValues = recent.map((p) => p.value);
    const avgRecent =
      recentValues.length > 0
        ? recentValues.slice(-7).reduce((s, v) => s + v, 0) / Math.min(7, recentValues.length)
        : 0;
    const trendPerDay =
      values.length > 1 ? (values[values.length - 1] - values[0]) / values.length : 0;

    return {
      points,
      method: `IA — Claude (${MODEL})`,
      trendPerDay: Math.round(trendPerDay * 100) / 100,
      avgRecent: Math.round(avgRecent * 100) / 100,
      ai: true,
      analise: parsed.analise,
      tendencia: parsed.tendencia,
    };
  } catch (err) {
    console.error("[forecast:ai] falha, usando baseline:", err);
    return { ...generateForecast(history, horizon), ai: false };
  }
}
