// src/components/BarChartCard.jsx
import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Card } from './common/Ui';

const chartFrame = 'h-[240px] w-full min-w-0 md:h-[300px]';

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
                    margin={{
                        top: 10,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis dataKey={nameKey} />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, nameKey]} />
                    <Legend />
                    <Bar dataKey={barKey} fill={barColor} />
                </BarChart>
            </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default BarChartCard;