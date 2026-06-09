import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Icon name={icon} className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn("card p-5", className)}>
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: "brand" | "green" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      {icon && (
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon name={icon} className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="truncate text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    RED: "bg-red-100 text-red-700",
    YELLOW: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={cn("badge", map[severity] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300")}>
      {severity === "RED" ? "🔴 Red" : severity === "YELLOW" ? "🟡 Yellow" : severity}
    </span>
  );
}

export function StatusBadge({
  status,
  labels,
}: {
  status: string;
  labels?: Record<string, string>;
}) {
  const tones: Record<string, string> = {
    OPEN: "bg-red-100 text-red-700",
    ABERTO: "bg-red-100 text-red-700",
    ACKNOWLEDGED: "bg-amber-100 text-amber-700",
    EM_ANDAMENTO: "bg-amber-100 text-amber-700",
    RESOLVED: "bg-emerald-100 text-emerald-700",
    RESOLVIDO: "bg-emerald-100 text-emerald-700",
    DONE: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    PROCESSING: "bg-brand-100 text-brand-700",
    ERROR: "bg-red-100 text-red-700",
    SENT: "bg-emerald-100 text-emerald-700",
    SIMULATED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("badge", tones[status] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300")}>
      {labels?.[status] ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon = "Boxes",
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/40 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-400 dark:text-slate-500">{description}</p>
      )}
    </div>
  );
}
