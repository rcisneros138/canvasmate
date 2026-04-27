import { describe, it, expect, vi } from 'vitest';
import { SignalService } from './signal';

describe('SignalService', () => {
  it('creates a group and returns invite link via follow-up GET (swagger-compliant)', async () => {
    // Per bbernhard swagger: POST returns { id }, then GET returns { invite_link }.
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'group-id-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invite_link: 'https://signal.group/#abc123' }),
      });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Sat W5 - Team A', '+15559999999', ['+15551111111', '+15552222222']);

    expect(result.link).toBe('https://signal.group/#abc123');
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/v1/groups/+15559999999',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/v1/groups/+15559999999/group-id-123',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('uses swagger-compliant snake_case permission fields', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'gid' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ invite_link: 'https://signal.group/#x' }) });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    await signal.createGroup('T', '+15559999999');

    const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(postBody.permissions).toEqual({ add_members: 'every-member', edit_group: 'only-admins' });
    expect(postBody.group_link).toBe('enabled');
  });

  it('falls back to direct link field if bridge returns it on the POST response', async () => {
    // Robustness: some forks/older versions may put the link on the POST response.
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'gid', invite_link: 'https://signal.group/#direct' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('T', '+15559999999');

    expect(result.link).toBe('https://signal.group/#direct');
    // Should not have made a second (GET) call when the link is already present.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy `groupInviteLink` field for older bridge versions', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'gid', groupInviteLink: 'https://signal.group/#legacy' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('T', '+15559999999');

    expect(result.link).toBe('https://signal.group/#legacy');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null link when Signal API is unavailable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Test', '+15559999999', ['+15551111111']);

    expect(result.link).toBeNull();
  });

  it('creates a group with no members', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ invite_link: 'https://signal.group/#xyz' }) });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Empty Group', '+15559999999');

    expect(result.link).toBe('https://signal.group/#xyz');
  });

  it('returns null when GET for invite_link fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'gid' }) })
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('not found') });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('T', '+15559999999');

    expect(result.link).toBeNull();
  });

  it('registers a phone number', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.register('+15551234567');

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/register/+15551234567',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('verifies a phone number', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.verify('+15551234567', '123-456');

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/register/+15551234567/verify/123-456',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
