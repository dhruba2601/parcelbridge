'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, QrCode, Users, Warehouse } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button, Card, Input } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/parcels/StatusBadge';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface AdminDashboardData {
  metrics: {
    totalCustomers: number;
    totalSocieties: number;
    totalHubs: number;
    totalParcelsReceived: number;
    parcelsCurrentlyStored: number;
    scheduledDeliveries: number;
    completedDeliveries: number;
    failedDeliveryAttempts: number;
    pendingParcels: number;
  };
  recentParcels: Array<{
    id: string;
    internal_parcel_code: string;
    external_tracking_id: string;
    courier_name: string;
    description: string;
    current_status: string;
    qr_token: string;
  }>;
  societies: Array<{ id: string; name: string; code: string; city: string }>;
  hubs: Array<{ id: string; name: string; code: string; capacity: number; current_occupancy: number }>;
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [qrInput, setQrInput] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<AdminDashboardData>('/admin/dashboard', { token });
      setData(res);
    } catch {
      // handled
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleScanQr(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !qrInput.trim()) return;
    setFeedback('');
    try {
      const res = await apiRequest<{ parcel: { internal_parcel_code: string; current_status: string } }>('/parcels/scan-qr', {
        method: 'POST',
        token,
        body: JSON.stringify({ qrToken: qrInput.trim() }),
      });
      setFeedback(`Scanned ${res.parcel.internal_parcel_code} — Status: ${res.parcel.current_status}`);
      setQrInput('');
      await loadDashboard();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'QR scan failed');
    }
  }

  async function handleStatusChange(parcelId: string, status: string) {
    if (!token) return;
    try {
      await apiRequest(`/parcels/${parcelId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      setFeedback(`Updated parcel status to ${status}`);
      await loadDashboard();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  const m = data?.metrics;

  return (
    <DashboardShell
      title="Operations & Hub Administration"
      subtitle="Monitor societies, smart hubs, parcel inventory, QR intake, and operational KPIs"
    >
      {feedback && (
        <div className="mb-6 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
          {feedback}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ['Customers', m?.totalCustomers ?? 0],
          ['Societies', m?.totalSocieties ?? 0],
          ['Parcel Hubs', m?.totalHubs ?? 0],
          ['Parcels Received', m?.totalParcelsReceived ?? 0],
          ['Currently Stored', m?.parcelsCurrentlyStored ?? 0],
          ['Scheduled', m?.scheduledDeliveries ?? 0],
          ['Completed', m?.completedDeliveries ?? 0],
          ['Failed Attempts', m?.failedDeliveryAttempts ?? 0],
          ['Pending Intake', m?.pendingParcels ?? 0],
        ].map(([label, val]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[#0a192f]">{val}</p>
          </Card>
        ))}
      </div>

      {/* QR Scanner & Society/Hub Summary */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
            <QrCode className="h-4 w-4 text-cyan-600" />
            Hub QR Verification Scanner
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste an opaque <code className="bg-slate-100 px-1 rounded">pb1:...</code> QR token to verify authenticity and advance intake status.
          </p>
          <form onSubmit={handleScanQr} className="mt-4 space-y-3">
            <Input
              placeholder="pb1:<parcel-id>:<hmac>"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              required
            />
            <Button type="submit" size="sm" className="w-full">
              Verify & Scan QR
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
            <Building2 className="h-4 w-4 text-cyan-600" />
            Registered Societies
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            {data?.societies.map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <span className="text-slate-500">{s.city} ({s.code})</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
            <Warehouse className="h-4 w-4 text-cyan-600" />
            Active Parcel Hubs
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            {data?.hubs.map((h) => (
              <li key={h.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-800">{h.name}</span>
                <span className="text-slate-500">
                  {h.current_occupancy}/{h.capacity} cap
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Parcel Inventory Table */}
      <Card className="mt-8 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
            <Users className="h-4 w-4 text-cyan-600" />
            Live Parcel Inventory & Status Controls
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Parcel Code</th>
                <th className="px-5 py-3">Courier / Description</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentParcels.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5 font-semibold text-[#0a192f]">
                    {p.internal_parcel_code}
                    <div className="text-[11px] font-normal text-slate-400">{p.external_tracking_id}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{p.description}</div>
                    <div className="text-slate-500">{p.courier_name}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={p.current_status} />
                  </td>
                  <td className="px-5 py-3.5">
                    {p.current_status === 'Expected' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(p.id, 'Received at hub')}>
                        Mark Received
                      </Button>
                    )}
                    {p.current_status === 'Stored' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(p.id, 'Ready for delivery')}>
                        Mark Ready
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardShell>
  );
}
