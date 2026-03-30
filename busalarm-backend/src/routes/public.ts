import { Router } from 'express';
import { registerDevice, listDevicesForUser } from '../alarm/stores/deviceStore.js';
import { createAlarm, createUser, getUser, listAlarmsForUser } from '../alarm/stores/store.js';
import { fetchETA, fetchRouteFamilies, fetchRoutes, fetchStops } from '../transit/services/hkBus.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'busalarm-backend', time: new Date().toISOString() });
  });

  router.get('/api/routes', async (req, res) => {
    try {
      const company = typeof req.query.company === 'string' ? req.query.company : undefined;
      const routes = await fetchRoutes(company);
      res.json({ ok: true, count: routes.length, meta: { company: company?.toUpperCase(), builtAt: new Date().toISOString() }, data: routes });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/api/route-families', async (req, res) => {
    try {
      const company = typeof req.query.company === 'string' ? req.query.company : undefined;
      const families = await fetchRouteFamilies(company);
      res.json({
        ok: true,
        count: families.data.length,
        meta: {
          company: company?.toUpperCase(),
          cachedAt: families.updatedAt,
          builtAt: families.updatedAt,
          isStale: Date.now() - new Date(families.updatedAt).getTime() > 24 * 60 * 60 * 1000,
        },
        data: families.data,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/api/stops', async (req, res) => {
    try {
      const company = String(req.query.company || '');
      const route = String(req.query.route || '');
      const direction = String(req.query.direction || '');
      const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : '1';

      if (!company || !route || !direction) {
        return res.status(400).json({ ok: false, error: 'company, route, and direction are required' });
      }

      const stops = await fetchStops({ company, route, direction, serviceType });
      return res.json({
        ok: true,
        count: stops.data.length,
        meta: {
          company: company.toUpperCase(),
          route,
          direction,
          serviceType,
          cachedAt: stops.updatedAt,
          isStale: stops.updatedAt ? (Date.now() - new Date(stops.updatedAt).getTime() > 24 * 60 * 60 * 1000) : null,
        },
        data: stops.data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.startsWith('Unsupported ') ? 400 : 500;
      return res.status(status).json({ ok: false, error: message });
    }
  });

  router.get('/api/eta', async (req, res) => {
    try {
      const company = String(req.query.company || '');
      const route = String(req.query.route || '');
      const stopId = String(req.query.stopId || '');
      const direction = typeof req.query.direction === 'string' ? req.query.direction : undefined;
      const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : '1';

      if (!company || !route || !stopId) {
        return res.status(400).json({ ok: false, error: 'company, route, and stopId are required' });
      }

      const eta = await fetchETA({ company, route, stopId, direction, serviceType });
      return res.json({ ok: true, count: eta.length, data: eta });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.startsWith('Unsupported ') ? 400 : 500;
      return res.status(status).json({ ok: false, error: message });
    }
  });

  router.post('/api/users', (_req, res) => {
    const user = createUser();
    res.status(201).json({ ok: true, data: user });
  });

  router.get('/api/users/:userId', (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    return res.json({ ok: true, data: user });
  });

  router.post('/api/users/:userId/alarms', (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const { route, company, stopId, stopName, direction, serviceType = '1', repeatDays, startTime, endTime, enabled = true } = req.body ?? {};

    if (!route || !company || !stopId || !stopName || !direction || !Array.isArray(repeatDays) || !startTime || !endTime) {
      return res.status(400).json({
        ok: false,
        error: 'route, company, stopId, stopName, direction, repeatDays, startTime, and endTime are required',
      });
    }

    const alarm = createAlarm({
      userId: user.id,
      route,
      company,
      stopId,
      stopName,
      direction,
      serviceType,
      repeatDays,
      startTime,
      endTime,
      enabled,
    });

    return res.status(201).json({ ok: true, data: alarm });
  });

  router.get('/api/users/:userId/alarms', (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const alarms = listAlarmsForUser(user.id);
    return res.json({ ok: true, count: alarms.length, data: alarms });
  });

  router.post('/api/users/:userId/devices', (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const { platform, pushToken, deviceName = null, appVersion = null } = req.body ?? {};
    if (!platform || !pushToken || !['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ ok: false, error: 'platform (ios|android|web) and pushToken are required' });
    }

    const device = registerDevice({
      userId: user.id,
      platform,
      pushToken,
      deviceName,
      appVersion,
    });

    return res.status(201).json({ ok: true, data: device });
  });

  router.get('/api/users/:userId/devices', (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const devices = listDevicesForUser(user.id);
    return res.json({ ok: true, count: devices.length, data: devices });
  });

  return router;
}
