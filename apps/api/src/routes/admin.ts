import { Hono } from 'hono'
import type { AppEnv } from '../context'
import { adminOnly, authed } from '../middleware'
import { adminPlateRoutes } from './admin/plates'
import { adminUserRoutes } from './admin/users'
import { adminVehicleRoutes } from './admin/vehicles'

/** Everything under /api/admin requires an admin session. */
export const adminRoutes = new Hono<AppEnv>()
  .use(authed, adminOnly)
  .route('/users', adminUserRoutes)
  .route('/vehicles', adminVehicleRoutes)
  .route('/plates', adminPlateRoutes)
