"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canUpload } from "@/lib/roles";
import { getModule, type DatasetKey } from "@/lib/modules";
import { parseSpreadsheet } from "@/lib/parsers";
import { processRows } from "@/lib/processing";
import { evaluateAlerts } from "@/lib/alerts/engine";
import { dispatchAlertNotifications } from "@/lib/notify";

export interface UploadState {
  ok?: boolean;
  error?: string;
  summary?: {
    dataset: string;
    rowsTotal: number;
    rowsOk: number;
    rowsError: number;
    alertsCreated: number;
    errors: { row: number; message: string }[];
  };
}

// Em hospedagem serverless (Vercel) o diretório do projeto é somente-leitura;
// só /tmp é gravável (e efêmero). Como os dados do arquivo são persistidos no
// banco, manter o arquivo bruto é apenas um "best-effort".
const STORAGE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "portal-storage")
  : path.join(process.cwd(), "storage");
const ALLOWED_EXT = [".csv", ".xlsx", ".xls"];

export async function uploadAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await getSession();
  if (!session || !canUpload(session.role)) {
    return { error: "Sem permissão para enviar arquivos." };
  }
  if (!session.org) {
    return { error: "Selecione/entre em uma organização para enviar dados." };
  }
  const org = session.org;

  const datasetKey = String(formData.get("dataset") || "") as DatasetKey;
  const file = formData.get("file") as File | null;

  const moduleSpec = getModule(datasetKey);
  if (!moduleSpec || moduleSpec.dataset === null) {
    return { error: "Módulo de destino inválido." };
  }
  if (!file || file.size === 0) {
    return { error: "Selecione um arquivo." };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return { error: `Extensão não suportada (${ext}). Use .csv, .xlsx ou .xls.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Salva o arquivo bruto (best-effort). Se o disco for somente-leitura
  // (serverless), apenas registra o aviso — os dados ainda são processados
  // e gravados no banco normalmente.
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  try {
    await mkdir(STORAGE_DIR, { recursive: true });
    await writeFile(path.join(STORAGE_DIR, safeName), buffer);
  } catch (err) {
    console.warn("[upload] arquivo bruto não persistido (disco efêmero/somente-leitura):", err);
  }

  // Registra o upload como PROCESSING.
  const upload = await prisma.upload.create({
    data: {
      organizationId: org,
      filename: file.name,
      storagePath: safeName,
      dataset: datasetKey,
      status: "PROCESSING",
      source: "upload",
      uploadedById: session.sub,
    },
  });

  try {
    const rows = parseSpreadsheet(buffer);
    const result = await processRows(org, datasetKey, rows, upload.id);

    const hadData = result.rowsOk > 0;
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        status: hadData ? "DONE" : "ERROR",
        rowsTotal: result.rowsTotal,
        rowsOk: result.rowsOk,
        rowsError: result.rowsError,
        errorMessage:
          result.errors.length > 0
            ? result.errors.slice(0, 5).map((e) => `L${e.row}: ${e.message}`).join(" | ")
            : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: org,
        userId: session.sub,
        action: "UPLOAD",
        target: datasetKey,
        detail: `${file.name} (${result.rowsOk}/${result.rowsTotal} linhas)`,
      },
    });

    // Recalcula alertas do módulo e dispara notificações.
    let alertsCreated = 0;
    if (hadData) {
      const created = await evaluateAlerts(org, moduleSpec.key);
      alertsCreated = created.length;
      for (const a of created) {
        await dispatchAlertNotifications(a);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/modulos/${moduleSpec.key}`);
    revalidatePath("/upload");
    revalidatePath("/alertas");

    return {
      ok: hadData,
      error: hadData
        ? undefined
        : "Nenhuma linha válida encontrada. Verifique o arquivo.",
      summary: {
        dataset: moduleSpec.label,
        rowsTotal: result.rowsTotal,
        rowsOk: result.rowsOk,
        rowsError: result.rowsError,
        alertsCreated,
        errors: result.errors.slice(0, 10),
      },
    };
  } catch (err) {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "ERROR", errorMessage: String(err) },
    });
    return { error: `Falha ao processar: ${String(err)}` };
  }
}

/** Remove os registros importados por um upload, da tabela do seu dataset. */
async function deleteDatasetRows(dataset: string, uploadId: string, organizationId: string) {
  const where = { uploadId, organizationId };
  switch (dataset) {
    case "faturamento": return prisma.faturamento.deleteMany({ where });
    case "demanda": return prisma.demanda.deleteMany({ where });
    case "producao": return prisma.producao.deleteMany({ where });
    case "frete": return prisma.frete.deleteMany({ where });
    default: return { count: 0 };
  }
}

/**
 * Exclui um upload: remove os dados que ele importou, o arquivo salvo e o
 * próprio registro. Escopado à organização do usuário.
 */
export async function deleteUpload(formData: FormData) {
  const session = await getSession();
  if (!session || !canUpload(session.role) || !session.org) {
    throw new Error("Sem permissão para excluir uploads.");
  }
  const org = session.org;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const upload = await prisma.upload.findFirst({ where: { id, organizationId: org } });
  if (!upload) return; // não é da org / não existe

  // 1) remove os dados importados por este upload
  const removed = await deleteDatasetRows(upload.dataset, id, org);

  // 2) remove o arquivo salvo (uploads manuais; ERP não tem arquivo)
  if (upload.storagePath) {
    await unlink(path.join(STORAGE_DIR, upload.storagePath)).catch(() => {});
  }

  // 3) remove o registro do upload
  await prisma.upload.deleteMany({ where: { id, organizationId: org } });

  await prisma.auditLog.create({
    data: {
      organizationId: org,
      userId: session.sub,
      action: "UPLOAD_DELETE",
      target: upload.dataset,
      detail: `${upload.filename} (${removed.count} linha(s) removida(s))`,
    },
  });

  revalidatePath("/upload");
  revalidatePath("/dashboard");
  revalidatePath(`/modulos/${upload.dataset}`);
}
