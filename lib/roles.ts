// Definição central de papéis (RBAC) e suas permissões.
// SUPER_ADMIN é o dono da plataforma (gerencia organizações); não pertence a
// nenhuma organização. Os demais papéis atuam dentro de uma organização.

export const ROLES = ["SUPER_ADMIN", "ADMIN", "GESTOR", "ANALISTA", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin (plataforma)",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  ANALISTA: "Analista",
  VIEWER: "Visualizador",
};

// Hierarquia: número maior = mais privilégios.
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  ANALISTA: 2,
  GESTOR: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

/** Verdadeiro se `role` tem pelo menos o nível de `required`. */
export function hasRoleAtLeast(role: string, required: Role): boolean {
  const r = (ROLE_RANK as Record<string, number>)[role] ?? 0;
  return r >= ROLE_RANK[required];
}

/** Pode enviar/alimentar dados (upload, escalonamento)? */
export function canUpload(role: string): boolean {
  return hasRoleAtLeast(role, "ANALISTA");
}

/** Pode administrar usuários, papéis e regras de alerta (dentro da org)? */
export function canAdminister(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Pode gerenciar regras de alerta e reconhecer alertas? */
export function canManageAlerts(role: string): boolean {
  return hasRoleAtLeast(role, "GESTOR");
}

/** Dono da plataforma: cria/gerencia organizações e API keys. */
export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}
