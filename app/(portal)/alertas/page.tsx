import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireOrgId } from "@/lib/tenant";
import { canManageAlerts } from "@/lib/roles";
import { getModule } from "@/lib/modules";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, SeverityBadge, StatusBadge, EmptyState } from "@/components/ui";
import { setAlertStatus, reevaluateAlerts } from "./actions";
import { RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  OPEN: "Aberto",
  ACKNOWLEDGED: "Reconhecido",
  RESOLVED: "Resolvido",
};

export default async function AlertasPage() {
  const session = await getSession();
  const manager = session && canManageAlerts(session.role);
  const org = await requireOrgId();

  const [open, history] = await Promise.all([
    prisma.alert.findMany({
      where: { organizationId: org, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    }),
    prisma.alert.findMany({
      where: { organizationId: org, status: "RESOLVED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Alertas (Red & Yellow)"
        subtitle="Monitoramento das regras de negócio"
        icon="AlertTriangle"
        action={
          manager ? (
            <form action={reevaluateAlerts}>
              <button type="submit" className="btn-secondary">
                <RefreshCw className="h-4 w-4" /> Reavaliar agora
              </button>
            </form>
          ) : undefined
        }
      />

      <Card title={`Alertas ativos (${open.length})`} className="mb-6">
        {open.length === 0 ? (
          <EmptyState title="Nenhum alerta ativo" description="Tudo dentro dos limites configurados." icon="AlertTriangle" />
        ) : (
          <ul className="space-y-2">
            {open.map((a) => (
              <li
                key={a.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                  a.severity === "RED" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <SeverityBadge severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getModule(a.module)?.label ?? a.module} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <StatusBadge status={a.status} labels={STATUS_LABELS} />
                {manager && (
                  <div className="flex gap-2">
                    {a.status === "OPEN" && (
                      <form action={setAlertStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="ACKNOWLEDGED" />
                        <button className="btn-secondary text-xs">Reconhecer</button>
                      </form>
                    )}
                    <form action={setAlertStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="RESOLVED" />
                      <button className="btn-primary text-xs">Resolver</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Histórico (resolvidos)">
        {history.length === 0 ? (
          <EmptyState title="Sem histórico" icon="AlertTriangle" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="pb-2">Severidade</th>
                  <th className="pb-2">Mensagem</th>
                  <th className="pb-2">Módulo</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2"><SeverityBadge severity={a.severity} /></td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{a.message}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{getModule(a.module)?.label ?? a.module}</td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{formatDateTime(a.createdAt)}</td>
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
