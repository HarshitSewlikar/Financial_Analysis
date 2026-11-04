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

const chartFrame = 'h-[240px] w-full min-w-0 md:h-[300px]';

const LineChartCard = ({ data, title, dataKey, tooltipLabel }) => {
    if (!data || data.length === 0) {
        return (
            <Card title={title}>
                <p className="text-center text-sm text-slate-500">No data available for {title} chart.</p>
            </Card>
        );
    }

    // Data arrives sorted ascending (oldest first) and already filtered by the
    // selected time range. Render it as-is so the X axis is chronological.
    const displayData = prepareLineData(data);

    return (
        <Card title={title}>
            <div className={chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={displayData}
                    margin={{
                        top: 10,
                        right: 16,
                        left: 8,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis
                        dataKey="date"
                        minTickGap={32}
                        tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        label={{ value: 'Close', angle: -90, position: 'insideLeft', fill: '#334155', fontSize: 12 }}
                    />
                    <Tooltip
                        labelFormatter={(label) => `Date: ${format(new Date(label), 'MMM dd, yyyy')}`}
                        formatter={(value) => [`${Number(value).toFixed(2)}`, tooltipLabel || 'Close']}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke="#4F46E5"
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