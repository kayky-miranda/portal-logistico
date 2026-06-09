"use server";

import { redirect } from "next/navigation";
import { destroySession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    // Auditoria não pode bloquear o logout (ex.: sessão antiga apontando para
    // um usuário que não existe mais após um reseed).
    try {
      const exists = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true } });
      await prisma.auditLog.create({
        data: {
          organizationId: session.org,
          userId: exists ? session.sub : null,
          action: "LOGOUT",
          target: session.email,
        },
      });
    } catch (err) {
      console.error("[logout] falha ao registrar auditoria (ignorado):", err);
    }
  }
  await destroySession();
  redirect("/login");
}
