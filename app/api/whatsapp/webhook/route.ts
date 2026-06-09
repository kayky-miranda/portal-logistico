import { NextRequest, NextResponse } from "next/server";

// Verificação do webhook (Meta faz um GET com hub.challenge na configuração).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "portal-logistico-webhook";

  if (mode === "subscribe" && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Recebe eventos (status de entrega, mensagens recebidas). No MVP apenas
// registramos no log do servidor; pronto para evoluir (ex.: atualizar status
// de Notification por id da mensagem).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[whatsapp:webhook]", JSON.stringify(body).slice(0, 500));
  } catch {
    // corpo não-JSON; ignora
  }
  return NextResponse.json({ received: true });
}
