import { db } from '../../db.js';

const summarizeStopSnapshotsStmt = db.prepare(`
  SELECT company, COUNT(*) AS rows_count, COUNT(DISTINCT route || '::' || direction || '::' || service_type) AS variant_count, MAX(updated_at) AS latest_updated_at
  FROM stop_snapshots
  GROUP BY company
  ORDER BY company ASC
`);

const getStopSnapshotScopeStmt = db.prepare(`
  SELECT company, route, direction, service_type, COUNT(*) AS stop_count, MAX(updated_at) AS updated_at
  FROM stop_snapshots
  WHERE company = ? AND route = ? AND direction = ? AND service_type = ?
  GROUP BY company, route, direction, service_type
`);

export function summarizeStopSnapshots(): Array<{
  company: string;
  rowsCount: number;
  variantCount: number;
  latestUpdatedAt: string | null;
}> {
  const rows = summarizeStopSnapshotsStmt.all() as Array<{
    company: string;
    rows_count: number;
    variant_count: number;
    latest_updated_at: string | null;
  }>;

  return rows.map((row) => ({
    company: row.company,
    rowsCount: row.rows_count,
    variantCount: row.variant_count,
    latestUpdatedAt: row.latest_updated_at,
  }));
}

export function getStopSnapshotScope(params: {
  company: string;
  route: string;
  direction: string;
  serviceType: string;
}): {
  company: string;
  route: string;
  direction: string;
  serviceType: string;
  stopCount: number;
  updatedAt: string | null;
} | null {
  const row = getStopSnapshotScopeStmt.get(params.company, params.route, params.direction, params.serviceType) as {
    company: string;
    route: string;
    direction: string;
    service_type: string;
    stop_count: number;
    updated_at: string | null;
  } | undefined;

  if (!row) return null;

  return {
    company: row.company,
    route: row.route,
    direction: row.direction,
    serviceType: row.service_type,
    stopCount: row.stop_count,
    updatedAt: row.updated_at,
  };
}
