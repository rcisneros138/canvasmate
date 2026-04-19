type FetchFn = typeof globalThis.fetch;

export class SignalService {
  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = globalThis.fetch
  ) {}

  async createGroup(name: string, members: string[]): Promise<{ link: string | null }> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/v2/groups`, {
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
