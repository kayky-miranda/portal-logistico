"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTeamsWebhook, sendTeamsTest, type TeamsState } from "./actions";
import { CheckCircle2, AlertCircle, Send, Save } from "lucide-react";

const initial: TeamsState = {};

export function TeamsConfig({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState(saveTeamsWebhook, initial);
  const router = useRouter();
  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<TeamsState | null>(null);

  const configured = Boolean(current);

  function test() {
    setTestMsg(null);
    startTest(async () => {
      const res = await sendTeamsTest();
      setTestMsg(res);
      router.refresh();
    });
  }

  return (
    <div className="card mb-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Microsoft Teams (gratuito)
        </h3>
        <span
          className={`badge ${
            configured
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {configured ? "Conectado" : "Não configurado"}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Cole a URL do <strong>Webhook de Entrada</strong> gerada no app
        <em> Workflows</em> do Teams (modelo &ldquo;Postar em um canal quando uma
        solicitação de webhook for recebida&rdquo;). Alertas e escalonamentos serão
        postados nesse canal — sem custo, sem janela de 24h.
      </p>

      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="teamsWebhookUrl"
          type="url"
          defaultValue={current ?? ""}
          className="input"
          placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
        />
        <button type="submit" disabled={pending} className="btn-primary whitespace-nowrap">
          <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing || !configured}
          className="btn-secondary whitespace-nowrap"
          title={configured ? "Enviar mensagem de teste" : "Salve a URL primeiro"}
        >
          <Send className="h-4 w-4" /> {testing ? "Enviando..." : "Testar"}
        </button>
      </form>

      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Deixe o campo vazio e salve para remover a integração.
      </p>

      {state.error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" /> {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {state.message}
        </p>
      )}
      {testMsg?.error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" /> {testMsg.error}
        </p>
      )}
      {testMsg?.ok && testMsg.message && (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {testMsg.message}
        </p>
      )}
    </div>
  );
}
