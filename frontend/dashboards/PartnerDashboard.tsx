'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Webhook } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Primitives';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface PartnerApp {
  id: string;
  company_name: string;
  partner_type: string;
  status: string;
  monthly_parcel_volume: number;
  created_at: string;
}

export default function PartnerDashboardPage() {
  const { token } = useAuth();
  const [apps, setApps] = useState<PartnerApp[]>([]);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ applications: PartnerApp[] }>('/partners/applications', { token })
      .then((d) => setApps(d.applications))
      .catch(() => {});
  }, [token]);

  return (
    <DashboardShell
      title="Business & Logistics Partner Portal"
      subtitle="Track partnership onboarding status and review signed webhook integration specifications"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0a192f]">
            <Briefcase className="h-4 w-4 text-cyan-600" />
            Partnership Applications
          </h2>
          <div className="mt-4 space-y-3">
            {apps.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0a192f]">{a.company_name}</p>
                  <p className="text-xs text-slate-500">
                    {a.partner_type} • {a.monthly_parcel_volume.toLocaleString()} parcels/mo
                  </p>
                </div>
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/partnership" className="text-xs font-semibold text-cyan-700 hover:underline">
              + Submit new partnership enquiry
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#0a192f]">
            <Webhook className="h-4 w-4 text-cyan-600" />
            Webhook Integration Specification
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            External courier and e-commerce systems push parcel lifecycle events to <code className="bg-slate-100 px-1 rounded">POST /api/v1/webhooks/courier-event</code> with HMAC-SHA256 signatures.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[#0a192f] p-4 text-[11px] text-cyan-200">
{`Headers:
  X-ParcelBridge-Timestamp: <unix-epoch-seconds>
  X-ParcelBridge-Signature: sha256=<hmac_sha256(ts + "." + body)>

Payload:
  {
    "partnerCode": "YOUR_CODE",
    "externalTrackingId": "AWB-123456",
    "eventType": "parcel.arrived_at_gate",
    "occurredAt": "2026-11-25T14:00:00Z"
  }`}
          </pre>
        </Card>
      </div>
    </DashboardShell>
  );
}
