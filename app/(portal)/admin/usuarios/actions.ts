"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAdminister, ROLES, type Role } from "@/lib/roles";

export interface UserState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || !canAdminister(session.role) || !session.org) {
    throw new Error("Sem permissão.");
  }
  return session;
}

// Papéis atribuíveis por um admin de organização (SUPER_ADMIN é só da plataforma).
function validRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v) && v !== "SUPER_ADMIN";
}

export async function createUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Sem permissão." };
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "VIEWER");
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!name || !email || !password) {
    return { error: "Nome, e-mail e senha são obrigatórios." };
  }
  if (password.length < 6) {
    return { error: "A senha deve ter ao menos 6 caracteres." };
  }
  if (!validRole(role)) return { error: "Papel inválido." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Já existe um usuário com este e-mail." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, role, phone, organizationId: session.org },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true, message: `Usuário ${email} criado.` };
}

export async function updateUser(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  const active = String(formData.get("active")) === "true";
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!validRole(role)) return;

  // Evita o admin remover o próprio acesso de administrador / desativar-se.
  if (id === session.sub && (role !== "ADMIN" || !active)) {
    return;
  }

  // updateMany com filtro de org: só altera usuário da própria organização.
  await prisma.user.updateMany({ where: { id, organizationId: session.org }, data: { role, active, phone } });
  revalidatePath("/admin/usuarios");
}

export async function resetPassword(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (password.length < 6) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.updateMany({ where: { id, organizationId: session.org }, data: { passwordHash } });
  revalidatePath("/admin/usuarios");
}
