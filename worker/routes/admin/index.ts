/** /api/admin/* : semua dilindungi Cloudflare Access + admin_users (middleware requireAdmin). */
import { createRouter } from '../../app';
import { requireAdmin } from '../../middleware/admin';
import { adminBookingRoutes } from './bookings';
import { adminCustomerRoutes, adminReportRoutes } from './customers';
import { adminSettingsRoutes } from './settings';
import { adminLoyaltyRoutes } from './loyalty';
import { adminShopRoutes } from './shop';

export const adminRoutes = createRouter();
adminRoutes.use('*', requireAdmin);
adminRoutes.route('/', adminBookingRoutes);
adminRoutes.route('/', adminCustomerRoutes);
adminRoutes.route('/', adminSettingsRoutes);
adminRoutes.route('/', adminLoyaltyRoutes);
adminRoutes.route('/', adminShopRoutes);
adminRoutes.route('/reports', adminReportRoutes);
