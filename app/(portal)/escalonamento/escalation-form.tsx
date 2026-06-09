"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEscalation, addContact, removeContact, type EscalationState } from "./actions";
import { MODULES } from "@/lib/modules";
import { Siren, CheckCircle2, AlertCircle, Plus, X, MessageCircle } from "lucide-react";

const initial: EscalationState = {};

const NIVEIS = [
  { value: "RED", label: "RED ALERT (≤ 1 dias)" },
  { value: "YELLOW", label: "YELLOW ALERT (≤ 3 dias)" },
];

export interface ContactItem {
  id: string;
  email: string;
  phone?: string | null;
  active: boolean;
}

/** Lista de destinatários salvos: marque quem recebe (e-mail + WhatsApp se tiver telefone). */
function Recipients({ contacts }: { contacts: ContactItem[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const value = email.trim();
    if (!value) return;
    start(async () => {
      const res = await addContact(value, phone.trim() || undefined);
      if (res.ok) {
        setEmail("");
        setPhone("");
        setErr(null);
        router.refresh();
      } else {
        setErr(res.error ?? "Erro ao adicionar.");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await removeContact(id);
      router.refresh();
    });
  }

  return (
    <div>
      <label className="label">Destinatários — marque quem recebe este escalonamento</label>

      {contacts.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
          Nenhum destinatário salvo ainda. Adicione abaixo — fica salvo para os próximos escalonamentos.
        </p>
      ) : (
        <div className="mb-2 space-y-1 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="recipientEmails"
                value={c.email}
                defaultChecked={c.active}
                id={`c-${c.id}`}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              <label htmlFor={`c-${c.id}`} className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="truncate">{c.email}</span>
                {c.phone ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    title="Também recebe por WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3" /> {c.phone}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">só e-mail</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={pending}
                className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
                title="Remover da lista"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="input"
          placeholder="e-mail (ex.: pessoa@empresa.com)"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="input sm:max-w-[210px]"
          placeholder="WhatsApp (opcional) +5511999999999"
        />
        <button type="button" onClick={add} disabled={pending} className="btn-secondary whitespace-nowrap">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
        Marque quem recebe este escalonamento. Quem tiver WhatsApp cadastrado recebe também por WhatsApp.
      </p>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

export function EscalationForm({ contacts }: { contacts: ContactItem[] }) {
  const [state, formAction, pending] = useActionState(createEscalation, initial);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nível do alerta</label>
          <select name="nivel" className="input" defaultValue="RED">
            {NIVEIS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Módulo relacionado</label>
          <select name="module" className="input" defaultValue="producao">
            <option value="geral">Geral</option>
            {MODULES.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Fornecedor/Cliente</label>
        <input name="fornecedorCliente" required className="input" placeholder="Ex.: SCANIA" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Componente — código</label>
          <input name="componenteCodigo" className="input" placeholder="Ex.: 1516890" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Componente — descrição</label>
          <input name="componenteDescricao" className="input" placeholder="Ex.: Prateleira High" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Origem do material</label>
          <input name="origemMaterial" className="input" placeholder="Ex.: ACABADO" />
        </div>
        <div>
          <label className="label">Motivo</label>
          <input name="motivo" required className="input" placeholder="Ex.: ATRASO DE ENTREGAS" />
        </div>
      </div>

      <div>
        <label className="label">Observação</label>
        <textarea
          name="observacao"
          rows={4}
          className="input resize-y"
          placeholder="Detalhe o problema, impacto e causas. Este texto vai na mensagem de e-mail/WhatsApp."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Consumo (CMD)</label>
          <input name="consumoCmd" type="text" inputMode="decimal" className="input" placeholder="134" />
        </div>
        <div>
          <label className="label">Estoque Plascar</label>
          <input name="estoquePlascar" type="text" inputMode="decimal" className="input" placeholder="10" />
        </div>
        <div>
          <label className="label">Setor Produtivo</label>
          <input name="setorProdutivo" className="input" placeholder="MONTAGEM" />
        </div>
        <div>
          <label className="label">Cobertura no Cliente</label>
          <input name="coberturaCliente" type="text" inputMode="decimal" className="input" placeholder="2" />
        </div>
      </div>

      <Recipients contacts={contacts} />

      <div>
        <label className="label">WhatsApp avulso (opcional)</label>
        <input name="contactPhones" className="input" placeholder="+5511999999999, +5511888888888" />
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          Para números que não estão na lista acima. Separe vários por vírgula.
        </p>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Se nenhum destinatário for marcado/informado, o escalonamento é enviado
        automaticamente para Gestores e Administradores (ou para o e-mail configurado no sistema).
      </p>

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && state.message && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {state.message}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-danger">
        <Siren className="h-4 w-4" />
        {pending ? "Enviando..." : "Abrir e disparar escalonamento"}
      </button>
    </form>
  );
}
