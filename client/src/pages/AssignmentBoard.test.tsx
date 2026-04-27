import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('group lead', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it('shows star next to the group lead', () => {
    const session = {
      id: 's1',
      name: 'Test',
      lists: [{ id: 1, list_number: 'L1' }],
      groups: [{ id: 10, name: 'Solo', group_lead_canvasser_id: 1 }],
      canvassers: [
        { id: 1, display_name: 'Alice', group_id: 10 },
        { id: 2, display_name: 'Bob', group_id: null },
      ],
      groupLists: [{ group_id: 10, list_id: 1 }],
    };

    render(<AssignmentBoard session={session} />);
    // Star is rendered next to Alice's name (the lead).
    expect(screen.getByLabelText('Group lead: Alice')).toBeDefined();
  });

  it('clicking Make lead posts to API', async () => {
    const session = {
      id: 's1',
      name: 'Test',
      lists: [{ id: 1, list_number: 'L1' }],
      groups: [{ id: 10, name: 'Solo', group_lead_canvasser_id: null }],
      canvassers: [
        { id: 1, display_name: 'Alice', group_id: 10 },
      ],
      groupLists: [{ group_id: 10, list_id: 1 }],
    };

    render(<AssignmentBoard session={session} />);
    const btn = screen.getByRole('button', { name: /make Alice the lead/i });
    fireEvent.click(btn);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/assignments/groups/10/lead',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', canvasserId: 1 }),
      }),
    );
  });

  it('does NOT show Make lead button for unassigned canvassers', () => {
    const session = {
      id: 's1',
      name: 'Test',
      lists: [{ id: 1, list_number: 'L1' }],
      groups: [],
      canvassers: [{ id: 1, display_name: 'Alice', group_id: null }],
      groupLists: [],
    };
    render(<AssignmentBoard session={session} />);
    expect(screen.queryByRole('button', { name: /make Alice the lead/i })).toBeNull();
  });
});
