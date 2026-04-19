import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CheckIn from './CheckIn';

describe('CheckIn', () => {
  it('renders name input and submit button', () => {
    render(<CheckIn sessionId="test-123" />);
    expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /check in/i })).toBeDefined();
  });

  it('submits check-in with display name', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok-123', displayName: 'Alice' }),
    });
    global.fetch = mockFetch;

    render(<CheckIn sessionId="test-123" />);
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/checkin', expect.objectContaining({
        method: 'POST',
      }));
    });
  });
});
