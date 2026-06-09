"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";
import { dispatchEscalation } from "@/lib/notify";

export interface EscalationState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function splitList(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// E.164: opcional "+", 8 a 15 dígitos.
const PHONE_RE = /^\+?\d{8,15}$/;

/** Normaliza telefone: mantém dígitos e o "+" inicial, se houver. */
function normPhone(raw: string): string {
  const t = raw.trim().replace(/[^\d+]/g, "");
  return t.startsWith("+") ? "+" + t.slice(1).replace(/\D/g, "") : t.replace(/\D/g, "");
}

/** Adiciona (ou atualiza) um destinatário salvo da org: e-mail + telefone opcional. */
export async function addContact(
  email: string,
  phone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !session.org) return { ok: false, error: "Sessão expirada." };
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, error: "E-mail inválido." };

  const p = phone ? normPhone(phone) : "";
  if (p && !PHONE_RE.test(p)) {
    return { ok: false, error: "Telefone inválido. Use o formato +5511999999999." };
  }

  await prisma.contact.upsert({
    where: { organizationId_email: { organizationId: session.org, email: e } },
    update: { active: true, phone: p || null },
    create: { organizationId: session.org, email: e, phone: p || null },
  });
  revalidatePath("/escalonamento");
  return { ok: true };
}

/** Remove um e-mail da lista salva de destinatários (apenas da própria org). */
export async function removeContact(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !session.org) return;
  await prisma.contact.deleteMany({ where: { id, organizationId: session.org } });
  revalidatePath("/escalonamento");
}

function numOrNull(formData: FormData, key: string): number | null {
  const raw = str(formData, key).replace(/\./g, "").replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createEscalation(
  _prev: EscalationState,
  formData: FormData,
): Promise<EscalationState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada." };
  if (!session.org) return { error: "Entre em uma organização para abrir escalonamento." };
  const org = session.org;

  const nivel = str(formData, "nivel") === "YELLOW" ? "YELLOW" : "RED";
  const module = String(formData.get("module") || "geral");
  const fornecedorCliente = str(formData, "fornecedorCliente");
  const componenteCodigo = str(formData, "componenteCodigo");
  const componenteDescricao = str(formData, "componenteDescricao");
  const origemMaterial = str(formData, "origemMaterial");
  const motivo = str(formData, "motivo");
  const observacao = str(formData, "observacao");
  const consumoCmd = numOrNull(formData, "consumoCmd");
  const estoquePlascar = numOrNull(formData, "estoquePlascar");
  const setorProdutivo = str(formData, "setorProdutivo");
  const coberturaCliente = numOrNull(formData, "coberturaCliente");

  if (!fornecedorCliente || !motivo) {
    return { error: "Informe ao menos o Fornecedor/Cliente e o Motivo." };
  }

  // E-mails marcados da lista salva (checkboxes) + e-mails avulsos digitados.
  const checked = formData.getAll("recipientEmails").map((v) => String(v).trim().toLowerCase());
  let emails = [...new Set([...checked, ...splitList(formData.get("contactEmails"))].filter(Boolean))];
  // Telefones: avulsos digitados + telefones dos destinatários salvos que foram marcados.
  let phones = splitList(formData.get("contactPhones")).map(normPhone).filter(Boolean);
  if (checked.length > 0) {
    const savedPhones = await prisma.contact.findMany({
      where: { organizationId: org, email: { in: checked }, phone: { not: null } },
      select: { phone: true },
    });
    phones = [
      ...new Set([
        ...phones,
        ...savedPhones.map((c) => c.phone).filter((p): p is string => Boolean(p)),
      ]),
    ];
  }

  // Sem destinatários explícitos -> notifica gestores e administradores da org.
  if (emails.length === 0 && phones.length === 0) {
    const managers = await prisma.user.findMany({
      where: { organizationId: org, active: true, role: { in: ["ADMIN", "GESTOR"] } },
      select: { email: true, phone: true },
    });
    // ignora endereços de demonstração (@portal.local) que não têm caixa real
    emails = (managers.map((m) => m.email).filter(Boolean) as string[]).filter(
      (e) => !/@portal\.local$/i.test(e),
    );
    phones = managers.map((m) => m.phone).filter((p): p is string => Boolean(p));
    // se nenhum e-mail real sobrou, usa o próprio remetente SMTP configurado
    if (emails.length === 0 && process.env.SMTP_USER?.trim()) {
      emails = [process.env.SMTP_USER.trim()];
    }
  }

  const escalation = await prisma.escalation.create({
    data: {
      organizationId: org,
      module,
      // title/description mantidos para compatibilidade da listagem
      title: motivo,
      description: observacao || motivo,
      priority: nivel === "RED" ? "CRITICA" : "ALTA",
      nivel,
      fornecedorCliente,
      componenteCodigo: componenteCodigo || null,
      componenteDescricao: componenteDescricao || null,
      origemMaterial: origemMaterial || null,
      motivo,
      observacao: observacao || null,
      consumoCmd,
      estoquePlascar,
      setorProdutivo: setorProdutivo || null,
      coberturaCliente,
      contactEmails: emails.join(", ") || null,
      contactPhones: phones.join(", ") || null,
      createdById: session.sub,
    },
  });

  await dispatchEscalation({
    organizationId: org,
    escalationId: escalation.id,
    data: {
      nivel,
      fornecedorCliente,
      componenteCodigo,
      componenteDescricao,
      origemMaterial,
      motivo,
      observacao,
      consumoCmd,
      estoquePlascar,
      setorProdutivo,
      coberturaCliente,
      abertura: escalation.createdAt,
    },
    emails,
    phones,
  });

  await prisma.auditLog.create({
    data: { organizationId: org, userId: session.sub, action: "ESCALATION_CREATE", target: `${nivel} — ${fornecedorCliente}` },
  });

  revalidatePath("/escalonamento");

  const total = emails.length + phones.length;
  return {
    ok: true,
    message: `Escalonamento ${nivel} aberto e disparado para ${total} destinatário(s) (e-mail/WhatsApp).`,
  };
}

export async function setEscalationStatus(formData: FormData) {
  const session = await getSession();
  if (!session || !canManageAlerts(session.role) || !session.org) {
    throw new Error("Sem permissão.");
  }
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["ABERTO", "EM_ANDAMENTO", "RESOLVIDO"].includes(status)) return;
  await prisma.escalation.updateMany({ where: { id, organizationId: session.org }, data: { status } });
  revalidatePath("/escalonamento");
  revalidatePath("/escalonamentos");
}
