'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Card, Input } from '@/components/ui/Primitives';
import { apiRequest } from '@/services/api';

export default function PartnershipPage() {
  const [form, setForm] = useState({
    companyName: '',
    partnerType: 'ecommerce',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    monthlyParcelVolume: 5000,
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      await apiRequest('/partners/apply', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          monthlyParcelVolume: Number(form.monthlyParcelVolume),
        }),
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-14 sm:px-6 w-full">
        <h1 className="text-3xl font-bold text-[#0a192f]">Business & Logistics Partnership Portal</h1>
        <p className="mt-2 text-sm text-slate-600">
          For e-commerce marketplaces, courier companies, logistics operators, property management firms, and residential societies.
        </p>

        <Card className="mt-8 p-6 sm:p-8">
          {status === 'success' ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-5 text-emerald-900">
              <h2 className="text-base font-semibold">Partnership Application Received</h2>
              <p className="mt-1 text-sm">
                Thank you for applying to PARCELBRIDGE. Our partnerships team will review your enquiry and provision sandbox webhook documentation upon approval.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Company / Society Name"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Partner Category
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    value={form.partnerType}
                    onChange={(e) => setForm({ ...form, partnerType: e.target.value })}
                  >
                    <option value="ecommerce">E-commerce Platform</option>
                    <option value="courier">Courier Company</option>
                    <option value="logistics_operator">Logistics Operator</option>
                    <option value="property_management">Property Management</option>
                    <option value="residential_society">Residential Society</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Contact Person"
                  required
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
                <Input
                  label="Work Email"
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Phone Number"
                  required
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
                <Input
                  label="Est. Monthly Parcel Volume"
                  type="number"
                  min={0}
                  value={form.monthlyParcelVolume}
                  onChange={(e) => setForm({ ...form, monthlyParcelVolume: Number(e.target.value) })}
                />
              </div>

              <Input
                label="Website URL (Optional)"
                type="url"
                placeholder="https://example.com"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              />

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Integration / Deployment Notes
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              {status === 'error' && <p className="text-xs text-rose-600">{errorMsg}</p>}

              <Button type="submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting...' : 'Submit Partnership Enquiry'}
              </Button>
            </form>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
