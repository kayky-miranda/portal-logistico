import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { OrgForm } from "./org-form";
import { rotateApiKey, toggleOrganization } from "./actions";
import { RefreshCw, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrganizacoesPage() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.role)) {
    return (
      <div>
        <PageHeader title="Organizações" icon="Boxes" />
        <EmptyState title="Acesso restrito" description="Apenas o Super Admin da plataforma." icon="Boxes" />
      </div>
    );
  }

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Organizações (clientes do SaaS)"
        subtitle="Cadastre clientes, gerencie API keys do conector de ERP e o status"
        icon="Boxes"
      />

      <Card title="Nova organização" className="mb-6">
        <OrgForm />
      </Card>

      <Card title={`Organizações (${orgs.length})`}>
        {orgs.length === 0 ? (
          <EmptyState title="Nenhuma organização" icon="Boxes" />
        ) : (
          <div className="space-y-3">
            {orgs.map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{o.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">/{o.slug}</span>
                    <span className={`badge ${o.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                      {o.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <form action={toggleOrganization}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={(!o.active).toString()} />
                    <button className="btn-secondary text-xs">{o.active ? "Desativar" : "Ativar"}</button>
                  </form>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">API key (conector de ERP)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 ring-1 ring-slate-200">
                      {o.apiKey}
                    </code>
                    <form action={rotateApiKey}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn-secondary text-xs" title="Gerar nova API key">
                        <RefreshCw className="h-3.5 w-3.5" /> Rotacionar
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Endpoint: <code>POST /api/ingest/&#123;faturamento|demanda|producao|frete&#125;</code> ·
                    Header: <code>x-api-key: {`{API key}`}</code>
                  </p>
                </div>

                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {o._count.users} usuário(s) · criada em {formatDateTime(o.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
