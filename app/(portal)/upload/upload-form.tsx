"use client";

import { useActionState } from "react";
import { uploadAction, type UploadState } from "./actions";
import { UPLOADABLE_MODULES } from "@/lib/modules";
import { Icon } from "@/components/icon";
import { CheckCircle2, AlertCircle, Upload as UploadIcon } from "lucide-react";

const initial: UploadState = {};

export function UploadForm({ defaultDataset }: { defaultDataset?: string }) {
  const [state, formAction, pending] = useActionState(uploadAction, initial);

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="dataset">
            Módulo de destino
          </label>
          <select
            id="dataset"
            name="dataset"
            required
            defaultValue={defaultDataset || UPLOADABLE_MODULES[0]?.key}
            className="input"
          >
            {UPLOADABLE_MODULES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="file">
            Arquivo (.csv, .xlsx, .xls)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls"
            required
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary">
          <UploadIcon className="h-4 w-4" />
          {pending ? "Processando..." : "Enviar e processar"}
        </button>
      </form>

      {state.error && !state.summary && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {state.summary && (
        <div
          className={`card border-l-4 p-5 ${
            state.ok ? "border-l-emerald-500" : "border-l-red-500"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {state.ok ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {state.ok ? "Processamento concluído" : "Processado com problemas"} —{" "}
              {state.summary.dataset}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Linhas no arquivo" value={state.summary.rowsTotal} />
            <Stat label="Importadas" value={state.summary.rowsOk} tone="green" />
            <Stat label="Com erro" value={state.summary.rowsError} tone="red" />
            <Stat label="Alertas gerados" value={state.summary.alertsCreated} tone="amber" />
          </div>

          {state.summary.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Detalhes dos erros (até 10):
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                {state.summary.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">Linha {e.row}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-800 dark:text-slate-100",
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
