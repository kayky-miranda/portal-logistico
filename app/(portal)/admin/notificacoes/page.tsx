import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { TeamsConfig } from "./teams-config";

const CHANNEL_META: Record<string, { icon: string; label: string }> = {
  EMAIL: { icon: "Mail", label: "E-mail" },
  WHATSAPP: { icon: "MessageSquare", label: "WhatsApp" },
  TEAMS: { icon: "MessageSquare", label: "Teams" },
};

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  SENT: "Enviada",
  SIMULATED: "Simulada",
  FAILED: "Falhou",
};

export default async function NotificacoesPage() {
  const session = await getSession();
  if (!session || !canManageAlerts(session.role)) {
    return (
      <div>
        <PageHeader title="Notificações" icon="Bell" />
        <EmptyState title="Acesso restrito" description="Apenas Gestores e Administradores." icon="Bell" />
      </div>
    );
  }

  const org = session.org ?? "";
  const [notifications, simCount, orgRow] = await Promise.all([
    prisma.notification.findMany({ where: { organizationId: org }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { organizationId: org, status: "SIMULATED" } }),
    org ? prisma.organization.findUnique({ where: { id: org }, select: { teamsWebhookUrl: true } }) : null,
  ]);

  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle="Histórico e integrações (e-mail, WhatsApp, Teams)"
        icon="Bell"
      />

      <TeamsConfig current={orgRow?.teamsWebhookUrl ?? null} />

      {simCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <Icon name="AlertTriangle" className="h-4 w-4" />
          {simCount} notificação(ões) em <strong>modo simulado</strong> — conecte o
          Teams acima (grátis) ou configure SMTP/WhatsApp no <code>.env</code> para envio real.
        </div>
      )}

      <Card title={`Últimas notificações (${notifications.length})`}>
        {notifications.length === 0 ? (
          <EmptyState title="Nenhuma notificação ainda" icon="Bell" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="pb-2">Canal</th>
                  <th className="pb-2">Destino</th>
                  <th className="pb-2">Assunto</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">
                      <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <Icon name={CHANNEL_META[n.channel]?.icon ?? "Bell"} className="h-3.5 w-3.5" />
                        {CHANNEL_META[n.channel]?.label ?? n.channel}
                      </span>
                    </td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{n.destination}</td>
                    <td className="max-w-xs truncate py-2 text-slate-600 dark:text-slate-300">{n.subject}</td>
                    <td className="py-2"><StatusBadge status={n.status} labels={STATUS_LABELS} /></td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{formatDateTime(n.createdAt)}</td>
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
