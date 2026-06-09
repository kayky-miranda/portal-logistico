import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAdminister, ROLES, ROLE_LABELS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { UserForm } from "./user-form";
import { updateUser, resetPassword } from "./actions";
import { Save, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session || !canAdminister(session.role)) {
    return (
      <div>
        <PageHeader title="Usuários" icon="Users" />
        <EmptyState title="Acesso restrito" description="Apenas Administradores." icon="Users" />
      </div>
    );
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.org ?? null },
    orderBy: { createdAt: "asc" },
  });
  // Papéis atribuíveis dentro da organização (sem SUPER_ADMIN).
  const assignableRoles = ROLES.filter((r) => r !== "SUPER_ADMIN");

  return (
    <div>
      <PageHeader
        title="Usuários e Permissões"
        subtitle="Cadastre usuários e defina papéis de acesso"
        icon="Users"
      />

      <Card title="Novo usuário" className="mb-6">
        <UserForm />
      </Card>

      <Card title={`Usuários (${users.length})`}>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {u.name}{" "}
                    {u.id === session.sub && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">(você)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                </div>
                <span className={`badge ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                  {u.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <form action={updateUser} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:items-end">
                  <input type="hidden" name="id" value={u.id} />
                  <div>
                    <label className="label">Papel</label>
                    <select name="role" defaultValue={u.role} className="input">
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Ativo</label>
                    <select name="active" defaultValue={u.active.toString()} className="input">
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">WhatsApp</label>
                    <input name="phone" defaultValue={u.phone ?? ""} className="input" />
                  </div>
                  <button className="btn-secondary"><Save className="h-4 w-4" /> Salvar</button>
                </form>

                <form action={resetPassword} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="flex-1">
                    <label className="label">Nova senha</label>
                    <input name="password" type="text" className="input" placeholder="mín. 6 caracteres" />
                  </div>
                  <button className="btn-secondary"><KeyRound className="h-4 w-4" /> Redefinir</button>
                </form>
              </div>

              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Criado em {formatDateTime(u.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
