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

  async createGroup(name: string, senderNumber: string, members: string[] = []): Promise<{ link: string | null }> {
    try {
      // Per bbernhard/signal-cli-rest-api swagger (src/docs/swagger.yaml):
      // - permissions uses snake_case: add_members / edit_group
      // - add_members enum: only-admins | every-member  (NOT 'everyone')
      // - group_link enum: disabled | enabled | enabled-with-approval
      // - CreateGroupResponse only returns { id }; the invite_link must be
      //   fetched via GET /v1/groups/{number}/{groupid}.
      const res = await this.fetchFn(`${this.baseUrl}/v1/groups/${senderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          members,
          permissions: { add_members: 'every-member', edit_group: 'only-admins' },
          group_link: 'enabled',
        }),
      });

      if (!res.ok) return { link: null };
      const data = await res.json();

      // Robust extraction: some bridge versions / forks may return the link
      // directly on the create response. Prefer those if present.
      const directLink = data.invite_link || data.groupInviteLink || data.link;
      if (directLink) return { link: directLink };

      // Standard path: follow up with GET to retrieve invite_link.
      const groupId = data.id;
      if (!groupId) return { link: null };

      const detailsRes = await this.fetchFn(
        `${this.baseUrl}/v1/groups/${senderNumber}/${encodeURIComponent(groupId)}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!detailsRes.ok) return { link: null };
      const details = await detailsRes.json();
      return { link: details.invite_link || details.groupInviteLink || details.link || null };
    } catch {
      return { link: null };
    }
  }
}
