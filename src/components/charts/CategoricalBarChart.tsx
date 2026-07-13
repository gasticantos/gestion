"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsDarkMode } from "@/lib/useIsDarkMode";

export type BarDatum = { name: string; value: number; color: string };

const fmt = (n: unknown) => `$${Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtCompacto = (n: unknown) =>
  `$${Number(n ?? 0).toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 })}`;

const TEMA = {
  light: { grid: "#e5e5e5", axis: "#a3a3a3", tick: "#525252", tooltipBg: "#ffffff", tooltipBorder: "#e5e5e5", tooltipText: "#171717", label: "#404040" },
  dark: { grid: "#2c2c2a", axis: "#525252", tick: "#a3a3a3", tooltipBg: "#1f1f1f", tooltipBorder: "#383835", tooltipText: "#f2ede6", label: "#d4d4d4" },
};

export default function CategoricalBarChart({ data, height = 260 }: { data: BarDatum[]; height?: number }) {
  const isDark = useIsDarkMode();
  const t = isDark ? TEMA.dark : TEMA.light;
  const rotarEtiquetas = data.length > 5;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 28, right: 12, left: 4, bottom: rotarEtiquetas ? 28 : 4 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={{ stroke: t.axis }}
          tick={{ fill: t.tick, fontSize: 12 }}
          interval={0}
          angle={rotarEtiquetas ? -30 : 0}
          textAnchor={rotarEtiquetas ? "end" : "middle"}
          height={rotarEtiquetas ? 44 : 24}
        />
        <YAxis
          tickFormatter={fmtCompacto}
          tickLine={false}
          axisLine={false}
          tick={{ fill: t.tick, fontSize: 11 }}
          width={44}
        />
        <Tooltip
          cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
          contentStyle={{
            background: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: t.tooltipText, fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: t.tooltipText }}
          formatter={(value: unknown) => [fmt(value), ""]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="top" formatter={fmt} fill={t.label} fontSize={12} fontWeight={600} offset={8} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
