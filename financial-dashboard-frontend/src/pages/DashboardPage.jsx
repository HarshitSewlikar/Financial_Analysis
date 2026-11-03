// src/pages/DashboardPage.jsx
import React, { useState, useCallback, useMemo } from 'react';
import useFetchData from '../hooks/useFetchData';
import { getDailyStockData, getSectorPerformance, getMarketMovers, getStockScore } from '../services/api';

// Import our components
import LineChartCard from '../components/LineChartCard';
import PieChartCard from '../components/PieChartCard';
import BarChartCard from '../components/BarChartCard';
import TableComponent from '../components/TableComponent';
import HeatmapCard from '../components/HeatmapCard';

// Import react-select for dropdowns
import Select from 'react-select';
import { format } from 'date-fns';

// Import dashboard-specific styles
import '../styles/Dashboard.css'; // NEW: Import Dashboard styles

// Define default options for symbols and time ranges
const stockSymbols = [
    { value: 'IBM', label: 'IBM' },
    { value: 'AAPL', label: 'Apple Inc.' },
    { value: 'MSFT', label: 'Microsoft Corp.' },
    { value: 'GOOGL', label: 'Alphabet Inc.' },
    { value: 'AMZN', label: 'Amazon.com Inc.' },
    { value: 'TSLA', label: 'Tesla Inc.' },
    // Add more symbols as needed for testing
];

const timeRangeOptions = [
    { value: '1M', label: '1 Month' },
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: 'ALL', label: 'All Time' },
];

const DashboardPage = () => {
    // State for user selections
    const [selectedSymbol, setSelectedSymbol] = useState(stockSymbols[0]); // Default to IBM
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRangeOptions[3]); // Default to 1 Year

    // Memoize fetch functions based on selectedSymbol
    const fetchDailyDataFn = useCallback(
        () => getDailyStockData(selectedSymbol.value),
        [selectedSymbol.value]
    );
    const fetchStockScoreFn = useCallback(
        () => getStockScore(selectedSymbol.value),
        [selectedSymbol.value]
    );

    // Filter daily data based on selected time range
    const filterDailyDataByTimeRange = useCallback((data, range) => {
        if (!data || data.length === 0) return [];
        const now = new Date();
        let startDate;

        switch (range) {
            case '1M':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case '3M':
                startDate = new Date(now.setMonth(now.getMonth() - 3));
                break;
            case '6M':
                startDate = new Date(now.setMonth(now.getMonth() - 6));
                break;
            case '1Y':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            case 'ALL':
            default:
                return data; // No filtering needed for 'All Time'
        }

        // Data is sorted ascending by date (oldest first) by our backend's normalizeDailyTimeSeries
        return data.filter(item => new Date(item.date) >= startDate);
    }, []);

    // Fetching data using useFetchData hook
    const { data: rawIbmDailyData, loading: ibmLoading, error: ibmError } = useFetchData(
        fetchDailyDataFn,
        [selectedSymbol.value]
    );

    // Apply time range filter to raw data
    const ibmDailyData = useMemo(() => {
        return filterDailyDataByTimeRange(rawIbmDailyData, selectedTimeRange.value);
    }, [rawIbmDailyData, selectedTimeRange.value, filterDailyDataByTimeRange]);


    const { data: sectorData, loading: sectorLoading, error: sectorError } = useFetchData(
        getSectorPerformance,
        []
    );

    const { data: moversData, loading: moversLoading, error: moversError } = useFetchData(
        getMarketMovers,
        []
    );

    const { data: ibmScore, loading: scoreLoading, error: scoreError } = useFetchData(
        fetchStockScoreFn,
        [selectedSymbol.value]
    );

    // Define columns for the Most Actively Traded table
    const mostActiveColumns = useMemo(() => [
        { header: 'Ticker', accessor: 'ticker' },
        { header: 'Price', accessor: 'price', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Change', accessor: 'changeAmount', formatter: (val) => `${val > 0 ? '+' : ''}${val.toFixed(2)}` },
        { header: '% Change', accessor: 'changePercentage', formatter: (val) => `${val.toFixed(2)}%` },
        { header: 'Volume', accessor: 'volume', formatter: (val) => val.toLocaleString() },
    ], []);

    // Define columns for the Selected Stock Details table
    const selectedStockDetailColumns = useMemo(() => [
        { header: 'Date', accessor: 'date', formatter: (val) => format(new Date(val), 'MMM dd, yyyy') }, // Fixed date format
        { header: 'Open', accessor: 'open', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'High', accessor: 'high', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Low', accessor: 'low', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Close', accessor: 'close', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Volume', accessor: 'volume', formatter: (val) => val.toLocaleString() },
    ], []);


    return (
        <div className="dashboard-container"> {/* Use dashboard-container class */}
            <p className="text-center text-muted">Real-time insights for better decisions.</p>            <hr />

            {/* Controls Section: Symbol Selector and Time Range Filter */}
            <div className="controls-section"> {/* Use controls-section class */}
                <div className="control-group"> {/* Use control-group class */}
                    <label htmlFor="stock-select">Select Stock:</label>
                    <Select
                        id="stock-select"
                        options={stockSymbols}
                        value={selectedSymbol}
                        onChange={setSelectedSymbol}
                        isSearchable
                        placeholder="Search for a stock..."
                        classNamePrefix="react-select" // Class prefix for react-select styling
                    />
                </div>
                <div className="control-group"> {/* Use control-group class */}
                    <label htmlFor="time-range-select">Time Range:</label>
                    <Select
                        id="time-range-select"
                        options={timeRangeOptions}
                        value={selectedTimeRange}
                        onChange={setSelectedTimeRange}
                        isSearchable={false}
                        classNamePrefix="react-select" // Class prefix for react-select styling
                    />
                </div>
            </div>
            <hr />

            {/* Daily Stock Data for Selected Symbol (Line Chart) */}
            <h3 className="text-center">{selectedSymbol.label} Daily Stock Price Trend ({selectedTimeRange.label})</h3>
            {ibmLoading && <p className="text-center">Loading {selectedSymbol.label} daily stock data...</p>}
            {ibmError && <p className="text-center error-message">Error loading {selectedSymbol.label} daily data: {ibmError.message}</p>}
            {!ibmLoading && !ibmError && ibmDailyData && Array.isArray(ibmDailyData) && ibmDailyData.length > 0 ? (
                <LineChartCard
                    data={ibmDailyData}
                    title={`${selectedSymbol.label} Daily Stock Price Trend`}
                    dataKey="close"
                    tooltipLabel="Close Price"
                />
            ) : (
                !ibmLoading && !ibmError && <p className="text-center text-muted">No daily data available for {selectedSymbol.label} to display chart.</p>
            )}
            <hr />

            {/* Sector Performance (Pie Chart) */}
            <h3 className="text-center">Sector Performance (Realtime)</h3>
            {sectorLoading && <p className="text-center">Loading sector performance data...</p>}
            {sectorError && <p className="text-center error-message">Error loading sector data: {sectorError.message}</p>}
            {!sectorLoading && !sectorError && sectorData && Array.isArray(sectorData) && sectorData.length > 0 ? (
                <PieChartCard
                    data={sectorData}
                    title="Sector Realtime Performance Distribution"
                    dataKey="performance"
                    nameKey="sector"
                />
            ) : (
                !sectorLoading && !sectorError && <p className="text-center text-muted">No sector performance data available to display chart.</p>
            )}
            <hr />

            {/* Market Movers (Bar Charts) */}
            <h3 className="text-center">Market Movers</h3>
            {moversLoading && <p className="text-center">Loading market movers...</p>}
            {moversError && <p className="text-center error-message">Error loading market movers: {moversError.message}</p>}
            {!moversLoading && !moversError && moversData ? (
                <div className="chart-grid"> {/* Use chart-grid class */}
                    {moversData.topGainers && Array.isArray(moversData.topGainers) && moversData.topGainers.length > 0 ? (
                        <BarChartCard
                            data={moversData.topGainers.slice(0, 10)}
                            title="Top 10 Gainers (%)"
                            barKey="changePercentage"
                            nameKey="ticker"
                            barColor="#4CAF50"
                        />
                    ) : (
                        <p className="text-center text-muted">No top gainers data available to display chart.</p>
                    )}

                    {moversData.topLosers && Array.isArray(moversData.topLosers) && moversData.topLosers.length > 0 ? (
                        <BarChartCard
                            data={moversData.topLosers.slice(0, 10)}
                            title="Top 10 Losers (%)"
                            barKey="changePercentage"
                            nameKey="ticker"
                            barColor="#F44336"
                        />
                    ) : (
                        <p className="text-center text-muted">No top losers data available to display chart.</p>
                    )}
                </div>
            ) : (
                !moversLoading && !moversError && <p className="text-center text-muted">No market movers data available to display charts.</p>
            )}
            <hr />

            {/* Heatmap for Top Movers */}
            <h3 className="text-center">Market Performance Heatmap (Top/Bottom Movers)</h3>
            {moversLoading && <p className="text-center">Loading heatmap data...</p>}
            {moversError && <p className="text-center error-message">Error loading heatmap data: {moversError.message}</p>}
            {!moversLoading && !moversError && moversData ? (
                <HeatmapCard
                    data={moversData}
                    title="Top/Bottom Market Movers"
                />
            ) : (
                !moversLoading && !moversError && <p className="text-center text-muted">No heatmap data available.</p>
            )}
            <hr />

            {/* Stock Score for Selected Symbol (Score View) */}
            <h3 className="text-center">{selectedSymbol.label} Stock Score</h3>
            {scoreLoading && <p className="text-center">Calculating {selectedSymbol.label} score...</p>}
            {scoreError && <p className="text-center error-message">Error calculating {selectedSymbol.label} score: {scoreError.message}</p>}
            {!scoreLoading && !scoreError && ibmScore && ibmScore.metrics ? (
                <div className="score-card"> {/* Use score-card class */}
                    <p className="score-value">
                        Composite Score: <span>{ibmScore.score}</span>
                    </p>
                    <div className="score-metrics"> {/* Use score-metrics class */}
                        <p>Volatility: {ibmScore.metrics.volatility}</p>
                        <p>Growth Rate: {ibmScore.metrics.growthRate}</p>
                        <p>Average Volume: {ibmScore.metrics.averageVolume}</p>
                    </div>
                </div>
            ) : (
                !scoreLoading && !scoreError && <p className="text-center text-muted">No stock score available for {selectedSymbol.label} (Insufficient data or calculation error).</p>
            )}
            <hr />

            {/* Table View: Most Actively Traded Stocks */}
            <h3 className="text-center">Most Actively Traded Stocks</h3>
            {moversLoading && <p className="text-center">Loading most actively traded data for table...</p>}
            {moversError && <p className="text-center error-message">Error loading most actively traded data: {moversError.message}</p>}
            {!moversLoading && !moversError && moversData && moversData.mostActivelyTraded && Array.isArray(moversData.mostActivelyTraded) && moversData.mostActivelyTraded.length > 0 ? (
                <TableComponent
                    data={moversData.mostActivelyTraded.slice(0, 15)}
                    columns={mostActiveColumns}
                    title="Most Actively Traded Stocks"
                />
            ) : (
                !moversLoading && !moversError && <p className="text-center text-muted">No most actively traded data available for table.</p>
            )}
            <hr />

            {/* Table View: Selected Stock Daily Details (Latest Day) */}
            <h3 className="text-center">{selectedSymbol.label} Latest Daily Details</h3>
            {ibmLoading && <p className="text-center">Loading {selectedSymbol.label} details for table...</p>}
            {ibmError && <p className="text-center error-message">Error loading {selectedSymbol.label} details: {ibmError.message}</p>}
            {!ibmLoading && !ibmError && ibmDailyData && Array.isArray(ibmDailyData) && ibmDailyData.length > 0 ? (
                <TableComponent
                    data={[ibmDailyData[ibmDailyData.length - 1]]}
                    columns={selectedStockDetailColumns}
                    title={`${selectedSymbol.label} Latest Daily Details`}
                />
            ) : (
                !ibmLoading && !ibmError && <p className="text-center text-muted">No latest daily details available for {selectedSymbol.label}.</p>
            )}

        </div>
    );
};

export default DashboardPage;