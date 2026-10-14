// src/components/LineChartCard.jsx
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { prepareLineData } from '../utils/chartData';

const LineChartCard = ({ data, title, dataKey, tooltipLabel }) => {
    if (!data || data.length === 0) {
        return <div className="card text-center text-muted">No data available for {title} chart.</div>;
    }

    // Data arrives sorted ascending (oldest first) and already filtered by the
    // selected time range. Render it as-is so the X axis is chronological.
    const displayData = prepareLineData(data);

    return (
        <div className="card"> {/* Use card class */}
            <h4 className="card-title">{title}</h4> {/* Use card-title class */}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={displayData}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip
                        labelFormatter={(label) => `Date: ${format(new Date(label), 'MMM dd, yyyy')}`}
                        formatter={(value) => [`${value.toFixed(2)}`, tooltipLabel]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey={dataKey} stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default LineChartCard;