"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useCurrency } from "@/context/CurrencyContext";
import type { CategorySummary } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

interface PLBarChartProps {
  categories: CategorySummary[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategorySummary }>;
}) {
  const { format } = useCurrency();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isPos = d.pnl >= 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{d.name}</p>
      <p className={`text-sm font-medium ${isPos ? "text-emerald-500" : "text-red-500"}`}>
        P&L: {isPos ? "+" : ""}{format(d.pnl)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Return: {(d.netChange * 100).toFixed(2)}%
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Invested: {format(d.purchaseAmount)}
      </p>
    </div>
  );
}

export function PLBarChart({ categories }: PLBarChartProps) {
  const { format } = useCurrency();
  const data = categories.filter((c) => c.purchaseAmount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L by Category</CardTitle>
      </CardHeader>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => format(v, true)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
          <ReferenceLine x={0} stroke="#475569" strokeWidth={1} />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
