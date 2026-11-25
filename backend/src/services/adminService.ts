import { env } from '../config/env';
import { getSupabaseAdmin } from '../config/supabase';
import { repo } from '../db/repository';

export async function getAdminDashboardMetrics() {
  const [profiles, societies, hubs, parcels, bookings, partners] = await Promise.all([
    repo.listProfiles(),
    repo.listSocieties(),
    repo.listHubs(),
    repo.listParcels(),
    repo.listBookings(),
    env.storageDriver === 'supabase'
      ? getSupabaseAdmin().from('business_partners').select('*').then((r) => r.data ?? [])
      : Promise.resolve(repo.memory.partners),
  ]);

  const customers = profiles.filter((p) => p.role_code === 'customer');
  const storedCount = parcels.filter((p) => ['Stored', 'Ready for delivery'].includes(p.current_status)).length;
  const scheduledCount = parcels.filter((p) => p.current_status === 'Delivery scheduled').length;
  const completedCount = parcels.filter((p) => p.current_status === 'Delivered').length;
  const failedAttempts = parcels.filter((p) => p.current_status === 'Delivery attempted').length;
  const pendingCount = parcels.filter((p) =>
    ['Expected', 'Received at hub', 'Scanned', 'Verified'].includes(p.current_status)
  ).length;

  return {
    metrics: {
      totalCustomers: customers.length,
      totalSocieties: societies.length,
      totalHubs: hubs.length,
      totalParcelsReceived: parcels.length,
      parcelsCurrentlyStored: storedCount,
      scheduledDeliveries: scheduledCount,
      completedDeliveries: completedCount,
      failedDeliveryAttempts: failedAttempts,
      pendingParcels: pendingCount,
      activeBookings: bookings.filter((b) => b.status === 'confirmed').length,
      partnerEnquiries: partners.length,
    },
    recentParcels: parcels.slice(0, 10),
    societies,
    hubs,
  };
}
