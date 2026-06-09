import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireOrgId } from "@/lib/tenant";
import { canManageAlerts } from "@/lib/roles";
import { getModule } from "@/lib/modules";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { setEscalationStatus } from "../escalonamento/actions";

export const dynamic = "force-dynamic";

const STATUSES = ["ABERTO", "EM_ANDAMENTO", "RESOLVIDO"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDO: "Resolvido",
};

const NIVEL_TONE: Record<string, string> = {
  RED: "bg-red-100 text-red-700",
  YELLOW: "bg-amber-100 text-amber-700",
};

// Configuração visual de cada cartão de status.
const CARDS: {
  status: Status;
  label: string;
  icon: string;
  ring: string;
  chip: string;
  iconBox: string;
}[] = [
  {
    status: "ABERTO",
    label: "Em aberto",
    icon: "Siren",
    ring: "ring-red-400",
    chip: "text-red-600 dark:text-red-400",
    iconBox: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  {
    status: "EM_ANDAMENTO",
    label: "Em andamento",
    icon: "Clock",
    ring: "ring-amber-400",
    chip: "text-amber-600 dark:text-amber-400",
    iconBox: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    status: "RESOLVIDO",
    label: "Resolvidos",
    icon: "CheckCircle2",
    ring: "ring-emerald-400",
    chip: "text-emerald-600 dark:text-emerald-400",
    iconBox: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
];

export default async function EscalonamentosPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const active: Status | null = STATUSES.includes(sp.status as Status)
    ? (sp.status as Status)
    : null;

  const session = await getSession();
  const manager = Boolean(session && canManageAlerts(session.role));
  const org = await requireOrgId();

  const [grouped, escalations] = await Promise.all([
    prisma.escalation.groupBy({
      by: ["status"],
      where: { organizationId: org },
      _count: { _all: true },
    }),
    prisma.escalation.findMany({
      where: { organizationId: org, ...(active ? { status: active } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        createdBy: { select: { name: true } },
        notifications: { select: { channel: true, status: true } },
      },
    }),
  ]);

  const countOf = (s: string) =>
    grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

  return (
    <div>
      <PageHeader
        title="Painel de Escalonamentos"
        subtitle="Acompanhe todos os escalonamentos por status"
        icon="Siren"
        action={
          <Link href="/escalonamento" className="btn-primary">
            <Icon name="Siren" className="h-4 w-4" /> Abrir escalonamento
          </Link>
        }
      />

      {/* Cartões de contagem por status (clicáveis = filtram a lista) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {CARDS.map((c) => {
          const isActive = active === c.status;
          return (
            <Link
              key={c.status}
              href={isActive ? "/escalonamentos" : `/escalonamentos?status=${c.status}`}
              className={cn(
                "card flex items-center gap-4 p-5 transition hover:shadow-md",
                isActive && `ring-2 ${c.ring}`,
              )}
            >
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", c.iconBox)}>
                <Icon name={c.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{countOf(c.status)}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Filtros (inclui "Todos") */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/escalonamentos"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            !active
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
          )}
        >
          Todos ({total})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/escalonamentos?status=${s}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active === s
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            )}
          >
            {STATUS_LABELS[s]} ({countOf(s)})
          </Link>
        ))}
      </div>

      <Card
        title={`${active ? STATUS_LABELS[active] : "Todos os escalonamentos"} (${escalations.length}${escalations.length >= 100 ? "+" : ""})`}
      >
        {escalations.length === 0 ? (
          <EmptyState
            title="Nenhum escalonamento"
            description={active ? "Nenhum escalonamento com este status." : "Ainda não há escalonamentos registrados."}
            icon="Siren"
          />
        ) : (
          <ul className="space-y-3">
            {escalations.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`badge ${NIVEL_TONE[e.nivel] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                    {e.nivel} ALERT
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {e.fornecedorCliente ?? e.title}
                  </span>
                  <StatusBadge status={e.status} labels={STATUS_LABELS} />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.motivo ?? e.title}</p>
                {(e.observacao ?? e.description) && (
                  <p className="mb-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    {e.observacao ?? e.description}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {getModule(e.module)?.label ?? e.module} · {e.createdBy.name} ·{" "}
                  {formatDateTime(e.createdAt)} · {e.notifications.length} notificação(ões)
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/escalonamentos/${e.id}`}
                    className="btn-secondary text-xs"
                  >
                    <Icon name="ListChecks" className="h-4 w-4" /> Ver detalhes
                  </Link>
                  {manager && e.status !== "RESOLVIDO" && (
                    <>
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
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
