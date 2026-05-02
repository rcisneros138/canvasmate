import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SessionPage from './SessionPage';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  url: string;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  close() {}
  emit(data: any) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

const mkSession = (overrides: any = {}) => ({
  id: 's1', name: 'Test', status: 'active',
  lists: [], groups: [], canvassers: [], groupLists: [],
  signal_invite_link: null,
  ...overrides,
});

describe('SessionPage Signal invite link', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('shows the input with placeholder when link is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve(mkSession()),
    });
    render(
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes><Route path="/session/:id" element={<SessionPage />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/signal\.group/i)).toBeDefined();
    });
  });

  it('PATCHes the link when Save is clicked', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mkSession({ signal_invite_link: 'https://signal.group/#new' })) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mkSession()) });
    });
    global.fetch = fetchMock;

    render(
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes><Route path="/session/:id" element={<SessionPage />} /></Routes>
      </MemoryRouter>
    );

    const input = await screen.findByPlaceholderText(/signal\.group/i);
    fireEvent.change(input, { target: { value: 'https://signal.group/#new' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sessions/s1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ signalInviteLink: 'https://signal.group/#new' }),
        })
      );
    });
  });

  it('shows inline error for malformed link without calling PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve(mkSession()),
    });
    global.fetch = fetchMock;

    render(
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes><Route path="/session/:id" element={<SessionPage />} /></Routes>
      </MemoryRouter>
    );

    const input = await screen.findByPlaceholderText(/signal\.group/i);
    fireEvent.change(input, { target: { value: 'http://wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText(/must start with/i)).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/sessions/s1',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('shows truncated link + Edit/Clear when populated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mkSession({ signal_invite_link: 'https://signal.group/#abc123' })),
    });
    render(
      <MemoryRouter initialEntries={['/session/s1']}>
        <Routes><Route path="/session/:id" element={<SessionPage />} /></Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/abc123/)).toBeDefined();
      expect(screen.getByRole('button', { name: /edit/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /clear/i })).toBeDefined();
    });
  });
});
