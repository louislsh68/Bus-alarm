import { db } from '../../db.js';

const clearRouteFamiliesCacheStmt = db.prepare(`DELETE FROM route_families_cache`);
const clearRefreshStatePrefixStmt = db.prepare(`DELETE FROM refresh_state WHERE catalog_name LIKE ?`);
const clearStopSnapshotsStmt = db.prepare(`DELETE FROM stop_snapshots`);

const maintenanceResetTx = db.transaction(() => {
  clearRouteFamiliesCacheStmt.run();
  clearStopSnapshotsStmt.run();
  clearRefreshStatePrefixStmt.run('route_families:%');
  clearRefreshStatePrefixStmt.run('stop_snapshots:%');
});

export function resetCanonicalTransitCaches(): void {
  maintenanceResetTx();
}

export function getCanonicalTransitCacheStats(): {
  routeFamiliesCacheRows: number;
  stopSnapshotRows: number;
  refreshStateRows: number;
} {
  const routeFamiliesCacheRows = (db.prepare(`SELECT COUNT(*) AS count FROM route_families_cache`).get() as { count: number }).count;
  const stopSnapshotRows = (db.prepare(`SELECT COUNT(*) AS count FROM stop_snapshots`).get() as { count: number }).count;
  const refreshStateRows = (db.prepare(`
    SELECT COUNT(*) AS count
    FROM refresh_state
    WHERE catalog_name LIKE 'route_families:%' OR catalog_name LIKE 'stop_snapshots:%'
  `).get() as { count: number }).count;

  return { routeFamiliesCacheRows, stopSnapshotRows, refreshStateRows };
}
