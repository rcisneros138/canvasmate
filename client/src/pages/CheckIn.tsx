import { useState } from 'react';

interface Props {
  sessionId: string;
  onCheckedIn?: (token: string) => void;
}

export default function CheckIn({ sessionId, onCheckedIn }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [minivanId, setMinivanId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, displayName: name, phone: phone || undefined, minivanId: minivanId || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      onCheckedIn?.(data.sessionToken);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Check In</h1>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full p-3 border rounded-lg text-lg"
      />

      <input
        type="tel"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full p-3 border rounded-lg"
      />

      <input
        type="text"
        placeholder="MiniVAN ID (optional)"
        value={minivanId}
        onChange={(e) => setMinivanId(e.target.value)}
        className="w-full p-3 border rounded-lg"
      />

      <button
        type="submit"
        disabled={!name || loading}
        className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold text-lg disabled:opacity-50"
      >
        {loading ? 'Checking in...' : 'Check In'}
      </button>
    </form>
  );
}
