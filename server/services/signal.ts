type FetchFn = typeof globalThis.fetch;

export class SignalService {
  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = globalThis.fetch
  ) {}

  async register(number: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/register/${number}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_voice: false }),
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async verify(number: string, code: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/register/${number}/verify/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async getAccounts(): Promise<string[]> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/accounts`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async createGroup(name: string, members: string[], senderNumber: string): Promise<{ link: string | null }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v1/groups/${senderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          members,
          permissions: { addMembers: 'only-admins', editGroup: 'only-admins' },
          groupLinkState: 'enabled',
        }),
      });

      if (!res.ok) return { link: null };
      const data = await res.json();
      return { link: data.link || null };
    } catch {
      return { link: null };
    }
  }
}
