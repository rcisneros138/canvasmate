import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import JoinPage from './JoinPage';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  readyState = 1;
  url: string;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  close() { this.onclose?.(); }
  emit(data: any) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

describe('JoinPage WebSocket integration', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    global.fetch = vi.fn();
  });

  it('refetches session when group_created arrives', async () => {
    const sessionResponses = [
      // First poll after check-in — no group yet
      { canvassers: [{ session_token: 'tok', group_id: null }], groups: [], lists: [], groupLists: [] },
      // After group_created event
      {
        canvassers: [{ session_token: 'tok', group_id: 1, display_name: 'Alice' }],
        groups: [{ id: 1, name: 'Team A', signal_group_link: null }],
        lists: [{ id: 1, list_number: '4821093' }],
        groupLists: [{ group_id: 1, list_id: 1 }],
      },
    ];
    let call = 0;
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(sessionResponses[Math.min(call++, 1)]) })
    );

    render(
      <MemoryRouter initialEntries={['/join/sess1']}>
        <Routes>
          <Route path="/join/:sessionId" element={<JoinPage __testToken="tok" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1));

    await act(async () => {
      // Broadcast to every connected hook so JoinPage's listener receives the event
      // regardless of which sub-component also subscribes via useWebSocket.
      MockWebSocket.instances.forEach((ws) => ws.emit({ type: 'group_created' }));
    });

    await waitFor(() => {
      expect(screen.getByText('4821093')).toBeDefined();
    });
  });
});
