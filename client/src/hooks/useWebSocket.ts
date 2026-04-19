import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(sessionId: string, onMessage: (data: any) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));

    return () => ws.close();
  }, [sessionId]);

  return { connected };
}
