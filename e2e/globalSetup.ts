import { buildApp } from '../server/app';
import type { AddressInfo } from 'net';
import type { GlobalSetupContext } from 'vitest/node';

let ctx: ReturnType<typeof buildApp> | null = null;

export async function setup({ provide }: GlobalSetupContext) {
  ctx = buildApp({
    dbPath: ':memory:',
    signalApiUrl: 'http://localhost:9999', // unreachable; tests don't need real Signal
  });
  await new Promise<void>((resolve) => {
    ctx!.server.listen(0, () => resolve());
  });
  const port = (ctx!.server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.BASE_URL = baseUrl;
  provide('baseUrl', baseUrl);
}

export async function teardown() {
  if (!ctx) return;
  await new Promise<void>((resolve) => ctx!.server.close(() => resolve()));
  ctx.db.close();
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}
