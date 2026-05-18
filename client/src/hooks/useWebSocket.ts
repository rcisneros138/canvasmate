import { useEffect, useRef, useState } from 'react';

const MAX_BACKOFF_MS = 30_000;

export function useWebSocket(sessionId: string, onMessage: (data: any) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/session/${sessionId}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => onMessageRef.current(JSON.parse(e.data));
      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s.
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retry);
        retry++;
        reconnectTimer = setTimeout(connect, delay);
      };
      // onerror just lets onclose handle reconnect; nothing to do here.
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sessionId]);

  return { connected };
}
