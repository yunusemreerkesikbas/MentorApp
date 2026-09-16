"use client";

import { useCallback, useEffect, useState } from "react";
import apiClient from "./apiClient";

export function useAdminResource<T>(path: string, enabled: boolean) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [hasError, setHasError] = useState(false);

    const reload = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        setHasError(false);
        try {
            const { data: next } = await apiClient.get<T>(path);
            setData(next);
        } catch {
            setData(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [path, enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { data, loading, hasError, reload };
}
