import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0a192f]">About PARCELBRIDGE</h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          PARCELBRIDGE is a universal e-commerce parcel management and scheduled last-mile delivery technology platform built to solve the chaos of uncoordinated doorstep deliveries in high-density residential communities.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0a192f]">The Problem</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Residents miss packages during work hours, couriers waste fuel on repeated attempts, and society gates face constant security and traffic bottlenecks.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0a192f]">Our Solution</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              A two-stage hub-and-slot architecture: couriers drop parcels once at secure society hubs, and residents schedule verified OTP-protected doorstep delivery when they are home.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
