import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFuturesResearchReport } from "@/lib/futuresResearchClient";
import type { FuturesResearchReport } from "@shared/futuresResearchReport";

export function useFuturesResearchReport(enabled: boolean) {
  const [report, setReport] = useState<FuturesResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const controllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const hasReport = useRef(false);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    setProgress({ completed: 0, total: 0 });
    try {
      const result = await fetchFuturesResearchReport(controller.signal, (completed, total) => {
        if (requestRef.current === request) setProgress({ completed, total });
      });
      if (requestRef.current !== request || controller.signal.aborted) return;
      hasReport.current = true;
      setReport(result);
    } catch {
      if (requestRef.current === request && !controller.signal.aborted) {
        setError("새 리포트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !hasReport.current) void refresh();
    return () => { if (enabled) controllerRef.current?.abort(); };
  }, [enabled, refresh]);

  useEffect(() => () => {
    requestRef.current++;
    controllerRef.current?.abort();
  }, []);

  return { report, loading, error, progress, refresh };
}
