import { buildApp } from '../server/app';
import type { AddressInfo } from 'net';
import type { GlobalSetupContext } from 'vitest/node';

let ctx: ReturnType<typeof buildApp> | null = null;

export async function setup({ provide }: GlobalSetupContext) {
  ctx = buildApp({
    dbPath: ':memory:',
  });
  await new Promise<void>((resolve, reject) => {
    ctx!.server.once('error', reject);
    ctx!.server.listen(0, () => resolve());
  });
  const port = (ctx!.server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  provide('baseUrl', baseUrl);
}

export async function teardown() {
  if (!ctx) return;
  ctx.wss.close();
  await new Promise<void>((resolve) => ctx!.server.close(() => resolve()));
  ctx.db.close();
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}
