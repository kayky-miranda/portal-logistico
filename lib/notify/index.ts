import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendWhatsapp } from "./whatsapp";
import { sendTeams } from "./teams";
import type { EvaluatedAlert } from "@/lib/alerts/engine";

/**
 * Envia uma mensagem ao canal do Teams da organização (se configurado) e
 * registra a tentativa. É uma notificação por canal (não por destinatário).
 */
async function notifyTeams(
  organizationId: string,
  subject: string,
  body: string,
  link: DispatchLink,
  severity?: "RED" | "YELLOW" | null,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { teamsWebhookUrl: true },
  });
  if (!org?.teamsWebhookUrl) return; // Teams não configurado para esta org → ignora
  const res = await sendTeams(org.teamsWebhookUrl, subject, body, severity);
  await prisma.notification.create({
    data: {
      organizationId,
      channel: "TEAMS",
      destination: "Canal do Teams",
      subject,
      body,
      status: res.status,
      providerInfo: res.info,
      ...link,
    },
  });
}

interface Recipient {
  email: string | null;
  phone: string | null;
  name: string;
}

interface DispatchLink {
  alertId?: string;
  escalationId?: string;
}

/** Envia e-mail + WhatsApp para um destinatário e registra cada tentativa. */
async function notifyRecipient(
  organizationId: string,
  r: Recipient,
  subject: string,
  body: string,
  link: DispatchLink,
): Promise<void> {
  if (r.email) {
    const res = await sendEmail(r.email, subject, body);
    await prisma.notification.create({
      data: {
        organizationId,
        channel: "EMAIL",
        destination: r.email,
        subject,
        body,
        status: res.status,
        providerInfo: res.info,
        ...link,
      },
    });
  }
  if (r.phone) {
    const res = await sendWhatsapp(r.phone, `*${subject}*\n\n${body}`);
    await prisma.notification.create({
      data: {
        organizationId,
        channel: "WHATSAPP",
        destination: r.phone,
        subject,
        body,
        status: res.status,
        providerInfo: res.info,
        ...link,
      },
    });
  }
}

/** Destinatários padrão de alertas: gestores e administradores ativos da org. */
async function alertRecipients(organizationId: string): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: { organizationId, active: true, role: { in: ["ADMIN", "GESTOR"] } },
    select: { email: true, phone: true, name: true },
  });
  return users;
}

/** Dispara notificações para um alerta recém-criado. */
export async function dispatchAlertNotifications(
  alert: EvaluatedAlert,
): Promise<void> {
  const recipients = await alertRecipients(alert.organizationId);
  const subject = `${alert.severity === "RED" ? "🔴 ALERTA RED" : "🟡 ALERTA YELLOW"} — ${alert.module}`;
  const body = alert.message;
  for (const r of recipients) {
    await notifyRecipient(alert.organizationId, r, subject, body, { alertId: alert.id });
  }
  // Canal do Teams da organização (gratuito), uma vez por alerta.
  await notifyTeams(
    alert.organizationId,
    subject,
    body,
    { alertId: alert.id },
    alert.severity === "RED" || alert.severity === "YELLOW" ? alert.severity : null,
  );
}

// Faixa de cobertura exibida no cabeçalho, fixa por nível.
export const NIVEL_BANDA: Record<string, string> = {
  RED: "(≤ 1 dias)",
  YELLOW: "(≤ 3 dias)",
};

export interface EscalationData {
  nivel: string; // RED | YELLOW
  fornecedorCliente: string;
  componenteCodigo: string;
  componenteDescricao: string;
  origemMaterial: string;
  motivo: string;
  observacao: string;
  consumoCmd: number | null;
  estoquePlascar: number | null;
  setorProdutivo: string;
  coberturaCliente: number | null;
  abertura: Date;
}

/** Data no formato US: 5/26/2026 1:36:07 PM */
function formatAbertura(d: Date): string {
  const h24 = d.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ` +
    `${h12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`
  );
}

const num = (v: number | null): string =>
  v === null || v === undefined ? "-" : String(v);

/** Monta o cabeçalho e o corpo no formato padronizado de alerta. */
export function buildEscalationMessage(d: EscalationData): { header: string; body: string } {
  const banda = NIVEL_BANDA[d.nivel] ?? "";
  const componente = [d.componenteCodigo, d.componenteDescricao].filter(Boolean).join(" - ");
  const header = `${d.nivel} ALERT ${banda} - ${d.fornecedorCliente}`.replace(/\s+/g, " ").trim();
  const body =
    `${header}\n` +
    `DATA DE ABERTURA : ${formatAbertura(d.abertura)}\n` +
    `______________\n` +
    `Fornecedor/Cliente: ${d.fornecedorCliente}\n` +
    `Componente : ${componente}\n` +
    `Origem do material: ${d.origemMaterial}\n` +
    `Motivo : ${d.motivo}\n` +
    `Observação : ${d.observacao}\n` +
    `______________\n` +
    `Consumo (CMD) : ${num(d.consumoCmd)}\n` +
    `Estoque Plascar : ${num(d.estoquePlascar)}\n` +
    `Setor Produtivo : ${d.setorProdutivo}\n` +
    `Cobertura no Cliente: ${num(d.coberturaCliente)}`;
  return { header, body };
}

/** Dispara notificações detalhadas de um escalonamento (formato padrão). */
export async function dispatchEscalation(args: {
  organizationId: string;
  escalationId: string;
  data: EscalationData;
  emails: string[];
  phones: string[];
}): Promise<void> {
  const { header, body } = buildEscalationMessage(args.data);

  for (const email of args.emails) {
    const res = await sendEmail(email, header, body);
    await prisma.notification.create({
      data: {
        organizationId: args.organizationId,
        channel: "EMAIL",
        destination: email,
        subject: header,
        body,
        status: res.status,
        providerInfo: res.info,
        escalationId: args.escalationId,
      },
    });
  }
  for (const phone of args.phones) {
    // no WhatsApp o corpo já contém o cabeçalho; destacamos a 1ª linha
    const res = await sendWhatsapp(phone, body);
    await prisma.notification.create({
      data: {
        organizationId: args.organizationId,
        channel: "WHATSAPP",
        destination: phone,
        subject: header,
        body,
        status: res.status,
        providerInfo: res.info,
        escalationId: args.escalationId,
      },
    });
  }

  // Canal do Teams da organização (gratuito), uma vez por escalonamento.
  await notifyTeams(
    args.organizationId,
    header,
    body,
    { escalationId: args.escalationId },
    args.data.nivel === "RED" || args.data.nivel === "YELLOW"
      ? (args.data.nivel as "RED" | "YELLOW")
      : null,
  );
}
