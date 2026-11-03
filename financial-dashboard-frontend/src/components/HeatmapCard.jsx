// src/components/HeatmapCard.jsx
import React from 'react';

const getColorForChange = (changePercentage) => {
    const normalizedChange = Math.min(1, Math.abs(changePercentage) / 5);
    const intensity = Math.round(normalizedChange * 255);

    if (changePercentage > 0) {
        return `rgb(${255 - intensity}, 255, ${255 - intensity})`;
    } else if (changePercentage < 0) {
        return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
    } else {
        return '#f0f0f0';
    }
};

const HeatmapCard = ({ data, title }) => {
    const combinedData = [];
    const seenTickers = new Set();

    if (data && data.topGainers) {
        data.topGainers.forEach(item => {
            if (!seenTickers.has(item.ticker)) {
                combinedData.push(item);
                seenTickers.add(item.ticker);
            }
        });
    }

    if (data && data.topLosers) {
        data.topLosers.forEach(item => {
            if (!seenTickers.has(item.ticker)) {
                combinedData.push(item);
                seenTickers.add(item.ticker);
            }
        });
    }

    combinedData.sort((a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage));

    if (combinedData.length === 0) {
        return (
            <div className="card text-center text-muted" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                No data available for {title || "this heatmap"}.
            </div>
        );
    }

    return (
        <div className="card"> {/* Use card class */}
            <h4 className="card-title">{title}</h4> {/* Use card-title class */}
            <div className="heatmap-grid"> {/* Use heatmap-grid class */}
                {combinedData.slice(0, 50).map(item => (
                    <div
                        key={item.ticker}
                        className="heatmap-block" // Use heatmap-block class
                        style={{ backgroundColor: getColorForChange(item.changePercentage) }}
                    >
                        <div>{item.ticker}</div>
                        <div className="heatmap-block-change" style={{ color: item.changePercentage > 0 ? '#1a751a' : '#cc0000' }}>
                            {item.changePercentage.toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HeatmapCard;