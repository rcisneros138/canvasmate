import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import WebSocket from 'ws';
import { setupWebSocket } from './index';

describe('WebSocket', () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  afterEach(() => server?.close());

  it('broadcasts session updates to connected clients', async () => {
    const app = express();
    server = createServer(app);
    const { broadcast } = setupWebSocket(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;

    const client = new WebSocket(`ws://localhost:${port}/ws/session/test-123`);

    await new Promise<void>((resolve) => client.on('open', resolve));

    const messagePromise = new Promise<any>((resolve) => {
      client.on('message', (data) => resolve(JSON.parse(data.toString())));
    });

    broadcast('test-123', { type: 'canvasser_joined', name: 'Alice' });

    const msg = await messagePromise;
    expect(msg.type).toBe('canvasser_joined');
    expect(msg.name).toBe('Alice');

    client.close();
  });
});
