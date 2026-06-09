// Registro central dos módulos do portal. Tudo (navegação, uploads, dashboards)
// é derivado daqui para manter consistência.

export type DatasetKey = "faturamento" | "demanda" | "producao" | "frete";

export interface ColumnSpec {
  /** Nome canônico do campo no banco. */
  field: string;
  /** Rótulo amigável. */
  label: string;
  /** Aceita estes cabeçalhos (case-insensitive) vindos da planilha. */
  aliases: string[];
  /** Tipo para parsing/validação. */
  type: "date" | "number" | "string";
  /** Obrigatório no arquivo? */
  required: boolean;
}

export interface ModuleSpec {
  key: string;
  label: string;
  /** Nome do ícone lucide-react. */
  icon: string;
  description: string;
  /** Dataset alimentado por upload (ou null para módulos derivados). */
  dataset: DatasetKey | null;
  /** Colunas esperadas no arquivo de upload. */
  columns: ColumnSpec[];
  /** Modelo de arquivo (cabeçalho + 1 linha de exemplo) para download. */
  sampleRow?: Record<string, string | number>;
}

export const MODULES: ModuleSpec[] = [
  {
    key: "faturamento",
    label: "Faturamento",
    icon: "DollarSign",
    description: "Faturamento diário por cliente (montadoras e varejo) e segmento, com meta e tendência.",
    dataset: "faturamento",
    columns: [
      { field: "data", label: "Data", aliases: ["data", "date", "dia"], type: "date", required: true },
      { field: "cliente", label: "Cliente", aliases: ["cliente", "client", "customer", "montadora"], type: "string", required: false },
      { field: "segmento", label: "Segmento", aliases: ["segmento", "segment", "categoria"], type: "string", required: false },
      { field: "valor", label: "Valor (R$)", aliases: ["valor", "value", "faturamento", "receita", "total"], type: "number", required: true },
    ],
    sampleRow: { data: "2026-05-01", cliente: "Mercedes-Benz", segmento: "Caminhões", valor: 152300.5 },
  },
  {
    key: "demanda",
    label: "Demanda",
    icon: "BarChart3",
    description: "Demanda e realizado do dia, informados por upload (sem previsão).",
    dataset: "demanda",
    columns: [
      { field: "data", label: "Data", aliases: ["data", "date", "dia"], type: "date", required: true },
      { field: "sku", label: "SKU", aliases: ["sku", "produto", "item", "codigo"], type: "string", required: false },
      { field: "segmento", label: "Segmento", aliases: ["segmento", "segment", "categoria"], type: "string", required: false },
      { field: "demanda", label: "Demanda", aliases: ["demanda", "demand", "qtd_demanda", "demandado", "pedido", "pedidos"], type: "number", required: true },
      { field: "realizado", label: "Realizado", aliases: ["realizado", "realizada", "real", "atendido", "entregue", "qtd_realizada"], type: "number", required: true },
    ],
    sampleRow: { data: "2026-05-01", sku: "SKU-001", segmento: "Varejo", demanda: 1200, realizado: 1100 },
  },
  {
    key: "producao",
    label: "Aderência da Produção",
    icon: "Factory",
    description: "Programado versus realizado na produção (aderência %), com filtro por linha produtiva.",
    dataset: "producao",
    columns: [
      { field: "data", label: "Data", aliases: ["data", "date", "dia"], type: "date", required: true },
      { field: "linha", label: "Linha", aliases: ["linha", "line", "celula"], type: "string", required: false },
      { field: "produto", label: "Produto", aliases: ["produto", "product", "item"], type: "string", required: false },
      { field: "programado", label: "Programado", aliases: ["programado", "planejado", "plan", "planned", "meta"], type: "number", required: true },
      { field: "realizado", label: "Realizado", aliases: ["realizado", "real", "produzido", "actual"], type: "number", required: true },
    ],
    sampleRow: { data: "2026-05-01", linha: "Linha 1", produto: "Produto X", programado: 1000, realizado: 940 },
  },
  {
    key: "frete",
    label: "Fretes",
    icon: "Truck",
    description: "Custos de frete por transportadora e rota.",
    dataset: "frete",
    columns: [
      { field: "data", label: "Data", aliases: ["data", "date", "dia"], type: "date", required: true },
      { field: "transportadora", label: "Transportadora", aliases: ["transportadora", "carrier", "fornecedor"], type: "string", required: false },
      { field: "rota", label: "Rota", aliases: ["rota", "route", "trajeto", "destino"], type: "string", required: false },
      { field: "custo", label: "Custo (R$)", aliases: ["custo", "cost", "valor", "frete"], type: "number", required: true },
    ],
    sampleRow: { data: "2026-05-01", transportadora: "Transp. Alfa", rota: "SP-RJ", custo: 3200 },
  },
  {
    key: "variacao",
    label: "Variação da Demanda",
    icon: "ArrowUpDown",
    description: "Variação da demanda semana a semana (compara todos os arquivos de demanda).",
    dataset: null,
    columns: [],
  },
  {
    key: "forecast",
    label: "Previsão (Forecast)",
    icon: "TrendingUp",
    description: "Previsão de faturamento (baseline estatístico; pronto para IA).",
    dataset: null,
    columns: [],
  },
];

export function getModule(key: string): ModuleSpec | undefined {
  return MODULES.find((m) => m.key === key);
}

export const UPLOADABLE_MODULES = MODULES.filter((m) => m.dataset !== null);

export const DATASET_LABELS: Record<DatasetKey, string> = {
  faturamento: "Faturamento",
  demanda: "Demanda",
  producao: "Produção",
  frete: "Frete",
};
