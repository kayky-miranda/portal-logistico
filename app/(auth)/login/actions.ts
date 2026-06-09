"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import type { Role } from "@/lib/roles";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Credenciais inválidas ou usuário inativo." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "Credenciais inválidas." };
  }

  // Bloqueia usuário de org desativada (exceto SUPER_ADMIN).
  if (user.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org || !org.active) {
      return { error: "Organização inativa. Contate o administrador." };
    }
  }

  await createSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    org: user.organizationId,
  });

  await prisma.auditLog.create({
    data: { userId: user.id, organizationId: user.organizationId, action: "LOGIN", target: user.email },
  });

  // SUPER_ADMIN vai para a gestão de organizações; demais para o dashboard.
  const fallback = user.role === "SUPER_ADMIN" ? "/admin/organizacoes" : "/dashboard";
  const candidate = next.startsWith("/") && !next.startsWith("//") ? next : fallback;
  redirect(candidate);
}
