"use client";

import { useActionState } from "react";
import { createUser, type UserState } from "./actions";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { UserPlus, CheckCircle2, AlertCircle } from "lucide-react";

const initial: UserState = {};

export function UserForm() {
  const [state, formAction, pending] = useActionState(createUser, initial);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <div className="lg:col-span-2">
        <label className="label">Nome</label>
        <input name="name" required className="input" />
      </div>
      <div className="lg:col-span-2">
        <label className="label">E-mail</label>
        <input name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label">Senha</label>
        <input name="password" type="text" required className="input" placeholder="mín. 6" />
      </div>
      <div>
        <label className="label">Papel</label>
        <select name="role" className="input" defaultValue="VIEWER">
          {ROLES.filter((r) => r !== "SUPER_ADMIN").map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className="label">WhatsApp (opcional)</label>
        <input name="phone" className="input" placeholder="+5511999999999" />
      </div>

      <div className="lg:col-span-4">
        {state.error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {state.error}
          </div>
        )}
        {state.ok && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {state.message}
          </div>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          <UserPlus className="h-4 w-4" /> {pending ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
