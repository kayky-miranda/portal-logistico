"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";
import { sendTeams } from "@/lib/notify/teams";

export interface TeamsState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Salva (ou limpa) a URL do webhook do Teams da organização. */
export async function saveTeamsWebhook(
  _prev: TeamsState,
  formData: FormData,
): Promise<TeamsState> {
  const session = await getSession();
  if (!session || !session.org) return { error: "Sessão expirada." };
  if (!canManageAlerts(session.role)) return { error: "Sem permissão." };

  const raw = String(formData.get("teamsWebhookUrl") || "").trim();
  // Vazio = remover integração.
  if (raw === "") {
    await prisma.organization.update({
      where: { id: session.org },
      data: { teamsWebhookUrl: null },
    });
    revalidatePath("/admin/notificacoes");
    return { ok: true, message: "Integração do Teams removida." };
  }

  if (!/^https:\/\/.+/i.test(raw)) {
    return { error: "URL inválida. Cole a URL https:// gerada pelo Workflows do Teams." };
  }

  await prisma.organization.update({
    where: { id: session.org },
    data: { teamsWebhookUrl: raw },
  });
  await prisma.auditLog.create({
    data: { organizationId: session.org, userId: session.sub, action: "TEAMS_WEBHOOK_SET", target: "Teams" },
  });
  revalidatePath("/admin/notificacoes");
  return { ok: true, message: "Webhook do Teams salvo." };
}

/** Envia uma mensagem de teste ao canal do Teams configurado. */
export async function sendTeamsTest(): Promise<TeamsState> {
  const session = await getSession();
  if (!session || !session.org) return { error: "Sessão expirada." };
  if (!canManageAlerts(session.role)) return { error: "Sem permissão." };

  const org = await prisma.organization.findUnique({
    where: { id: session.org },
    select: { teamsWebhookUrl: true, name: true },
  });
  if (!org?.teamsWebhookUrl) {
    return { error: "Configure a URL do webhook antes de testar." };
  }

  const subject = "✅ Teste de integração — Portal Logístico";
  const body =
    `Esta é uma mensagem de teste enviada pelo Portal Logístico.\n` +
    `Organização: ${org.name}\n` +
    `Se você está vendo isto no Teams, a integração está funcionando.`;
  const res = await sendTeams(org.teamsWebhookUrl, subject, body, null);

  await prisma.notification.create({
    data: {
      organizationId: session.org,
      channel: "TEAMS",
      destination: "Canal do Teams (teste)",
      subject,
      body,
      status: res.status,
      providerInfo: res.info,
    },
  });
  revalidatePath("/admin/notificacoes");

  if (res.status === "SENT") return { ok: true, message: "Mensagem de teste enviada ao Teams!" };
  if (res.status === "SIMULATED") return { error: "Webhook não configurado (modo simulado)." };
  return { error: `Falha ao enviar: ${res.info ?? "erro desconhecido"}` };
}
