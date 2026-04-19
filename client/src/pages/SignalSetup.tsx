import { useState } from 'react';

interface Props {
  initialStatus: 'not_configured' | 'configured';
  initialNumber?: string;
  onConfigured?: () => void;
}

export default function SignalSetup({ initialStatus, initialNumber, onConfigured }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [number, setNumber] = useState(initialNumber || '');
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendVerification() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/signal/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phoneInput }),
    });
    setLoading(false);

    if (res.ok) {
      setStep('code');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to send verification code');
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/signal/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phoneInput, code: codeInput }),
    });
    setLoading(false);

    if (res.ok) {
      setStatus('configured');
      setNumber(phoneInput);
      onConfigured?.();
    } else {
      const data = await res.json();
      setError(data.error || 'Verification failed');
    }
  }

  if (status === 'configured') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Signal Integration</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-bold">Connected</p>
          <p className="text-green-600 mt-1">{number}</p>
          <p className="text-sm text-green-500 mt-2">
            Signal groups will be created automatically when you lock a session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connect Signal</h1>
      <p className="text-gray-600 mb-6">
        Connect your phone number to automatically create Signal groups for canvass teams.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {step === 'phone' && (
        <div className="space-y-4">
          <input
            type="tel"
            placeholder="Phone number (e.g. +15551234567)"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full p-3 border rounded-lg"
          />
          <button
            onClick={handleSendVerification}
            disabled={!phoneInput || loading}
            className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            A verification code was sent to {phoneInput}
          </p>
          <input
            type="text"
            placeholder="Verification code (e.g. 123-456)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="w-full p-3 border rounded-lg"
          />
          <button
            onClick={handleVerify}
            disabled={!codeInput || loading}
            className="w-full p-3 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={() => { setStep('phone'); setError(null); }}
            className="w-full p-2 text-gray-500 text-sm"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}
