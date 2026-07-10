"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (n: unknown) => `$${Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtFecha = (f: unknown) => {
  const [, m, d] = String(f).split("-");
  return `${d}/${m}`;
};

export default function TrendArea({ data }: { data: { fecha: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#2c2c2a" />
        <XAxis
          dataKey="fecha"
          tickFormatter={fmtFecha}
          tickLine={false}
          axisLine={{ stroke: "#383835" }}
          tick={{ fill: "#898781", fontSize: 12 }}
        />
        <YAxis hide domain={[0, (max: number) => max * 1.15]} />
        <Tooltip
          contentStyle={{ background: "#1f1f1f", border: "1px solid #383835", borderRadius: 8, fontSize: 12 }}
          labelFormatter={fmtFecha}
          labelStyle={{ color: "#f2ede6" }}
          itemStyle={{ color: "#f2ede6" }}
          formatter={(value: unknown) => [fmt(value), "Ventas"]}
        />
        <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
