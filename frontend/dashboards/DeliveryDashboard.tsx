'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Truck } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button, Card, EmptyState, Input } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/parcels/StatusBadge';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface AssignmentItem {
  id: string;
  parcel_id: string;
  route_notes: string | null;
  status: string;
  parcel?: {
    internal_parcel_code: string;
    description: string;
    current_status: string;
  };
  customer?: {
    full_name: string;
    flat_number: string | null;
    phone: string | null;
  };
}

export default function DeliveryDashboardPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [otpMap, setOtpMap] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');

  const loadAssignments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ assignments: AssignmentItem[] }>('/delivery/assignments', { token });
      setAssignments(res.assignments);
    } catch {
      // handled
    }
  }, [token]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  async function handleConfirmHandover(parcelId: string) {
    if (!token) return;
    const otp = otpMap[parcelId]?.trim();
    if (!otp || otp.length !== 6) {
      setFeedback('Enter the 6-digit customer OTP before confirming delivery.');
      return;
    }
    setFeedback('');
    try {
      await apiRequest('/delivery/confirm', {
        method: 'POST',
        token,
        body: JSON.stringify({ parcelId, otp }),
      });
      setFeedback('OTP verified and delivery confirmed!');
      await loadAssignments();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'OTP verification failed');
    }
  }

  return (
    <DashboardShell
      title="Delivery Staff Mobile Console"
      subtitle="View assigned flat deliveries, route notes, and complete OTP-verified handovers"
    >
      {feedback && (
        <div className="mb-6 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
          {feedback}
        </div>
      )}

      <div className="space-y-4 max-w-2xl">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#0a192f]">
          <Truck className="h-4 w-4 text-cyan-600" />
          Assigned Deliveries ({assignments.length})
        </h2>

        {assignments.length === 0 ? (
          <EmptyState title="No active assignments" description="Assigned society deliveries will appear here." />
        ) : (
          assignments.map((a) => (
            <Card key={a.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0a192f]">
                      {a.parcel?.internal_parcel_code || a.parcel_id}
                    </span>
                    <StatusBadge status={a.parcel?.current_status || a.status} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{a.parcel?.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Resident: {a.customer?.full_name} • Flat {a.customer?.flat_number || 'N/A'}
                  </p>
                  {a.route_notes && <p className="mt-1 text-xs text-cyan-700">Route: {a.route_notes}</p>}
                </div>
              </div>

              {a.status !== 'completed' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter 6-digit handover OTP"
                      maxLength={6}
                      value={otpMap[a.parcel_id] || ''}
                      onChange={(e) => setOtpMap({ ...otpMap, [a.parcel_id]: e.target.value })}
                    />
                  </div>
                  <Button onClick={() => handleConfirmHandover(a.parcel_id)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Verify OTP & Deliver
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
