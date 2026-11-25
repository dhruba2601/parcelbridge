import Link from 'next/link';
import { ArrowRight, CalendarClock, Lock, QrCode, ShieldCheck, Building2, Truck, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#0a192f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Universal Last-Mile Parcel Infrastructure
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
                Your Parcels. <span className="text-cyan-400">Your Time.</span> Your Convenience.
              </h1>
              <p className="max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed">
                A unified parcel management and scheduled last-mile delivery network designed to make online shopping deliveries more convenient.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Create Resident Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/track"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Track a Parcel
                </Link>
              </div>
              <p className="text-xs text-slate-400">
                Built for residential societies, smart parcel hubs, courier fleets, and e-commerce ecosystems.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700/80 bg-[#112240]/90 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-cyan-400">Live Workflow Preview</p>
                  <h3 className="text-base font-semibold text-white">Skyline Gate-1 Smart Hub</h3>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  Operational
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  { step: '01', title: 'Hub Intake & Opaque QR Tagging', desc: 'Courier drops parcel at society hub; zero PII exposed on QR labels.' },
                  { step: '02', title: 'Atomic Time-Slot Reservation', desc: 'Resident picks a 2-hour doorstep delivery window with capacity locking.' },
                  { step: '03', title: 'OTP-Verified Doorstep Handover', desc: 'Delivery staff verifies 6-digit hashed OTP before marking Delivered.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-300">
                      {item.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <p className="mt-0.5 text-xs text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-[#0a192f]">
            Eliminate Missed Deliveries & Gate Congestion
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            One platform connecting couriers, residential society hubs, delivery personnel, and residents with end-to-end auditability.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: QrCode,
              title: 'Privacy-Preserving QR Codes',
              desc: 'HMAC-SHA256 signed opaque parcel tokens identify packages at the hub without printing resident names, flats, or phone numbers.',
            },
            {
              icon: CalendarClock,
              title: 'Concurrency-Safe Scheduling',
              desc: 'PostgreSQL row-level locking prevents two residents from booking the final capacity of a delivery window simultaneously.',
            },
            {
              icon: Lock,
              title: 'Hashed OTP Handover',
              desc: 'Every doorstep delivery is confirmed with a time-limited, attempt-capped 6-digit OTP stored exclusively as a cryptographic hash.',
            },
            {
              icon: Building2,
              title: 'Residential Society Hubs',
              desc: 'Centralized intake rooms keep delivery riders at the perimeter while consolidating doorstep runs into scheduled EV cart trips.',
            },
            {
              icon: Truck,
              title: 'Courier & E-Commerce Ready',
              desc: 'Authenticated webhook endpoints ready for future integrations with Amazon, Flipkart, Meesho, Myntra, and 3PL couriers.',
            },
            {
              icon: CheckCircle2,
              title: 'Full Audit & Role Governance',
              desc: 'Six distinct RBAC roles with Supabase Row Level Security and immutable parcel lifecycle event logs.',
            },
          ].map((feat) => (
            <div key={feat.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0a192f] text-cyan-400">
                <feat.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#0a192f]">{feat.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-slate-100 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-[#0a192f]">Ready to modernize last-mile delivery?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Explore the live interactive dashboards as a Resident, Hub Admin, Delivery Staff, or Business Partner.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-[#0a192f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#112240]"
            >
              Launch Demo Portal
            </Link>
            <Link
              href="/partnership"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Partner With Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
