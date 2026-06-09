import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getModule, type DatasetKey } from "@/lib/modules";
import { parseSpreadsheet, type RawRow } from "@/lib/parsers";
import { processRows } from "@/lib/processing";
import { evaluateAlerts } from "@/lib/alerts/engine";
import { dispatchAlertNotifications } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: DatasetKey[] = ["faturamento", "demanda", "producao", "frete"];

/** Extrai a API key do header (x-api-key ou Authorization: Bearer/ApiKey). */
function getApiKey(req: NextRequest): string | null {
  const direct = req.headers.get("x-api-key");
  if (direct) return direct.trim();
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^(?:Bearer|ApiKey)\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

/**
 * Conector de ERP — ingestão de dados por dataset.
 *
 *   POST /api/ingest/{faturamento|demanda|producao|frete}
 *   Header: x-api-key: <API key da organização>
 *   Body (JSON): [{ "data": "2026-05-01", "valor": 1234.56, ... }]   ou
 *                { "rows": [ ... ] }
 *   Body (CSV):  Content-Type: text/csv  com o conteúdo do arquivo
 *
 * As colunas seguem os mesmos nomes/aliases dos modelos de upload.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const { dataset } = await params;
  if (!VALID.includes(dataset as DatasetKey)) {
    return json(400, { error: `Dataset inválido. Use: ${VALID.join(", ")}.` });
  }
  const datasetKey = dataset as DatasetKey;
  const moduleSpec = getModule(datasetKey);
  if (!moduleSpec) return json(400, { error: "Dataset desconhecido." });

  // ---- Autenticação por API key ----
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return json(401, { error: "API key ausente (header x-api-key)." });
  }
  const org = await prisma.organization.findUnique({ where: { apiKey } });
  if (!org || !org.active) {
    return json(401, { error: "API key inválida ou organização inativa." });
  }

  // ---- Lê as linhas do corpo (JSON ou CSV) ----
  let rows: RawRow[];
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const parsed = await req.json();
      const arr = Array.isArray(parsed) ? parsed : parsed?.rows;
      if (!Array.isArray(arr)) {
        return json(400, { error: "JSON deve ser um array de objetos ou { rows: [...] }." });
      }
      rows = arr as RawRow[];
    } else {
      // CSV/texto: usa o mesmo parser dos uploads.
      const text = await req.text();
      if (!text.trim()) return json(400, { error: "Corpo vazio." });
      rows = parseSpreadsheet(Buffer.from(text, "utf8"));
    }
  } catch (err) {
    return json(400, { error: `Não foi possível ler o corpo: ${String(err)}` });
  }

  if (rows.length === 0) {
    return json(400, { error: "Nenhuma linha recebida." });
  }

  // ---- Registra o upload (origem ERP) e processa ----
  const upload = await prisma.upload.create({
    data: {
      organizationId: org.id,
      filename: `erp-${datasetKey}-${new Date().toISOString()}`,
      storagePath: "",
      dataset: datasetKey,
      status: "PROCESSING",
      source: "erp",
    },
  });

  try {
    const result = await processRows(org.id, datasetKey, rows, upload.id);
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
        organizationId: org.id,
        action: "ERP_INGEST",
        target: datasetKey,
        detail: `${result.rowsOk}/${result.rowsTotal} linhas via API`,
      },
    });

    let alertsCreated = 0;
    if (hadData) {
      const created = await evaluateAlerts(org.id, moduleSpec.key);
      alertsCreated = created.length;
      for (const a of created) await dispatchAlertNotifications(a);
    }

    return json(hadData ? 200 : 422, {
      ok: hadData,
      dataset: datasetKey,
      organization: org.slug,
      rowsTotal: result.rowsTotal,
      rowsOk: result.rowsOk,
      rowsError: result.rowsError,
      alertsCreated,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "ERROR", errorMessage: String(err) },
    });
    return json(500, { error: `Falha ao processar: ${String(err)}` });
  }
}
