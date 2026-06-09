import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  UPLOAD: "Upload de arquivo",
  ESCALATION_CREATE: "Abertura de escalonamento",
};

export default async function AuditoriaPage() {
  const session = await getSession();
  if (!session || !canAdminister(session.role)) {
    return (
      <div>
        <PageHeader title="Auditoria" icon="LayoutDashboard" />
        <EmptyState title="Acesso restrito" description="Apenas Administradores." icon="Users" />
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: session.org ?? null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Auditoria de Acessos e Ações"
        subtitle="Registro das atividades no portal"
        icon="LayoutDashboard"
      />

      <Card title={`Últimos eventos (${logs.length})`}>
        {logs.length === 0 ? (
          <EmptyState title="Sem registros" icon="LayoutDashboard" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Usuário</th>
                  <th className="pb-2">Ação</th>
                  <th className="pb-2">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-500 dark:text-slate-400">{formatDateTime(l.createdAt)}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{l.user?.name ?? "—"}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{ACTION_LABELS[l.action] ?? l.action}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{l.detail ?? l.target ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
