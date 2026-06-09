"use client";

import { ROLE_LABELS, type Role } from "@/lib/roles";
import { Icon } from "./icon";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  name,
  role,
  orgName,
  alertCount,
  onLogout,
}: {
  name: string;
  role: Role;
  orgName?: string | null;
  alertCount: number;
  onLogout: () => void;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6">
      <div className="flex min-w-0 items-center gap-2">
        {orgName ? (
          <>
            <Icon name="Boxes" className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
              {orgName}
            </span>
          </>
        ) : (
          <span className="text-base font-semibold text-slate-400 dark:text-slate-500">
            Plataforma
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <a
          href="/alertas"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Alertas ativos"
        >
          <Icon name="Bell" className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-redAlert px-1 text-[10px] font-bold text-white">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </a>

        <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-700 pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight text-slate-800 dark:text-slate-100">
              {name}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{ROLE_LABELS[role]}</p>
          </div>
          <form action={onLogout}>
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Sair"
            >
              <Icon name="LogOut" className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
