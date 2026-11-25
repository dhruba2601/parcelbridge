'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Card, Input } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/parcels/StatusBadge';
import { apiRequest } from '@/services/api';

interface TrackingResult {
  internalParcelCode: string;
  externalTrackingId: string;
  courierName: string;
  currentStatus: string;
  arrivedAt: string | null;
  deliveredAt: string | null;
  events: Array<{ newStatus: string; location: string | null; notes: string | null; createdAt: string }>;
}

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState('DEMO-AMZ-884120');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const data = await apiRequest<{ tracking: TrackingResult }>(`/parcels/track/${encodeURIComponent(trackingId.trim())}`);
      setResult(data.tracking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tracking lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-14 sm:px-6 w-full">
        <h1 className="text-3xl font-bold text-[#0a192f]">Track Your Parcel</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter an external courier tracking ID (e.g. <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">DEMO-AMZ-884120</code>) or internal PARCELBRIDGE code.
        </p>

        <form onSubmit={handleTrack} className="mt-6 flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Enter tracking ID..."
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Track'}
          </Button>
        </form>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        {result && (
          <Card className="mt-8 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-medium text-slate-500">{result.courierName}</p>
                <h2 className="text-lg font-bold text-[#0a192f]">{result.internalParcelCode}</h2>
                <p className="text-xs text-slate-500">External ID: {result.externalTrackingId}</p>
              </div>
              <StatusBadge status={result.currentStatus} />
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Timeline</h3>
              <div className="mt-3 space-y-3">
                {result.events.map((ev, i) => (
                  <div key={i} className="flex items-start justify-between border-l-2 border-cyan-500 pl-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{ev.newStatus}</p>
                      {ev.notes && <p className="text-xs text-slate-500">{ev.notes}</p>}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
