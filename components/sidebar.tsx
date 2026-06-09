"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { canAdminister, canUpload, canManageAlerts, isSuperAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const moduleItems: NavItem[] = MODULES.map((m) => ({
    href: `/modulos/${m.key}`,
    label: m.label,
    icon: m.icon,
  }));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon name="Boxes" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">
            Portal Logístico
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Central de operações</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {isSuperAdmin(role) ? (
          <>
            <SectionLabel>Plataforma</SectionLabel>
            <NavLink
              href="/admin/organizacoes"
              label="Organizações"
              icon="Boxes"
              active={isActive("/admin/organizacoes")}
            />
          </>
        ) : (
          <SuperAdminHidden
            role={role}
            isActive={isActive}
            moduleItems={moduleItems}
          />
        )}
      </nav>
    </aside>
  );
}

function SuperAdminHidden({
  role,
  isActive,
  moduleItems,
}: {
  role: string;
  isActive: (href: string) => boolean;
  moduleItems: NavItem[];
}) {
  return (
    <>
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon="LayoutDashboard"
          active={isActive("/dashboard")}
        />

        <SectionLabel>Módulos</SectionLabel>
        {moduleItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
          />
        ))}
        <NavLink
          href="/escalonamentos"
          label="Painel de Escalonamentos"
          icon="Siren"
          active={isActive("/escalonamentos")}
        />

        <SectionLabel>Operação</SectionLabel>
        {canUpload(role) && (
          <NavLink
            href="/upload"
            label="Upload de Arquivo"
            icon="Upload"
            active={isActive("/upload")}
          />
        )}
        <NavLink
          href="/escalonamento"
          label="Escalonamento"
          icon="Siren"
          active={isActive("/escalonamento")}
        />
        <NavLink
          href="/alertas"
          label="Alertas"
          icon="AlertTriangle"
          active={isActive("/alertas")}
        />

        {(canAdminister(role) || canManageAlerts(role)) && (
          <>
            <SectionLabel>Administração</SectionLabel>
            {canManageAlerts(role) && (
              <>
                <NavLink
                  href="/admin/regras"
                  label="Regras de Alerta"
                  icon="Bell"
                  active={isActive("/admin/regras")}
                />
                <NavLink
                  href="/admin/notificacoes"
                  label="Notificações"
                  icon="MessageSquare"
                  active={isActive("/admin/notificacoes")}
                />
              </>
            )}
            {canAdminister(role) && (
              <>
                <NavLink
                  href="/admin/usuarios"
                  label="Usuários"
                  icon="Users"
                  active={isActive("/admin/usuarios")}
                />
                <NavLink
                  href="/admin/auditoria"
                  label="Auditoria"
                  icon="LayoutDashboard"
                  active={isActive("/admin/auditoria")}
                />
              </>
            )}
          </>
        )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white",
      )}
    >
      <Icon name={icon} className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}
