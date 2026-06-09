import { NextRequest, NextResponse } from "next/server";
import { getModule } from "@/lib/modules";

// Gera um CSV-modelo (cabeçalho + 1 linha de exemplo) para o dataset.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const { dataset } = await params;
  const moduleSpec = getModule(dataset);
  if (!moduleSpec || moduleSpec.dataset === null) {
    return NextResponse.json({ error: "Dataset inválido" }, { status: 404 });
  }

  const headers = moduleSpec.columns.map((c) => c.field);
  const sample = moduleSpec.sampleRow || {};
  const sampleLine = headers.map((h) => String(sample[h] ?? "")).join(";");
  const csv = `${headers.join(";")}\n${sampleLine}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modelo-${dataset}.csv"`,
    },
  });
}
