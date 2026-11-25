import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function ForEcommercePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0a192f]">For E-Commerce & Courier Partners</h1>
        <p className="mt-3 text-slate-600">
          Reduce first-attempt delivery failures (RTO), consolidate society drop-offs, and integrate via authenticated REST & webhook APIs.
        </p>
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <strong>Integration Transparency Notice:</strong> Proposed compatibility targets (Amazon, Flipkart, Meesho, Myntra, and 3PL couriers) represent future integration architecture. Live partner sync activates only upon formal commercial agreements and API credential provisioning.
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0a192f]">Single-Point Hub Drop-off</h2>
            <p className="mt-2 text-sm text-slate-600">Deliver 50+ society parcels at one gate hub in minutes instead of spending hours navigating residential towers.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0a192f]">Signed Webhook Architecture</h2>
            <p className="mt-2 text-sm text-slate-600">HMAC-SHA256 signed webhooks with timestamp replay protection keep order statuses synchronized securely.</p>
          </div>
        </div>
        <div className="mt-8">
          <Link href="/partnership" className="inline-block rounded-lg bg-[#0a192f] px-5 py-2.5 text-sm font-semibold text-white">
            Apply for Sandbox Integration
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
