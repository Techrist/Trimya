"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface DailyPoint {
  date: string; // dd/MM
  cuts: number;
}

export function CutsChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="cuts-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5722" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#FF5722" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="date"
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
          cursor={{ stroke: "#FF5722", strokeWidth: 1, strokeDasharray: "4 4" }}
          labelStyle={{ color: "#A1A1AA" }}
        />
        <Area
          type="monotone"
          dataKey="cuts"
          stroke="#FF5722"
          strokeWidth={2}
          fill="url(#cuts-grad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
