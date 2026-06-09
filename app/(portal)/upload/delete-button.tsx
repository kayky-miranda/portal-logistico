"use client";

import { Trash2 } from "lucide-react";

/** Botão de submit que confirma antes de excluir o upload (ação destrutiva). */
export function ConfirmDeleteButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm("Excluir este upload e TODOS os dados que ele importou? Esta ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
      title="Excluir upload e seus dados"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
