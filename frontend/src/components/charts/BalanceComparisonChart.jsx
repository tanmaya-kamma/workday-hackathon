import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Card } from '../common/Card.jsx';

const TYPE_LABELS = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
};

// Single-hue, two-shade encoding: identity is carried by the row labels,
// color carries the used vs. remaining split. Shortfall uses the status red.
const COLOR_USED = '#b8dce3';
const COLOR_REMAINING = '#00839c';
const COLOR_SHORTFALL = '#ba1a1a';

const renderSegmentLabel = (textColor) => (props) => {
  const { x, y, width, height, value } = props;
  if (!value || width < 32) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {value}d
    </text>
  );
};

export function BalanceComparisonChart({ projectedBalances }) {
  if (!projectedBalances) return null;

  const data = Object.entries(projectedBalances)
    .filter(([, v]) => v.current_usable > 0 || v.hypothetical_days > 0)
    .map(([type, val]) => ({
      name: TYPE_LABELS[type] || type,
      used: Math.min(val.hypothetical_days, val.current_usable),
      remaining: Math.max(0, val.projected_remaining),
      shortfall: Math.max(0, -val.projected_remaining),
      currentUsable: val.current_usable,
    }));

  if (data.length === 0) return null;

  const hasShortfall = data.some((d) => d.shortfall > 0);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[#00646f]">donut_small</span>
        <h3 className="text-base font-semibold text-[#0f1d27]">Balance Impact</h3>
      </div>
      <p className="text-xs text-[#687781] mb-4">
        How much of each current balance this plan uses, and what would be left
      </p>
      <ResponsiveContainer width="100%" height={data.length * 72 + 90}>
        <BarChart data={data} layout="vertical" barCategoryGap="35%">
          <CartesianGrid horizontal={false} stroke="#e8edef" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#687781' }}
            allowDecimals={false}
            unit="d"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#3e494a', fontWeight: 600 }}
            width={72}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f5f7f8' }}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #dfe5e8',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => [`${value} days`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" iconSize={9} />
          <Bar
            dataKey="remaining"
            stackId="balance"
            name="Remaining after"
            fill={COLOR_REMAINING}
            stroke="#ffffff"
            strokeWidth={2}
            maxBarSize={28}
            isAnimationActive={false}
          >
            <LabelList dataKey="remaining" content={renderSegmentLabel('#ffffff')} />
          </Bar>
          <Bar
            dataKey="used"
            stackId="balance"
            name="Used by this plan"
            fill={COLOR_USED}
            stroke="#ffffff"
            strokeWidth={2}
            maxBarSize={28}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList dataKey="used" content={renderSegmentLabel('#0f1d27')} />
          </Bar>
          {hasShortfall && (
            <Bar
              dataKey="shortfall"
              stackId="balance"
              name="Shortfall"
              fill={COLOR_SHORTFALL}
              stroke="#ffffff"
              strokeWidth={2}
              maxBarSize={28}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList dataKey="shortfall" content={renderSegmentLabel('#ffffff')} />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
