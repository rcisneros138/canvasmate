import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SessionQR from './SessionQR';

describe('SessionQR', () => {
  it('renders QR code with session URL', () => {
    render(<SessionQR sessionId="SAT-W5" baseUrl="https://canvasmate.local" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('shows the join URL as text', () => {
    render(<SessionQR sessionId="SAT-W5" baseUrl="https://canvasmate.local" />);
    expect(screen.getByText(/canvasmate.local\/join\/SAT-W5/)).toBeDefined();
  });
});
