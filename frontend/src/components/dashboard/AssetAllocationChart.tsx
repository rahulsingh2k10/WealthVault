"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ASSET_COLORS, ASSET_COLOR_LIST } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import type { CategorySummary } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

interface AssetAllocationChartProps {
  categories: CategorySummary[];
}

const RADIAN = Math.PI / 180;

function CustomLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: {
  cx: number; cy: number; midAngle: number;
  innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

function CustomTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: CategorySummary }>;
}) {
  const { format } = useCurrency();
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{d.name}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Current: {format(d.value)}
      </p>
    </div>
  );
}

export function AssetAllocationChart({ categories }: AssetAllocationChartProps) {
  const data = categories
    .filter((c) => c.currentAmount > 0)
    .map((c, i) => ({
      ...c,
      color: ASSET_COLORS[c.name] ?? ASSET_COLOR_LIST[i % ASSET_COLOR_LIST.length],
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            dataKey="currentAmount"
            nameKey="name"
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
