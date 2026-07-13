"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsDarkMode } from "@/lib/useIsDarkMode";

const fmt = (n: unknown) => `$${Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtCompacto = (n: unknown) =>
  `$${Number(n ?? 0).toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 })}`;
const fmtFecha = (f: unknown) => {
  const [, m, d] = String(f).split("-");
  return `${d}/${m}`;
};

const TEMA = {
  light: { grid: "#e5e5e5", axis: "#a3a3a3", tick: "#525252", tooltipBg: "#ffffff", tooltipBorder: "#e5e5e5", tooltipText: "#171717", dot: "#ffffff" },
  dark: { grid: "#2c2c2a", axis: "#383835", tick: "#898781", tooltipBg: "#1f1f1f", tooltipBorder: "#383835", tooltipText: "#f2ede6", dot: "#1f1f1f" },
};

export default function TrendArea({ data }: { data: { fecha: string; total: number }[] }) {
  const isDark = useIsDarkMode();
  const t = isDark ? TEMA.dark : TEMA.light;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="fecha"
          tickFormatter={fmtFecha}
          tickLine={false}
          axisLine={{ stroke: t.axis }}
          tick={{ fill: t.tick, fontSize: 12 }}
        />
        <YAxis
          tickFormatter={fmtCompacto}
          tickLine={false}
          axisLine={false}
          tick={{ fill: t.tick, fontSize: 11 }}
          width={44}
          domain={[0, (max: number) => max * 1.15]}
        />
        <Tooltip
          contentStyle={{
            background: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: t.tooltipText, fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: t.tooltipText }}
          labelFormatter={fmtFecha}
          formatter={(value: unknown) => [fmt(value), "Ventas"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#f59e0b"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          activeDot={{ r: 5, stroke: "#f59e0b", strokeWidth: 2, fill: t.dot }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
