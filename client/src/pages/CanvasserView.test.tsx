import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CanvasserView from './CanvasserView';

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: (_id: string, _cb: any) => ({ connected: true }),
}));

describe('CanvasserView', () => {
  it('shows waiting state when unassigned', () => {
    render(<CanvasserView sessionId="test" sessionToken="tok" assignment={null} />);
    expect(screen.getByText(/waiting for assignment/i)).toBeDefined();
  });

  it('shows list number when assigned', () => {
    render(
      <CanvasserView
        sessionId="test"
        sessionToken="tok"
        assignment={{ listNumber: '4821093', groupName: 'Team A', members: ['Alice', 'Bob'] }}
      />
    );
    expect(screen.getByText('4821093')).toBeDefined();
    expect(screen.getByText('Team A')).toBeDefined();
  });

  it('shows Signal QR code when signal link is present', () => {
    render(
      <CanvasserView
        sessionId="test"
        sessionToken="tok"
        assignment={{
          listNumber: '4821093',
          groupName: 'Team A',
          members: ['Alice', 'Bob'],
          signalLink: 'https://signal.group/#abc123',
        }}
      />
    );
    expect(screen.getByText('Join Signal Group')).toBeDefined();
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });
});
