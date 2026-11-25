'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, CalendarClock, HelpCircle, Package, RotateCcw } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button, Card, EmptyState, Input } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/parcels/StatusBadge';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface Parcel {
  id: string;
  internal_parcel_code: string;
  external_tracking_id: string;
  courier_name: string;
  description: string;
  storage_location: string | null;
  qr_token: string;
  current_status: string;
  society_id: string;
}

interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  booked_count: number;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function CustomerDashboardPage() {
  const { user, token } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [feedback, setFeedback] = useState('');

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');

  // Return request state
  const [returnParcelId, setReturnParcelId] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [pRes, sRes, nRes] = await Promise.all([
        apiRequest<{ parcels: Parcel[] }>('/parcels', { token }),
        apiRequest<{ slots: Slot[] }>(`/delivery-slots${user?.society_id ? `?societyId=${user.society_id}` : ''}`, { token }),
        apiRequest<{ notifications: NotificationItem[] }>('/customer/notifications', { token }),
      ]);
      setParcels(pRes.parcels);
      setSlots(sRes.slots);
      setNotifications(nRes.notifications);
    } catch {
      // handled silently
    }
  }, [token, user?.society_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleBookSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedParcel || !selectedSlotId || !token) return;
    setFeedback('');
    try {
      await apiRequest('/delivery-bookings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          parcelId: selectedParcel.id,
          slotId: selectedSlotId,
          deliveryInstructions: instructions || undefined,
        }),
      });
      setFeedback(`Delivery slot reserved for ${selectedParcel.internal_parcel_code}.`);
      setSelectedParcel(null);
      setSelectedSlotId('');
      setInstructions('');
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to reserve slot');
    }
  }

  async function handleReturnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !returnParcelId) return;
    try {
      await apiRequest('/customer/returns', {
        method: 'POST',
        token,
        body: JSON.stringify({ parcelId: returnParcelId, reason: returnReason }),
      });
      setFeedback('Return pickup request submitted.');
      setReturnReason('');
      setReturnParcelId('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Return request failed');
    }
  }

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await apiRequest('/customer/support-tickets', {
        method: 'POST',
        token,
        body: JSON.stringify({ subject: ticketSubject, description: ticketDesc }),
      });
      setFeedback('Support ticket submitted. Our operations desk will respond shortly.');
      setTicketSubject('');
      setTicketDesc('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Ticket submission failed');
    }
  }

  return (
    <DashboardShell
      title="Resident Parcel Dashboard"
      subtitle={`Flat ${user?.flat_number || 'Not set'} • Manage incoming parcels, schedule doorstep slots, and view OTP alerts`}
    >
      {feedback && (
        <div className="mb-6 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Parcels List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0a192f]">
            <Package className="h-4 w-4 text-cyan-600" />
            Your Parcels ({parcels.length})
          </h2>

          {parcels.length === 0 ? (
            <EmptyState title="No parcels yet" description="Incoming packages addressed to your flat will appear here automatically." />
          ) : (
            parcels.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-[#0a192f]">{p.internal_parcel_code}</span>
                      <StatusBadge status={p.current_status} />
                    </div>
                    <p className="text-sm font-medium text-slate-800">{p.description}</p>
                    <p className="text-xs text-slate-500">
                      {p.courier_name} • Tracking: {p.external_tracking_id}
                      {p.storage_location ? ` • Rack: ${p.storage_location}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-1.5" title="Opaque QR (Zero PII)">
                      <QRCodeSVG value={p.qr_token} size={56} />
                    </div>
                    {['Stored', 'Ready for delivery', 'Delivery attempted', 'Delivery scheduled'].includes(p.current_status) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedParcel(p);
                          if (slots[0]) setSelectedSlotId(slots[0].id);
                        }}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {p.current_status === 'Delivery scheduled' ? 'Reschedule' : 'Schedule Slot'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}

          {/* Slot Scheduling Modal/Panel */}
          {selectedParcel && (
            <Card className="border-cyan-300 bg-cyan-50/40 p-6">
              <h3 className="text-base font-bold text-[#0a192f]">
                Reserve Delivery Window for {selectedParcel.internal_parcel_code}
              </h3>
              <form onSubmit={handleBookSlot} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-slate-600">Available Slots</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={selectedSlotId}
                    onChange={(e) => setSelectedSlotId(e.target.value)}
                    required
                  >
                    {slots.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.booked_count >= s.max_capacity}>
                        {s.slot_date} | {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)} ({s.max_capacity - s.booked_count} spots left)
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Doorstep Instructions (Optional)"
                  placeholder="e.g. Ring bell once"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button type="submit">Confirm Slot</Button>
                  <Button type="button" variant="outline" onClick={() => setSelectedParcel(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Notifications, Return Pickup, Support */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
              <Bell className="h-4 w-4 text-cyan-600" />
              Notifications & OTP Alerts
            </h3>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500">No new notifications.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
              <RotateCcw className="h-4 w-4 text-cyan-600" />
              Request Return Pickup
            </h3>
            <form onSubmit={handleReturnSubmit} className="mt-3 space-y-3">
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                value={returnParcelId}
                onChange={(e) => setReturnParcelId(e.target.value)}
                required
              >
                <option value="">Select parcel...</option>
                {parcels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internal_parcel_code} - {p.description}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Reason for return..."
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
              <Button type="submit" size="sm" variant="outline" className="w-full">
                Submit Return Request
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0a192f]">
              <HelpCircle className="h-4 w-4 text-cyan-600" />
              Support Desk
            </h3>
            <form onSubmit={handleTicketSubmit} className="mt-3 space-y-3">
              <Input
                placeholder="Subject"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
              <textarea
                rows={2}
                placeholder="Describe your issue..."
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                Create Support Ticket
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
