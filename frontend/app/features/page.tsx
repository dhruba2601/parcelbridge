import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const FEATURES = [
  ['12-Stage Parcel Lifecycle', 'Track every transition from Expected through Stored, Scheduled, Out for delivery, Delivered, or Returned.'],
  ['Opaque QR Code Workflow', 'Cryptographically signed QR tokens prevent PII leakage on physical parcel stickers.'],
  ['Atomic Slot Engine', 'PostgreSQL row-level locks prevent double-booking on the final available slot capacity.'],
  ['Hashed OTP Handover', '6-digit OTPs are HMAC-hashed, expire in 30 minutes, and lock after 5 failed attempts.'],
  ['6-Role RBAC & RLS', 'Strict separation between Super Admin, Society Admin, Hub Manager, Delivery Staff, Customer, and Partner.'],
  ['Return Pickup Requests', 'Residents can schedule reverse-logistics pickups directly from their parcel history.'],
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0a192f]">Enterprise Platform Features</h1>
        <p className="mt-3 text-slate-600">Engineered for reliability, security, and operational visibility.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#0a192f]">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
