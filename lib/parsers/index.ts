import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

/** Detecta se o buffer é um arquivo binário de planilha (xlsx/xls). */
function isBinarySpreadsheet(buffer: Buffer): boolean {
  // .xlsx (zip) começa com "PK" (0x50 0x4B); .xls (OLE) com 0xD0 0xCF 0x11 0xE0.
  if (buffer.length < 4) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
  return isZip || isOle;
}

/** Detecta o delimitador do CSV a partir da linha de cabeçalho. */
function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const c of candidates) {
    const count = headerLine.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

/** Quebra uma linha CSV respeitando aspas duplas. */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parser CSV próprio — preserva os valores como texto (sem reinterpretar). */
function parseCsv(text: string): RawRow[] {
  // remove BOM
  text = text.replace(/^﻿/, "");
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());

  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const row: RawRow = {};
    headers.forEach((h, idx) => {
      const v = (cells[idx] ?? "").trim();
      row[h] = v === "" ? null : v;
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Lê um arquivo .csv/.xlsx/.xls (Buffer) e retorna as linhas como objetos
 * { cabeçalho: valor }. CSV é parseado como texto puro (preserva formato
 * brasileiro de números/datas); xlsx/xls usam o SheetJS.
 */
export function parseSpreadsheet(buffer: Buffer): RawRow[] {
  if (isBinarySpreadsheet(buffer)) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  }
  return parseCsv(buffer.toString("utf8"));
}

/** Normaliza um cabeçalho para comparação (sem acentos, só alfanumérico). */
export function normalizeHeader(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Converte valor para número aceitando formato brasileiro (1.234,56). */
export function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isFinite(value) ? value : null;
  let s = String(value).trim().replace(/[R$\s]/g, "");
  if (s === "") return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/** Converte valor para Date aceitando Date, serial Excel e strings comuns. */
export function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    // serial Excel (dias desde 1899-12-30)
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  // dd/MM/yyyy ou dd-MM-yyyy
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const [, dd, mm, yy] = br;
    const day = Number(dd);
    const month = Number(mm);
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  // yyyy-MM-dd (ISO)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, dd] = iso;
    const d = new Date(Number(y), Number(m) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}
