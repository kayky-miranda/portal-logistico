"use client";

import { useActionState } from "react";
import { createOrganization, type OrgState } from "./actions";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";

const initial: OrgState = {};

export function OrgForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label">Nome da organização (cliente)</label>
        <input name="name" required className="input" placeholder="Ex.: Plascar Componentes" />
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Administrador inicial desta organização
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Nome</label>
          <input name="adminName" required className="input" placeholder="Nome do admin" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input name="adminEmail" type="email" required className="input" placeholder="admin@cliente.com" />
        </div>
        <div>
          <label className="label">Senha</label>
          <input name="adminPassword" type="text" required className="input" placeholder="mín. 6 caracteres" />
        </div>
      </div>

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {state.message}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        <Building2 className="h-4 w-4" /> {pending ? "Criando..." : "Criar organização"}
      </button>
    </form>
  );
}
