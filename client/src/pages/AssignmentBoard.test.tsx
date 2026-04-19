import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AssignmentBoard from './AssignmentBoard';

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ connected: true }),
}));

describe('AssignmentBoard', () => {
  const mockSession = {
    id: 'test-123',
    name: 'Saturday Canvass',
    lists: [
      { id: 1, list_number: '4821093', label: 'Elm St' },
      { id: 2, list_number: '4821094', label: 'Oak Ave' },
    ],
    groups: [],
    canvassers: [
      { id: 1, display_name: 'Alice', group_id: null },
      { id: 2, display_name: 'Bob', group_id: null },
    ],
  };

  it('renders unassigned canvassers', () => {
    render(<AssignmentBoard session={mockSession} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders list columns', () => {
    render(<AssignmentBoard session={mockSession} />);
    expect(screen.getByText('4821093')).toBeDefined();
    expect(screen.getByText('Elm St')).toBeDefined();
  });
});
