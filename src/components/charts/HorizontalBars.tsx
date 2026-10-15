"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/utils";

export type HorizontalBarItem = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * Lista de barras horizontais proporcionais ao valor real (sem normalização
 * artificial pelo maior valor — o eixo vai de 0 ao maior valor da série, então
 * 179 vs 25 aparece ~7x maior). Cada linha traz rótulo, quantidade e % da frota.
 */
export function HorizontalBars({
  items,
  total,
  rowHeight = 34,
}: {
  items: HorizontalBarItem[];
  total: number;
  rowHeight?: number;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const chartHeight = items.length * rowHeight + 8;

  return (
    <div className="w-full">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={items}
            margin={{ top: 0, right: 96, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" domain={[0, max]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={92}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "#475569" }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {items.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                content={(props) => {
                  const { x, y, width, height, value } = props as {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    value: number;
                  };
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <text
                      x={x + width + 8}
                      y={y + height / 2}
                      dominantBaseline="central"
                      fontSize={12}
                      className="tabular-nums"
                      fill="#0f172a"
                    >
                      <tspan fontWeight={700}>{formatNumber(value)}</tspan>
                      <tspan fill="#94a3b8"> · {pct}%</tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
