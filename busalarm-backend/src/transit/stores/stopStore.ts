import { db } from '../../db.js';
import type { StopSnapshotRecord } from '../../types.js';

const deleteStopSnapshotScopeStmt = db.prepare(`
  DELETE FROM stop_snapshots
  WHERE company = @company AND route = @route AND direction = @direction AND service_type = @service_type
`);

const insertStopSnapshotStmt = db.prepare(`
  INSERT INTO stop_snapshots (company, route, direction, service_type, stop_id, stop_name, sequence, updated_at)
  VALUES (@company, @route, @direction, @service_type, @stop_id, @stop_name, @sequence, @updated_at)
`);

const getStopSnapshotStmt = db.prepare(`
  SELECT company, route, direction, service_type, stop_id, stop_name, sequence
  FROM stop_snapshots
  WHERE company = ? AND route = ? AND direction = ? AND service_type = ?
  ORDER BY sequence ASC
`);

const replaceStopSnapshotTx = db.transaction((records: StopSnapshotRecord[]) => {
  if (records.length === 0) return;

  const first = records[0];
  deleteStopSnapshotScopeStmt.run({
    company: first.company,
    route: first.route,
    direction: first.direction,
    service_type: first.serviceType,
  });

  const updatedAt = new Date().toISOString();
  for (const record of records) {
    insertStopSnapshotStmt.run({
      company: record.company,
      route: record.route,
      direction: record.direction,
      service_type: record.serviceType,
      stop_id: record.stopId,
      stop_name: record.stopName,
      sequence: record.sequence,
      updated_at: updatedAt,
    });
  }
});

export function saveStopSnapshot(records: StopSnapshotRecord[]): void {
  replaceStopSnapshotTx(records);
}

export function loadStopSnapshot(params: {
  company: string;
  route: string;
  direction: string;
  serviceType: string;
}): { updatedAt: string | null; data: StopSnapshotRecord[] } {
  const rows = getStopSnapshotStmt.all(params.company, params.route, params.direction, params.serviceType) as Array<{
    company: string;
    route: string;
    direction: 'outbound' | 'inbound';
    service_type: string;
    stop_id: string;
    stop_name: string;
    sequence: number;
  }>;

  const data = rows.map((row) => ({
    company: row.company as StopSnapshotRecord['company'],
    route: row.route,
    direction: row.direction,
    serviceType: row.service_type,
    stopId: row.stop_id,
    stopName: row.stop_name,
    sequence: row.sequence,
  }));

  const updatedAt = data.length > 0
    ? ((db.prepare(`
        SELECT MAX(updated_at) AS updated_at
        FROM stop_snapshots
        WHERE company = ? AND route = ? AND direction = ? AND service_type = ?
      `).get(params.company, params.route, params.direction, params.serviceType) as { updated_at: string | null }).updated_at ?? null)
    : null;

  return { updatedAt, data };
}
