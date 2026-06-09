"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";
import { evaluateAlerts } from "@/lib/alerts/engine";
import { dispatchAlertNotifications } from "@/lib/notify";

async function requireManager() {
  const session = await getSession();
  if (!session || !canManageAlerts(session.role) || !session.org) {
    throw new Error("Sem permissão para gerenciar alertas.");
  }
  return session;
}

export async function setAlertStatus(formData: FormData) {
  const session = await requireManager();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(status)) return;
  // updateMany com filtro de org garante que só altera alerta da própria org.
  await prisma.alert.updateMany({ where: { id, organizationId: session.org! }, data: { status } });
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}

export async function reevaluateAlerts() {
  const session = await requireManager();
  const created = await evaluateAlerts(session.org!);
  for (const a of created) {
    await dispatchAlertNotifications(a);
  }
  revalidatePath("/alertas");
  revalidatePath("/dashboard");
}
