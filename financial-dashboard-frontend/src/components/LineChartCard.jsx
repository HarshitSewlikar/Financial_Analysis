// src/components/LineChartCard.jsx
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { prepareLineData } from '../utils/chartData';
import { Card } from './common/Ui';

const chartFrame = 'h-[280px] w-full min-w-0 lg:h-[320px]';

const LineChartCard = ({ data, title, dataKey, tooltipLabel, actions, className = '' }) => {
    if (!data || data.length === 0) {
        return (
            <Card title={title} actions={actions} className={className}>
                <p className="text-center text-sm text-ink-secondary">No data available for {title} chart.</p>
            </Card>
        );
    }

    // Data arrives sorted ascending (oldest first) and already filtered by the
    // selected time range. Render it as-is so the X axis is chronological.
    const displayData = prepareLineData(data);

    return (
        <Card title={title} actions={actions} className={className}>
            <div className={chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={displayData}
                    margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        minTickGap={32}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis
                        width={72}
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => Number(value).toFixed(0)}
                        label={{ value: 'Close (USD)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                    />
                    <Tooltip
                        labelFormatter={(label) => `Date: ${format(new Date(label), 'MMM dd, yyyy')}`}
                        formatter={(value) => [`${Number(value).toFixed(2)}`, tooltipLabel || 'Close']}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default LineChartCard;