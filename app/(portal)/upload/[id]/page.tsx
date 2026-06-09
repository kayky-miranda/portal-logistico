import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgId } from "@/lib/tenant";
import { getModule } from "@/lib/modules";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const MAX_ROWS = 500;

async function loadRows(dataset: string, uploadId: string, organizationId: string): Promise<Record<string, unknown>[]> {
  const args = { where: { uploadId, organizationId }, orderBy: { data: "desc" as const }, take: MAX_ROWS };
  switch (dataset) {
    case "faturamento": return prisma.faturamento.findMany(args);
    case "demanda": return prisma.demanda.findMany(args);
    case "producao": return prisma.producao.findMany(args);
    case "frete": return prisma.frete.findMany(args);
    default: return [];
  }
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

export default async function UploadViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrgId();

  const upload = await prisma.upload.findFirst({ where: { id, organizationId: org } });
  if (!upload) notFound();

  const moduleSpec = getModule(upload.dataset);
  const columns = moduleSpec?.columns ?? [];
  const rows = await loadRows(upload.dataset, id, org);

  return (
    <div>
      <PageHeader
        title={`Dados de: ${upload.filename}`}
        subtitle={`${moduleSpec?.label ?? upload.dataset} · ${upload.rowsOk}/${upload.rowsTotal} linhas · ${formatDateTime(upload.createdAt)}`}
        icon="Upload"
        action={
          <Link href="/upload" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />

      <Card title={`Registros importados (${rows.length}${rows.length >= MAX_ROWS ? "+" : ""})`}>
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={upload.status} />
          {upload.errorMessage && (
            <span className="text-xs text-red-500">{upload.errorMessage}</span>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Sem registros para mostrar"
            description="Este upload não tem linhas vinculadas (uploads antigos, anteriores a este recurso, não guardam o vínculo)."
            icon="Upload"
          />
        ) : (
          <>
            {rows.length >= MAX_ROWS && (
              <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
                Mostrando as primeiras {MAX_ROWS} linhas (mais recentes).
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                    {columns.map((c) => (
                      <th key={c.field} className="pb-2 pr-4">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      {columns.map((c) => (
                        <td key={c.field} className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">
                          {renderCell((r as Record<string, unknown>)[c.field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
