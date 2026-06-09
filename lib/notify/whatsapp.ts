import type { SendResult } from "./email";

function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

/** Normaliza telefone para o formato aceito pela Meta (somente dígitos). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Envia uma mensagem de texto via WhatsApp Cloud API (Meta). Se as credenciais
 * não estiverem configuradas no .env, retorna SIMULATED.
 *
 * Obs.: mensagens de texto livre só são entregues dentro da janela de 24h de
 * atendimento. Fora disso, a Meta exige envio por "template" aprovado — o
 * código de template fica pronto para ser plugado quando você tiver templates.
 */
export async function sendWhatsapp(
  to: string,
  body: string,
): Promise<SendResult> {
  if (!whatsappConfigured()) {
    console.log(`[whatsapp:SIMULADO] para=${to} msg="${body.slice(0, 60)}..."`);
    return { status: "SIMULATED", info: "WhatsApp Cloud API não configurado" };
  }

  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizePhone(to),
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok) {
      return { status: "FAILED", info: json.error?.message || `HTTP ${res.status}` };
    }
    return { status: "SENT", info: json.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp:ERRO]", err);
    return { status: "FAILED", info: String(err) };
  }
}
