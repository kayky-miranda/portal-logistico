"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";
import { LogIn, AlertCircle } from "lucide-react";

const initial: LoginState = {};

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="voce@empresa.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        <LogIn className="h-4 w-4" />
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
