import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/Primitives';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-16 sm:px-6 w-full">
        <h1 className="text-3xl font-bold text-[#0a192f]">Contact PARCELBRIDGE</h1>
        <p className="mt-2 text-sm text-slate-600">Reach our enterprise onboarding, society deployment, or support teams.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <Mail className="h-5 w-5 text-cyan-600" />
            <h2 className="mt-3 text-sm font-semibold text-[#0a192f]">Enterprise & Partnerships</h2>
            <p className="mt-1 text-xs text-slate-600">partnerships@parcelbridge.io</p>
          </Card>
          <Card className="p-6">
            <Phone className="h-5 w-5 text-cyan-600" />
            <h2 className="mt-3 text-sm font-semibold text-[#0a192f]">Operations Desk</h2>
            <p className="mt-1 text-xs text-slate-600">+91-80-4000-2026 (07:00 - 22:00 IST)</p>
          </Card>
          <Card className="p-6">
            <MapPin className="h-5 w-5 text-cyan-600" />
            <h2 className="mt-3 text-sm font-semibold text-[#0a192f]">Headquarters</h2>
            <p className="mt-1 text-xs text-slate-600">Outer Ring Road, Bellandur, Bengaluru 560103</p>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
