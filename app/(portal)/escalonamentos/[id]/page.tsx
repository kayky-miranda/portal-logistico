import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireOrgId } from "@/lib/tenant";
import { canManageAlerts } from "@/lib/roles";
import { getModule } from "@/lib/modules";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { buildEscalationMessage } from "@/lib/notify";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/icon";
import { ArrowLeft } from "lucide-react";
import { setEscalationStatus } from "../../escalonamento/actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDO: "Resolvido",
};

const NIVEL_TONE: Record<string, string> = {
  RED: "bg-red-100 text-red-700",
  YELLOW: "bg-amber-100 text-amber-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  TEAMS: "Teams",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

/** Linha de campo (rótulo + valor). Mostra "—" quando vazio. */
function Field({ label, value }: { label: string; value?: string | number | null }) {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">{v}</dd>
    </div>
  );
}

export default async function EscalationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const manager = Boolean(session && canManageAlerts(session.role));
  const org = await requireOrgId();

  const e = await prisma.escalation.findFirst({
    where: { id, organizationId: org },
    include: {
      createdBy: { select: { name: true, email: true } },
      notifications: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!e) notFound();

  const componente = [e.componenteCodigo, e.componenteDescricao].filter(Boolean).join(" - ");

  // Reproduz a mensagem exata que foi enviada (formato padronizado).
  const { body: mensagem } = buildEscalationMessage({
    nivel: e.nivel,
    fornecedorCliente: e.fornecedorCliente ?? "",
    componenteCodigo: e.componenteCodigo ?? "",
    componenteDescricao: e.componenteDescricao ?? "",
    origemMaterial: e.origemMaterial ?? "",
    motivo: e.motivo ?? "",
    observacao: e.observacao ?? "",
    consumoCmd: e.consumoCmd,
    estoquePlascar: e.estoquePlascar,
    setorProdutivo: e.setorProdutivo ?? "",
    coberturaCliente: e.coberturaCliente,
    abertura: e.createdAt,
  });

  return (
    <div>
      <PageHeader
        title={e.fornecedorCliente ?? e.title}
        subtitle={`Escalonamento ${e.nivel} · aberto por ${e.createdBy.name}`}
        icon="Siren"
        action={
          <Link href="/escalonamentos" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Voltar ao painel
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`badge ${NIVEL_TONE[e.nivel] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
          {e.nivel} ALERT
        </span>
        <StatusBadge status={e.status} labels={STATUS_LABELS} />
        {manager && e.status !== "RESOLVIDO" && (
          <div className="flex gap-2">
            {e.status === "ABERTO" && (
              <form action={setEscalationStatus}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="status" value="EM_ANDAMENTO" />
                <button className="btn-secondary text-xs">Marcar em andamento</button>
              </form>
            )}
            <form action={setEscalationStatus}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="status" value="RESOLVIDO" />
              <button className="btn-primary text-xs">Resolver</button>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações preenchidas por quem abriu */}
        <Card title="Detalhes do escalonamento">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Data de abertura" value={formatDateTime(e.createdAt)} />
            <Field label="Nível" value={`${e.nivel} ALERT`} />
            <Field label="Fornecedor/Cliente" value={e.fornecedorCliente} />
            <Field label="Módulo" value={getModule(e.module)?.label ?? e.module} />
            <Field label="Componente" value={componente} />
            <Field label="Origem do material" value={e.origemMaterial} />
            <div className="col-span-2">
              <Field label="Motivo" value={e.motivo} />
            </div>
            <div className="col-span-2">
              <Field label="Observação" value={e.observacao} />
            </div>
            <Field label="Consumo (CMD)" value={e.consumoCmd !== null ? formatNumber(e.consumoCmd) : null} />
            <Field label="Estoque Plascar" value={e.estoquePlascar !== null ? formatNumber(e.estoquePlascar) : null} />
            <Field label="Setor Produtivo" value={e.setorProdutivo} />
            <Field
              label="Cobertura no Cliente"
              value={e.coberturaCliente !== null ? `${formatNumber(e.coberturaCliente)} dia(s)` : null}
            />
            <Field label="Prioridade" value={PRIORITY_LABELS[e.priority] ?? e.priority} />
            <Field label="Última atualização" value={formatDateTime(e.updatedAt)} />
            <div className="col-span-2">
              <Field label="Aberto por" value={`${e.createdBy.name} (${e.createdBy.email})`} />
            </div>
            <div className="col-span-2">
              <Field label="Destinatários — e-mail" value={e.contactEmails} />
            </div>
            <div className="col-span-2">
              <Field label="Destinatários — WhatsApp" value={e.contactPhones} />
            </div>
          </dl>
        </Card>

        <div className="space-y-6">
          {/* Mensagem exata enviada */}
          <Card title="Mensagem enviada (e-mail / WhatsApp / Teams)">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800 p-4 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {mensagem}
            </pre>
          </Card>

          {/* Notificações disparadas */}
          <Card title={`Notificações disparadas (${e.notifications.length})`}>
            {e.notifications.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma notificação registrada.</p>
            ) : (
              <ul className="space-y-2">
                {e.notifications.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {CHANNEL_LABELS[n.channel] ?? n.channel}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">{n.destination}</span>
                    <StatusBadge status={n.status} />
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
