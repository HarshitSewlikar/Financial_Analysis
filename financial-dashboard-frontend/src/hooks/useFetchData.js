// src/hooks/useFetchData.js
import { useState, useEffect, useCallback } from 'react';

const useFetchData = (fetchDataFn, dependencies = [], immediate = true) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchDataFn();
            setData(result);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [fetchDataFn]); // Only fetchDataFn itself needs to be in useCallback dependencies

    useEffect(() => {
        if (immediate) {
            fetchData();
        }
    }, [fetchData, immediate, ...dependencies]); // dependencies for useEffect are additional triggers

    return { data, loading, error, refetch: fetchData };
};

export default useFetchData;