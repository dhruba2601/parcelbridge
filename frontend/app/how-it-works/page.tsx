import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const STEPS = [
  { num: '01', title: 'Parcel Arrives at Society Hub', desc: 'Couriers drop packages at the designated PARCELBRIDGE Smart Hub instead of navigating multiple towers.' },
  { num: '02', title: 'QR Scan & Secure Rack Storage', desc: 'Hub staff scan the parcel, generate an opaque HMAC-signed QR label, and assign a rack location.' },
  { num: '03', title: 'Instant Resident Notification', desc: 'The resident receives an in-app alert with parcel metadata and available delivery windows.' },
  { num: '04', title: 'Slot Reservation', desc: 'Resident selects a convenient 2-hour window. Atomic database locking guarantees capacity accuracy.' },
  { num: '05', title: 'OTP-Verified Doorstep Handover', desc: 'Assigned delivery staff brings the parcel to the flat and confirms handover via 6-digit OTP.' },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0a192f]">How PARCELBRIDGE Works</h1>
        <p className="mt-3 text-slate-600">From courier drop-off to OTP-verified doorstep delivery in five auditable steps.</p>
        <div className="mt-10 space-y-4">
          {STEPS.map((s) => (
            <div key={s.num} className="flex gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0a192f] text-sm font-bold text-cyan-400">
                {s.num}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0a192f]">{s.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
