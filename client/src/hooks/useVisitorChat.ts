import { useCallback, useEffect, useRef, useState } from "react";
import {
  createVisitorChatSession,
  resolveVisitorChatEndpoint,
  type VisitorChatState,
} from "@/lib/visitorChat";

const POLL_INTERVAL_MS = 5_000;

export function useVisitorChat() {
  const endpoint = resolveVisitorChatEndpoint(
    import.meta.env.VITE_CHAT_API_URL
  );
  const sessionRef = useRef<ReturnType<typeof createVisitorChatSession> | null>(
    null
  );
  const [state, setState] = useState<VisitorChatState>(() => ({
    messages: [],
    status: endpoint ? "loading" : "unconfigured",
    error: null,
    sending: false,
  }));

  useEffect(() => {
    const session = createVisitorChatSession(endpoint, { onChange: setState });
    sessionRef.current = session;
    setState(session.getState());

    const refreshVisible = () => {
      if (document.visibilityState === "visible") void session.refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshVisible();
      else session.cancelRefresh();
    };
    if (endpoint) {
      refreshVisible();
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    const timer = endpoint
      ? window.setInterval(refreshVisible, POLL_INTERVAL_MS)
      : null;

    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [endpoint]);

  const send = useCallback((name: string, body: string): Promise<boolean> => {
    return sessionRef.current?.send(name, body) ?? Promise.resolve(false);
  }, []);

  const refresh = useCallback((): void => {
    if (document.visibilityState === "visible")
      void sessionRef.current?.refresh();
  }, []);

  return { ...state, send, refresh };
}
