"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";

export interface OrgState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function requireSuper() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.role)) {
    throw new Error("Apenas Super Admin.");
  }
  return session;
}

function genApiKey(): string {
  return "pl_" + crypto.randomBytes(24).toString("hex");
}

function slugify(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/** Cria uma organização + seu primeiro usuário administrador. */
export async function createOrganization(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  try {
    await requireSuper();
  } catch {
    return { error: "Apenas Super Admin." };
  }

  const name = String(formData.get("name") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") || "");

  if (!name || !adminName || !adminEmail || !adminPassword) {
    return { error: "Preencha o nome da organização e os dados do administrador." };
  }
  if (adminPassword.length < 6) {
    return { error: "A senha do administrador deve ter ao menos 6 caracteres." };
  }

  let slug = slugify(name) || "org";
  // garante slug único
  if (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  }
  if (await prisma.user.findUnique({ where: { email: adminEmail } })) {
    return { error: "Já existe um usuário com este e-mail." };
  }

  const org = await prisma.organization.create({
    data: { name, slug, apiKey: genApiKey(), active: true },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  revalidatePath("/admin/organizacoes");
  return { ok: true, message: `Organização "${name}" criada com admin ${adminEmail}.` };
}

/** Gera uma nova API key para a organização (invalida a anterior). */
export async function rotateApiKey(formData: FormData) {
  await requireSuper();
  const id = String(formData.get("id"));
  await prisma.organization.update({ where: { id }, data: { apiKey: genApiKey() } });
  revalidatePath("/admin/organizacoes");
}

/** Ativa/desativa uma organização. */
export async function toggleOrganization(formData: FormData) {
  await requireSuper();
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  await prisma.organization.update({ where: { id }, data: { active } });
  revalidatePath("/admin/organizacoes");
}
