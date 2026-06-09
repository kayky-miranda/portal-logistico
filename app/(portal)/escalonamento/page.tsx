import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireOrgId } from "@/lib/tenant";
import { canManageAlerts } from "@/lib/roles";
import { getModule } from "@/lib/modules";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { EscalationForm } from "./escalation-form";
import { setEscalationStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDO: "Resolvido",
};

const NIVEL_TONE: Record<string, string> = {
  RED: "bg-red-100 text-red-700",
  YELLOW: "bg-amber-100 text-amber-700",
};

export default async function EscalonamentoPage() {
  const session = await getSession();
  const manager = session && canManageAlerts(session.role);

  const org = await requireOrgId();
  const [escalations, contacts] = await Promise.all([
    prisma.escalation.findMany({
      where: { organizationId: org },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        createdBy: { select: { name: true } },
        notifications: { select: { channel: true, status: true } },
      },
    }),
    prisma.contact.findMany({ where: { organizationId: org }, orderBy: { email: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Escalonamento"
        subtitle="Abra um chamado: a equipe é notificada por WhatsApp e e-mail"
        icon="Siren"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <EscalationForm contacts={contacts} />

        <Card title={`Escalonamentos recentes (${escalations.length})`}>
          {escalations.length === 0 ? (
            <EmptyState title="Nenhum escalonamento" icon="Siren" />
          ) : (
            <ul className="space-y-3">
              {escalations.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`badge ${NIVEL_TONE[e.nivel] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                      {e.nivel} ALERT
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{e.fornecedorCliente ?? e.title}</span>
                    <StatusBadge status={e.status} labels={STATUS_LABELS} />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.motivo ?? e.title}</p>
                  <p className="mb-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{e.observacao ?? e.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {getModule(e.module)?.label ?? e.module} · {e.createdBy.name} ·{" "}
                    {formatDateTime(e.createdAt)} · {e.notifications.length} notificação(ões)
                  </p>
                  {manager && e.status !== "RESOLVIDO" && (
                    <div className="mt-2 flex gap-2">
                      {e.status === "ABERTO" && (
                        <form action={setEscalationStatus}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="status" value="EM_ANDAMENTO" />
                          <button className="btn-secondary text-xs">Em andamento</button>
                        </form>
                      )}
                      <form action={setEscalationStatus}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="status" value="RESOLVIDO" />
                        <button className="btn-primary text-xs">Resolver</button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
