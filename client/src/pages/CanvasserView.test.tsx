import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CanvasserView from './CanvasserView';

describe('CanvasserView', () => {
  it('shows waiting state when unassigned', () => {
    render(<CanvasserView assignment={null} />);
    expect(screen.getByText(/waiting for assignment/i)).toBeDefined();
  });

  it('shows list number when assigned', () => {
    render(
      <CanvasserView
        assignment={{ listNumber: '4821093', groupName: 'Team A', members: ['Alice', 'Bob'] }}
      />
    );
    expect(screen.getByText('4821093')).toBeDefined();
    expect(screen.getByText('Team A')).toBeDefined();
  });

  it('shows "Group lead" badge when isLead is true', () => {
    render(
      <CanvasserView
        assignment={{ listNumber: '1', groupName: 'A', members: ['Alice'], isLead: true }}
      />
    );
    expect(screen.getByText(/group lead/i)).toBeDefined();
  });

  it('shows Signal QR code when signal link is present', () => {
    render(
      <CanvasserView
        assignment={{
          listNumber: '4821093',
          groupName: 'Team A',
          members: ['Alice', 'Bob'],
        }}
        signalLink="https://signal.group/#abc123"
      />
    );
    expect(screen.getByText('Join Signal Group')).toBeDefined();
    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('shows Signal QR while waiting for assignment', () => {
    render(<CanvasserView assignment={null} signalLink="https://signal.group/#xyz" />);
    expect(screen.getByText(/waiting for assignment/i)).toBeDefined();
    expect(screen.getByText(/join signal group/i)).toBeDefined();
  });

  it('shows Signal QR with assignment present', () => {
    render(
      <CanvasserView
        assignment={{ listNumber: '1', groupName: 'A', members: ['Alice'] }}
        signalLink="https://signal.group/#xyz"
      />
    );
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText(/join signal group/i)).toBeDefined();
  });
});
