// src/components/BarChartCard.jsx
import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Card } from './common/Ui';

const chartFrame = 'h-[260px] w-full min-w-0 lg:h-[280px]';

const BarChartCard = ({ data, title, barKey, nameKey, barColor }) => {
    if (!data || data.length === 0) {
        return (
            <Card title={title}>
                <p className="text-center text-sm text-slate-500">No data available for {title} chart.</p>
            </Card>
        );
    }

    const formattedData = data.map(item => ({
        ...item,
        [barKey]: parseFloat(item[barKey].toFixed(2))
    }));

    return (
        <Card title={title}>
            <div className={chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={formattedData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${value}%`} />
                    <YAxis
                        type="category"
                        dataKey={nameKey}
                        width={56}
                        interval={0}
                        tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Change']} />
                    <Bar dataKey={barKey} name="Change" fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
            </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default BarChartCard;