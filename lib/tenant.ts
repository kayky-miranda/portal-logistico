import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth";

/**
 * Garante que há uma organização na sessão e a retorna. Use no início de cada
 * página/ação operacional para escopar as consultas por tenant.
 * - Sem sessão → /login
 * - SUPER_ADMIN (sem org) → /admin/organizacoes (área da plataforma)
 */
export async function requireOrgId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.org) redirect("/admin/organizacoes");
  return session.org;
}
