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

const BarChartCard = ({ data, title, barKey, nameKey, barColor }) => {
    if (!data || data.length === 0) {
        return <div className="card text-center text-muted">No data available for {title} chart.</div>;
    }

    const formattedData = data.map(item => ({
        ...item,
        [barKey]: parseFloat(item[barKey].toFixed(2))
    }));

    return (
        <div className="card"> {/* Use card class */}
            <h4 className="card-title">{title}</h4> {/* Use card-title class */}
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={formattedData}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey={nameKey} />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, nameKey]} />
                    <Legend />
                    <Bar dataKey={barKey} fill={barColor} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default BarChartCard;