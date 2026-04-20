import { describe, it, expect, vi } from 'vitest';
import { SignalService } from './signal';

describe('SignalService', () => {
  it('creates a group and returns invite link', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ link: 'https://signal.group/#abc123' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Sat W5 - Team A', '+15559999999', ['+15551111111', '+15552222222']);

    expect(result.link).toBe('https://signal.group/#abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/groups/+15559999999',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null link when Signal API is unavailable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Test', '+15559999999', ['+15551111111']);

    expect(result.link).toBeNull();
  });

  it('creates a group with no members', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ link: 'https://signal.group/#xyz' }),
    });

    const signal = new SignalService('http://localhost:8080', mockFetch as any);
    const result = await signal.createGroup('Empty Group', '+15559999999');

    expect(result.link).toBe('https://signal.group/#xyz');
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
