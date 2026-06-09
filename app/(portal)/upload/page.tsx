import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canUpload } from "@/lib/roles";
import { UPLOADABLE_MODULES, getModule } from "@/lib/modules";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { UploadForm } from "./upload-form";
import { ConfirmDeleteButton } from "./delete-button";
import { deleteUpload } from "./actions";
import { Download, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await getSession();
  const allowed = session && canUpload(session.role);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Upload de Arquivo" icon="Upload" />
        <EmptyState
          title="Acesso restrito"
          description="Apenas Analistas, Gestores e Administradores podem enviar arquivos."
          icon="Upload"
        />
      </div>
    );
  }

  const recent = await prisma.upload.findMany({
    where: { organizationId: session.org ?? "" },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Upload de Arquivo"
        subtitle="Alimente os módulos com os relatórios diários (.csv, .xlsx, .xls)"
        icon="Upload"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <UploadForm />

          <Card title="Modelos de planilha" className="mt-6">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Baixe um modelo com os cabeçalhos esperados por módulo:
            </p>
            <div className="flex flex-wrap gap-2">
              {UPLOADABLE_MODULES.map((m) => (
                <a
                  key={m.key}
                  href={`/api/template/${m.key}`}
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  {m.label}
                </a>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Uploads recentes">
          {recent.length === 0 ? (
            <EmptyState title="Nenhum upload ainda" icon="Upload" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                    <th className="pb-2">Arquivo</th>
                    <th className="pb-2">Módulo</th>
                    <th className="pb-2">Linhas</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{u.filename}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {u.uploadedBy?.name ?? (u.source === "erp" ? "ERP (API)" : "—")} · {formatDateTime(u.createdAt)}
                        </p>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">
                        {getModule(u.dataset)?.label ?? u.dataset}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">
                        {u.rowsOk}/{u.rowsTotal}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/upload/${u.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                            title="Visualizar dados"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {allowed && (
                            <form action={deleteUpload}>
                              <input type="hidden" name="id" value={u.id} />
                              <ConfirmDeleteButton />
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
