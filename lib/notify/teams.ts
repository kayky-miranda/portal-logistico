import type { SendResult } from "./email";

/**
 * Integração gratuita com Microsoft Teams via "Webhook de Entrada".
 *
 * Como obter a URL (sem custo, só precisa de uma conta Teams):
 *   1. No Teams, vá ao canal desejado → ··· → "Workflows" (ou app "Workflows").
 *   2. Use o modelo "Postar em um canal quando uma solicitação de webhook for
 *      recebida" ("Post to a channel when a webhook request is received").
 *   3. O fluxo gera uma URL HTTPS — cole-a na configuração da organização.
 *
 * O portal envia um Adaptive Card no formato `{ type: "message", attachments: [...] }`,
 * que é o aceito pelo conector de webhook do Teams/Workflows. Não há janela de 24h
 * nem necessidade de template (diferente do WhatsApp) — mensagens proativas funcionam.
 */

export function teamsConfigured(url?: string | null): boolean {
  return Boolean(url && /^https:\/\//i.test(url));
}

/** Monta o corpo (Adaptive Card) enviado ao webhook do Teams. */
export function buildTeamsPayload(
  title: string,
  body: string,
  severity?: "RED" | "YELLOW" | null,
): unknown {
  // Cor da barra do card conforme a severidade.
  const color =
    severity === "RED" ? "Attention" : severity === "YELLOW" ? "Warning" : "Accent";

  // Quebra o corpo em linhas para preservar a formatação do escalonamento.
  const lines = body.split("\n");

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          msteams: { width: "Full" },
          body: [
            {
              type: "TextBlock",
              text: title,
              weight: "Bolder",
              size: "Large",
              color,
              wrap: true,
            },
            ...lines.map((text) => ({
              type: "TextBlock",
              text: text || " ",
              wrap: true,
              spacing: "Small",
            })),
          ],
        },
      },
    ],
  };
}

/**
 * Envia uma mensagem para um canal do Teams via webhook. Se a URL não estiver
 * configurada, retorna SIMULATED (registrado no banco, sem envio real).
 */
export async function sendTeams(
  webhookUrl: string | null | undefined,
  title: string,
  body: string,
  severity?: "RED" | "YELLOW" | null,
): Promise<SendResult> {
  if (!teamsConfigured(webhookUrl)) {
    console.log(`[teams:SIMULADO] título="${title}"`);
    return { status: "SIMULATED", info: "Webhook do Teams não configurado" };
  }

  try {
    const res = await fetch(webhookUrl as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTeamsPayload(title, body, severity)),
    });

    // O conector de webhook/Workflows costuma responder 200, 201 ou 202 (Accepted).
    if (res.status >= 200 && res.status < 300) {
      return { status: "SENT", info: `HTTP ${res.status}` };
    }
    const text = await res.text().catch(() => "");
    return { status: "FAILED", info: `HTTP ${res.status} ${text}`.trim().slice(0, 200) };
  } catch (err) {
    console.error("[teams:ERRO]", err);
    return { status: "FAILED", info: String(err) };
  }
}
