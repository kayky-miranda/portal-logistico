"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type Fmt = "currency" | "number" | "percent";

const COLORS = ["#1f47f5", "#10b981", "#f59e0b", "#dc2626", "#8b5cf6", "#0ea5e9"];

function fmt(v: number, kind: Fmt): string {
  if (kind === "currency") return formatCurrency(v);
  if (kind === "percent") return formatPercent(v);
  return formatNumber(v);
}

function shortDate(v: string): string {
  // yyyy-MM-dd -> dd/MM
  if (typeof v === "string" && v.length === 10) return `${v.slice(8, 10)}/${v.slice(5, 7)}`;
  return v;
}

interface Serie {
  key: string;
  label: string;
  color?: string;
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--chart-tooltip-border)",
  background: "var(--chart-tooltip-bg)",
  color: "var(--chart-tooltip-text)",
  fontSize: 12,
};

// Cor dos eixos sensível ao tema (lida via CSS var)
const axisTick = { fontSize: 11, fill: "var(--chart-axis)" };
const GRID = "var(--chart-grid)";

export function TimeSeriesArea({
  data,
  serie,
  format = "number",
  height = 280,
}: {
  data: Record<string, unknown>[];
  serie: Serie;
  format?: Fmt;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${serie.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={serie.color ?? COLORS[0]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={serie.color ?? COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(v) => fmt(v, format)} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={shortDate}
          formatter={(v: number) => [fmt(v, format), serie.label]}
        />
        <Area
          type="monotone"
          dataKey={serie.key}
          name={serie.label}
          stroke={serie.color ?? COLORS[0]}
          strokeWidth={2}
          fill={`url(#grad-${serie.key})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Gráfico de faturamento: área (valor) + linha de tendência + linha de meta.
 */
export function FaturamentoTrendChart({
  data,
  meta,
  format = "currency",
  height = 320,
}: {
  data: Record<string, unknown>[];
  meta?: number;
  format?: Fmt;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} />
        <YAxis tick={axisTick} width={70} tickFormatter={(v) => fmt(v, format)} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={(v: number) => fmt(v, format)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {meta !== undefined && meta > 0 && (
          <ReferenceLine
            y={meta}
            stroke="#dc2626"
            strokeDasharray="6 4"
            label={{ value: `Meta ${fmt(meta, format)}`, position: "insideTopRight", fontSize: 11, fill: "#dc2626" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="valor"
          name="Faturamento"
          stroke={COLORS[0]}
          strokeWidth={2}
          fill="url(#grad-fat)"
        />
        <Line
          type="monotone"
          dataKey="tendencia"
          name="Tendência"
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({
  data,
  series,
  format = "number",
  height = 280,
}: {
  data: Record<string, unknown>[];
  series: Serie[];
  format?: Fmt;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} />
        <YAxis tick={axisTick} width={60} tickFormatter={(v) => fmt(v, format)} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={(v: number) => fmt(v, format)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  series,
  format = "number",
  height = 280,
}: {
  data: Record<string, unknown>[];
  series: Serie[];
  format?: Fmt;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} />
        <YAxis tick={axisTick} width={60} tickFormatter={(v) => fmt(v, format)} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={(v: number) => fmt(v, format)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? COLORS[i % COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  format = "number",
  height = 280,
}: {
  data: { name: string; value: number }[];
  format?: Fmt;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v, format)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
