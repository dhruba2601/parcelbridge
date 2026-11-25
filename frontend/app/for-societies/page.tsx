import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function ForSocietiesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0a192f]">For Residential Societies & RWAs</h1>
        <p className="mt-3 text-slate-600">
          Upgrade security, declutter lobby areas, and offer residents hotel-grade scheduled parcel delivery.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ['Gate Security', 'Minimize unverified courier movement inside residential towers and elevators.'],
            ['Zero Lobby Clutter', 'All incoming packages are logged, QR-tagged, and stored in organized hub racks.'],
            ['Society Admin Portal', 'Dedicated dashboard for society managers to monitor hub occupancy and resident satisfaction.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-[#0a192f]">{t}</h2>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/partnership" className="inline-block rounded-lg bg-[#0a192f] px-5 py-2.5 text-sm font-semibold text-white">
            Register Your Society
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
