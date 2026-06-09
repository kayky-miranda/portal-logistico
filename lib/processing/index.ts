import { prisma } from "@/lib/db";
import { getModule, type DatasetKey, type ColumnSpec } from "@/lib/modules";
import {
  type RawRow,
  normalizeHeader,
  coerceNumber,
  coerceDate,
} from "@/lib/parsers";

export interface ProcessResult {
  rowsTotal: number;
  rowsOk: number;
  rowsError: number;
  errors: { row: number; message: string }[];
}

// Mapeia o dataset para o nome do módulo (que carrega as ColumnSpec).
const DATASET_MODULE: Record<DatasetKey, string> = {
  faturamento: "faturamento",
  demanda: "demanda",
  producao: "producao",
  frete: "frete",
};

/**
 * Constrói um mapa cabeçalho-normalizado -> nome real da coluna a partir das
 * chaves da primeira linha.
 */
function buildHeaderIndex(row: RawRow): Map<string, string> {
  const idx = new Map<string, string>();
  for (const key of Object.keys(row)) {
    idx.set(normalizeHeader(key), key);
  }
  return idx;
}

/** Resolve, para cada ColumnSpec, qual chave do arquivo a alimenta. */
function resolveColumns(
  columns: ColumnSpec[],
  headerIndex: Map<string, string>,
): { spec: ColumnSpec; sourceKey: string | null }[] {
  return columns.map((spec) => {
    let sourceKey: string | null = null;
    for (const alias of spec.aliases) {
      const found = headerIndex.get(normalizeHeader(alias));
      if (found) {
        sourceKey = found;
        break;
      }
    }
    return { spec, sourceKey };
  });
}

function coerce(spec: ColumnSpec, value: unknown): number | Date | string | null {
  if (spec.type === "number") return coerceNumber(value);
  if (spec.type === "date") return coerceDate(value);
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Valida e grava as linhas no data warehouse para o dataset informado.
 */
export async function processRows(
  organizationId: string,
  dataset: DatasetKey,
  rows: RawRow[],
  uploadId?: string,
): Promise<ProcessResult> {
  const moduleSpec = getModule(DATASET_MODULE[dataset]);
  if (!moduleSpec) throw new Error(`Módulo não encontrado para dataset ${dataset}`);

  const result: ProcessResult = {
    rowsTotal: rows.length,
    rowsOk: 0,
    rowsError: 0,
    errors: [],
  };

  if (rows.length === 0) {
    result.errors.push({ row: 0, message: "Arquivo sem linhas de dados." });
    return result;
  }

  const headerIndex = buildHeaderIndex(rows[0]);
  const resolved = resolveColumns(moduleSpec.columns, headerIndex);

  // Falta alguma coluna obrigatória? Erro global.
  const missingRequired = resolved
    .filter((r) => r.spec.required && !r.sourceKey)
    .map((r) => r.spec.label);
  if (missingRequired.length > 0) {
    result.rowsError = rows.length;
    result.errors.push({
      row: 0,
      message: `Colunas obrigatórias ausentes: ${missingRequired.join(", ")}.`,
    });
    return result;
  }

  const valid: Record<string, number | Date | string | null>[] = [];

  rows.forEach((row, i) => {
    const record: Record<string, number | Date | string | null> = {};
    const rowErrors: string[] = [];

    for (const { spec, sourceKey } of resolved) {
      const raw = sourceKey ? row[sourceKey] : null;
      const value = coerce(spec, raw);
      if (spec.required && (value === null || value === "")) {
        rowErrors.push(`"${spec.label}" inválido/vazio`);
      }
      record[spec.field] = value;
    }

    if (rowErrors.length > 0) {
      result.rowsError++;
      if (result.errors.length < 50) {
        result.errors.push({ row: i + 2, message: rowErrors.join("; ") });
      }
    } else {
      valid.push(record);
    }
  });

  result.rowsOk = valid.length;

  if (valid.length > 0) {
    await persist(organizationId, dataset, valid, uploadId);
  }

  return result;
}

async function persist(
  organizationId: string,
  dataset: DatasetKey,
  rows: Record<string, number | Date | string | null>[],
  uploadId?: string,
): Promise<void> {
  const uid = uploadId ?? null;
  // SQLite via Prisma aceita createMany. Convertemos para o shape do modelo.
  switch (dataset) {
    case "faturamento":
      await prisma.faturamento.createMany({
        data: rows.map((r) => ({
          organizationId,
          uploadId: uid,
          data: r.data as Date,
          cliente: (r.cliente as string) ?? null,
          segmento: (r.segmento as string) ?? null,
          valor: (r.valor as number) ?? 0,
        })),
      });
      break;
    case "demanda":
      await prisma.demanda.createMany({
        data: rows.map((r) => ({
          organizationId,
          uploadId: uid,
          data: r.data as Date,
          sku: (r.sku as string) ?? null,
          segmento: (r.segmento as string) ?? null,
          demanda: (r.demanda as number) ?? 0,
          realizado: (r.realizado as number) ?? 0,
        })),
      });
      break;
    case "producao":
      await prisma.producao.createMany({
        data: rows.map((r) => ({
          organizationId,
          uploadId: uid,
          data: r.data as Date,
          linha: (r.linha as string) ?? null,
          produto: (r.produto as string) ?? null,
          programado: (r.programado as number) ?? 0,
          realizado: (r.realizado as number) ?? 0,
        })),
      });
      break;
    case "frete":
      await prisma.frete.createMany({
        data: rows.map((r) => ({
          organizationId,
          uploadId: uid,
          data: r.data as Date,
          transportadora: (r.transportadora as string) ?? null,
          rota: (r.rota as string) ?? null,
          custo: (r.custo as number) ?? 0,
        })),
      });
      break;
  }
}
