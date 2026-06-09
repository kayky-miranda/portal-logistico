import { Suspense } from "react";
import { Boxes } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Portal Logístico" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Boxes className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Portal Logístico</h1>
          <p className="text-sm text-brand-100">Central de operações</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">Acessar</h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            Entre com suas credenciais para continuar.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="mt-5 rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-600 dark:text-slate-300">Acesso de demonstração</p>
            <p>admin@portal.local · senha: admin123</p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-brand-100">
          © {new Date().getFullYear()} Portal Logístico
        </p>
      </div>
    </div>
  );
}
