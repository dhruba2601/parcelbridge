'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Card, Input } from '@/components/ui/Primitives';
import { useAuth } from '@/hooks/useAuth';

const DEMO_ACCOUNTS = [
  { label: 'Resident (Customer)', email: 'customer.demo@parcelbridge.io' },
  { label: 'Super Admin', email: 'admin.demo@parcelbridge.io' },
  { label: 'Hub Manager', email: 'hub.demo@parcelbridge.io' },
  { label: 'Delivery Staff', email: 'delivery.demo@parcelbridge.io' },
  { label: 'Business Partner', email: 'partner.demo@parcelbridge.io' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-14 w-full">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0a192f]">Sign in to PARCELBRIDGE</h1>
          <p className="mt-1 text-xs text-slate-500">Access your resident, hub, delivery, or partner workspace.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {isDemoMode && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Demo Quick-Fill (Password: DemoPass@2026)
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('DemoPass@2026');
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-600">
            New resident?{' '}
            <Link href="/register" className="font-semibold text-cyan-700 hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
