import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageAlerts } from "@/lib/roles";
import { getModule } from "@/lib/modules";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { createRule, updateRule, toggleRule, deleteRule } from "./actions";
import { Plus, Trash2, Save } from "lucide-react";

export const dynamic = "force-dynamic";

const METRICS = [
  { value: "faturamento_dia", label: "Faturamento do dia (R$)" },
  { value: "aderencia_producao_pct", label: "Aderência da produção (%)" },
  { value: "variacao_demanda_pct_abs", label: "Variação da demanda — abs (%)" },
  { value: "custo_frete_dia", label: "Custo de frete do dia (R$)" },
];

const OPERATORS = [
  { value: "lt", label: "menor que (<)" },
  { value: "lte", label: "menor ou igual (≤)" },
  { value: "gt", label: "maior que (>)" },
  { value: "gte", label: "maior ou igual (≥)" },
];

function metricLabel(v: string) {
  return METRICS.find((m) => m.value === v)?.label ?? v;
}

export default async function RegrasPage() {
  const session = await getSession();
  if (!session || !canManageAlerts(session.role)) {
    return (
      <div>
        <PageHeader title="Regras de Alerta" icon="Bell" />
        <EmptyState title="Acesso restrito" description="Apenas Gestores e Administradores." icon="Bell" />
      </div>
    );
  }

  const rules = await prisma.alertRule.findMany({
    where: { organizationId: session.org ?? "" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Regras de Alerta"
        subtitle="Defina os limites Yellow e Red por métrica"
        icon="Bell"
      />

      <Card title="Nova regra" className="mb-6">
        <form action={createRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2">
            <label className="label">Nome</label>
            <input name="name" required className="input" placeholder="Ex.: Faturamento baixo" />
          </div>
          <div>
            <label className="label">Métrica</label>
            <select name="metric" className="input">
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Condição</label>
            <select name="operator" className="input" defaultValue="lt">
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Limite Yellow</label>
            <input name="yellowThreshold" type="text" inputMode="decimal" className="input" placeholder="ex.: 40000" />
          </div>
          <div>
            <label className="label">Limite Red</label>
            <input name="redThreshold" type="text" inputMode="decimal" className="input" placeholder="ex.: 30000" />
          </div>
          <div className="lg:col-span-6">
            <button type="submit" className="btn-primary">
              <Plus className="h-4 w-4" /> Adicionar regra
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Regras cadastradas (${rules.length})`}>
        {rules.length === 0 ? (
          <EmptyState title="Nenhuma regra" icon="Bell" />
        ) : (
          <div className="space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {getModule(r.module)?.label ?? r.module} · {metricLabel(r.metric)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="active" value={(!r.active).toString()} />
                      <button className={`badge ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                        {r.active ? "Ativa" : "Inativa"}
                      </button>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
                <form action={updateRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="lg:col-span-2">
                    <label className="label">Nome</label>
                    <input name="name" defaultValue={r.name} className="input" />
                  </div>
                  <div>
                    <label className="label">Condição</label>
                    <select name="operator" defaultValue={r.operator} className="input">
                      {OPERATORS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Yellow</label>
                    <input name="yellowThreshold" defaultValue={r.yellowThreshold ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Red</label>
                    <input name="redThreshold" defaultValue={r.redThreshold ?? ""} className="input" />
                  </div>
                  <div className="lg:col-span-5">
                    <button className="btn-secondary">
                      <Save className="h-4 w-4" /> Salvar alterações
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
