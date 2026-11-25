import Link from 'next/link';
import { Package } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#0a192f] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-400" />
              <span className="text-base font-bold text-white">PARCELBRIDGE</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Your Parcels. Your Time. Your Convenience. Unified parcel management and scheduled last-mile delivery infrastructure for modern residential communities.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Platform</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/how-it-works" className="hover:text-cyan-400">How It Works</Link></li>
              <li><Link href="/features" className="hover:text-cyan-400">Features</Link></li>
              <li><Link href="/track" className="hover:text-cyan-400">Track Parcel</Link></li>
              <li><Link href="/about" className="hover:text-cyan-400">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Ecosystem</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/for-ecommerce" className="hover:text-cyan-400">For E-Commerce Companies</Link></li>
              <li><Link href="/for-societies" className="hover:text-cyan-400">For Residential Societies</Link></li>
              <li><Link href="/partnership" className="hover:text-cyan-400">Partner Portal</Link></li>
              <li><Link href="/contact" className="hover:text-cyan-400">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Legal & Trust</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/privacy" className="hover:text-cyan-400">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-cyan-400">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PARCELBRIDGE Technologies. All rights reserved.</p>
          <p>Proposed integrations (Amazon, Flipkart, Meesho, Myntra) represent target ecosystem compatibility, not active commercial partnerships.</p>
        </div>
      </div>
    </footer>
  );
}
