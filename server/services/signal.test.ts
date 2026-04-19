import { describe, it, expect, vi } from 'vitest';
import { SignalService } from './signal';

describe('SignalService', () => {
  it('creates a group and returns invite link', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ link: 'https://signal.group/#abc123' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Sat W5 - Team A', ['+15551111111', '+15552222222']);

    expect(result.link).toBe('https://signal.group/#abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v2/groups',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null link when Signal API is unavailable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Test', ['+15551111111']);

    expect(result.link).toBeNull();
  });
});
