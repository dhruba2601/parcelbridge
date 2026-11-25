'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    switch (user.role_code) {
      case 'super_admin':
      case 'society_admin':
      case 'hub_manager':
        router.replace('/dashboard/admin');
        break;
      case 'delivery_personnel':
        router.replace('/dashboard/delivery');
        break;
      case 'business_partner':
        router.replace('/dashboard/partner');
        break;
      default:
        router.replace('/dashboard/customer');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
      Routing to your role workspace...
    </div>
  );
}
