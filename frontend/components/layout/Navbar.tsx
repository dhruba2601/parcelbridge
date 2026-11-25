'use client';

import Link from 'next/link';
import { Package, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/features', label: 'Features' },
  { href: '/for-ecommerce', label: 'For E-Commerce' },
  { href: '/for-societies', label: 'For Societies' },
  { href: '/partnership', label: 'Partnerships' },
  { href: '/track', label: 'Track Parcel' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a192f] text-cyan-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#0a192f]">PARCELBRIDGE</span>
            <span className="hidden sm:block text-[10px] font-medium uppercase tracking-widest text-slate-500">
              Scheduled Last-Mile Network
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#0a192f]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-[#112240]"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-[#112240]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Toggle Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-1.5 text-sm font-medium text-slate-700"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100 flex gap-3">
            {user ? (
              <Link href="/dashboard" className="w-full text-center rounded-lg bg-[#0a192f] py-2 text-sm font-medium text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="flex-1 text-center rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700">
                  Sign in
                </Link>
                <Link href="/register" className="flex-1 text-center rounded-lg bg-[#0a192f] py-2 text-sm font-medium text-white">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
