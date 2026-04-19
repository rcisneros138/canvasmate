import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export function setupWebSocket(server: Server) {
  const sessions = new Map<string, Set<WebSocket>>();
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/ws\/session\/(.+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const sessionId = match[1];
      if (!sessions.has(sessionId)) sessions.set(sessionId, new Set());
      sessions.get(sessionId)!.add(ws);

      ws.on('close', () => {
        sessions.get(sessionId)?.delete(ws);
        if (sessions.get(sessionId)?.size === 0) sessions.delete(sessionId);
      });
    });
  });

  function broadcast(sessionId: string, data: any) {
    const clients = sessions.get(sessionId);
    if (!clients) return;
    const msg = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  return { broadcast };
}
