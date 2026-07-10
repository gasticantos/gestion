"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type BarDatum = { name: string; value: number; color: string };

const fmt = (n: unknown) => `$${Number(n ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export default function CategoricalBarChart({ data, height = 220 }: { data: BarDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={{ stroke: "#383835" }}
          tick={{ fill: "#898781", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#1f1f1f",
            border: "1px solid #383835",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#f2ede6" }}
          itemStyle={{ color: "#f2ede6" }}
          formatter={(value: unknown) => [fmt(value), ""]}
        />
        <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="right" formatter={fmt} fill="#c3c2b7" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
