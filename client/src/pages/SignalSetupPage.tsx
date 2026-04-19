import { useEffect, useState } from 'react';
import SignalSetup from './SignalSetup';

export default function SignalSetupPage() {
  const [status, setStatus] = useState<'not_configured' | 'configured' | null>(null);
  const [number, setNumber] = useState<string | undefined>();

  useEffect(() => {
    fetch('/api/signal/status')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status);
        setNumber(data.number);
      })
      .catch(() => setStatus('not_configured'));
  }, []);

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <SignalSetup initialStatus={status} initialNumber={number} />;
}
