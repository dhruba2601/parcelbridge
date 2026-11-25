import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-16 sm:px-6 space-y-4">
        <h1 className="text-3xl font-bold text-[#0a192f]">Terms & Conditions</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          By registering with PARCELBRIDGE, residents and partner organizations agree to use scheduled delivery windows responsibly, keep handover OTPs confidential, and abide by residential society hub operating hours.
        </p>
      </main>
      <Footer />
    </div>
  );
}
