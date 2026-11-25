'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Card, Input } from '@/components/ui/Primitives';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface Society {
  id: string;
  name: string;
  city: string;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    societyId: '',
    flatNumber: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest<{ societies: Society[] }>('/admin/societies/public')
      .then((d) => {
        setSocieties(d.societies);
        if (d.societies.length > 0) {
          setForm((prev) => ({ ...prev, societyId: d.societies[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        societyId: form.societyId || undefined,
        flatNumber: form.flatNumber || undefined,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-14 w-full">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0a192f]">Create Resident Account</h1>
          <p className="mt-1 text-xs text-slate-500">Select your residential society to receive scheduled parcel deliveries.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Full Name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <Input
              label="Email Address"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Password (min 8 chars)"
              type="password"
              minLength={8}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                label="Flat / Apartment No."
                placeholder="e.g. A-402"
                value={form.flatNumber}
                onChange={(e) => setForm({ ...form, flatNumber: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Residential Society
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm"
                value={form.societyId}
                onChange={(e) => setForm({ ...form, societyId: e.target.value })}
              >
                <option value="">Select society...</option>
                {societies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-cyan-700 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
