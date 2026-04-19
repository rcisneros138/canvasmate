import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignalSetup from './SignalSetup';

describe('SignalSetup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows phone number input when not configured', () => {
    render(<SignalSetup initialStatus="not_configured" />);
    expect(screen.getByPlaceholderText(/phone number/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send verification/i })).toBeDefined();
  });

  it('shows configured state with number', () => {
    render(<SignalSetup initialStatus="configured" initialNumber="+15551234567" />);
    expect(screen.getByText(/connected/i)).toBeDefined();
    expect(screen.getByText('+15551234567')).toBeDefined();
  });

  it('shows code input after sending verification', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'verification_sent' }),
    });

    render(<SignalSetup initialStatus="not_configured" />);
    fireEvent.change(screen.getByPlaceholderText(/phone number/i), { target: { value: '+15551234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send verification/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/verification code/i)).toBeDefined();
    });
  });
});
