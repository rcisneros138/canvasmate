import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateSession() {
  const [name, setName] = useState('');
  const [listInput, setListInput] = useState('');
  const navigate = useNavigate();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setListInput(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, listNumbers: listInput, organizerId: 'temp' }),
    });
    const session = await res.json();
    navigate(`/session/${session.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">New Canvass Session</h1>

      <input
        type="text"
        placeholder="Session name (e.g., Saturday Ward 5)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full p-3 border rounded-lg"
      />

      <div className="space-y-2">
        <label className="block font-medium">List numbers</label>
        <textarea
          placeholder="Paste list numbers, one per line"
          value={listInput}
          onChange={(e) => setListInput(e.target.value)}
          rows={6}
          className="w-full p-3 border rounded-lg font-mono text-sm"
        />
        <p className="text-sm text-gray-500">Or upload a file:</p>
        <input
          type="file"
          accept=".txt,.csv"
          onChange={handleFileUpload}
          className="text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={!name || !listInput}
        className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
      >
        Create Session
      </button>
    </form>
  );
}
