// src/components/TableComponent.jsx
import React from 'react';

const TableComponent = ({ data, columns, title }) => {
    if (!data || data.length === 0 || !columns || columns.length === 0) {
        return (
            <div className="table-container text-center text-muted"> {/* Use table-container class */}
                No data available for {title || "this table"}.
            </div>
        );
    }

    return (
        <div className="table-container"> {/* Use table-container class */}
            {title && <h4 className="card-title">{title}</h4>} {/* Use card-title for table title */}
            <table className="data-table"> {/* Use data-table class */}
                <thead>
                    <tr>
                        {columns.map((col, index) => (
                            <th key={index}>
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {columns.map((col, colIndex) => (
                                <td key={colIndex}>
                                    {col.formatter ? col.formatter(row[col.accessor]) : row[col.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TableComponent;