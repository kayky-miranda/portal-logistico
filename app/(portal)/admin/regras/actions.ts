"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";

async function requireManager() {
  const session = await getSession();
  if (!session || !canManageAlerts(session.role) || !session.org) {
    throw new Error("Sem permissão.");
  }
  return session as typeof session & { org: string };
}

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}

export async function createRule(formData: FormData) {
  const session = await requireManager();
  const metric = String(formData.get("metric"));
  const moduleMap: Record<string, string> = {
    faturamento_dia: "faturamento",
    aderencia_producao_pct: "producao",
    variacao_demanda_pct_abs: "variacao",
    custo_frete_dia: "frete",
  };
  await prisma.alertRule.create({
    data: {
      organizationId: session.org,
      name: String(formData.get("name") || "Nova regra"),
      module: moduleMap[metric] ?? "faturamento",
      metric,
      operator: String(formData.get("operator") || "lt"),
      yellowThreshold: num(formData.get("yellowThreshold")),
      redThreshold: num(formData.get("redThreshold")),
      active: true,
    },
  });
  revalidatePath("/admin/regras");
}

export async function updateRule(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("id"));
  await prisma.alertRule.updateMany({
    where: { id, organizationId: session.org },
    data: {
      name: String(formData.get("name")),
      operator: String(formData.get("operator")),
      yellowThreshold: num(formData.get("yellowThreshold")),
      redThreshold: num(formData.get("redThreshold")),
    },
  });
  revalidatePath("/admin/regras");
}

export async function toggleRule(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  await prisma.alertRule.updateMany({ where: { id, organizationId: session.org }, data: { active } });
  revalidatePath("/admin/regras");
}

export async function deleteRule(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("id"));
  // remove alertas vinculados primeiro (FK), escopado à org
  await prisma.alert.deleteMany({ where: { ruleId: id, organizationId: session.org } });
  await prisma.alertRule.deleteMany({ where: { id, organizationId: session.org } });
  revalidatePath("/admin/regras");
}
