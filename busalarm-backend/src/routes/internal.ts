import type express from 'express';
import { Router } from 'express';
import { listRefreshStates } from '../transit/stores/catalogStore.js';
import { getCanonicalTransitCacheStats, resetCanonicalTransitCaches } from '../transit/stores/maintenanceStore.js';
import { summarizeStopSnapshots, getStopSnapshotScope } from '../transit/services/stopAdminService.js';
import { auditCTBEmptyStopVariants } from '../transit/services/ctbAuditService.js';
import { refreshCanonicalTransitData } from '../services/canonicalRefreshService.js';
import { rebuildCTBStopSnapshots } from '../transit/services/ctbBulkStopService.js';
import { rebuildKMBStopSnapshots } from '../transit/services/kmbBulkStopService.js';
import { getStopSnapshotRefreshState, runStopSnapshotRefresh } from '../transit/services/stopRefreshService.js';
import { rebuildRouteFamiliesSnapshot, refreshRouteFamiliesCache } from '../transit/services/hkBus.js';

function requireAdminRefreshKey(req: express.Request, res: express.Response): boolean {
  const adminKey = process.env.ADMIN_REFRESH_KEY;
  if (!adminKey || req.header('x-admin-refresh-key') !== adminKey) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function createInternalRouter(): Router {
  const router = Router();

  router.get('/internal/refresh/status', (_req, res) => {
    return res.json({ ok: true, data: listRefreshStates() });
  });

  router.get('/internal/maintenance/cache-stats', (_req, res) => {
    return res.json({ ok: true, data: getCanonicalTransitCacheStats() });
  });

  router.get('/internal/stops/status', (_req, res) => {
    return res.json({
      ok: true,
      data: {
        refreshStates: [getStopSnapshotRefreshState('KMB'), getStopSnapshotRefreshState('CTB')].filter(Boolean),
        summaries: summarizeStopSnapshots(),
      },
    });
  });

  router.get('/internal/stops/scope', (req, res) => {
    const company = String(req.query.company || '').toUpperCase();
    const route = String(req.query.route || '');
    const direction = String(req.query.direction || '');
    const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : '1';

    if (!company || !route || !direction) {
      return res.status(400).json({ ok: false, error: 'company, route, and direction are required' });
    }

    const scope = getStopSnapshotScope({ company, route, direction, serviceType });
    return res.json({ ok: true, data: scope });
  });

  router.get('/internal/audit/ctb-empty-stop-variants', async (_req, res) => {
    try {
      const data = await auditCTBEmptyStopVariants();
      return res.json({ ok: true, count: data.length, data });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/refresh/catalog', async (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      const company = typeof req.query.company === 'string' ? req.query.company : undefined;
      const families = await refreshRouteFamiliesCache(company);
      return res.json({ ok: true, count: families.length, data: families });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/rebuild/catalog', async (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      const company = typeof req.query.company === 'string' ? req.query.company : undefined;
      const families = await rebuildRouteFamiliesSnapshot(company);
      return res.json({ ok: true, count: families.length, data: families });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/rebuild/stops/kmb', async (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      const result = await runStopSnapshotRefresh({ company: 'KMB', runner: rebuildKMBStopSnapshots });
      return res.json({ ok: true, data: result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/rebuild/stops/ctb', async (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      const result = await runStopSnapshotRefresh({ company: 'CTB', runner: rebuildCTBStopSnapshots });
      return res.json({ ok: true, data: result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/maintenance/reset-canonical-caches', (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      resetCanonicalTransitCaches();
      return res.json({ ok: true, data: getCanonicalTransitCacheStats() });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/internal/maintenance/refresh-canonical', async (req, res) => {
    if (!requireAdminRefreshKey(req, res)) return;

    try {
      const result = await refreshCanonicalTransitData();
      return res.json({ ok: true, data: result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
}

