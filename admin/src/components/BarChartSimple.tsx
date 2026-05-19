"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface BarChartSimpleProps {
  // Recharts is loosely typed internally; we accept any record-shaped row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: readonly any[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}

export function BarChartSimple({
  data,
  xKey,
  yKey,
  color = "#FFEB3B",
  height = 220,
}: BarChartSimpleProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke="#A1A1AA"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#A1A1AA"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#141414",
            border: "1px solid #2A2A2A",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
          cursor={{ fill: "rgba(255, 87, 34, 0.08)" }}
          labelStyle={{ color: "#A1A1AA" }}
        />
        <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
