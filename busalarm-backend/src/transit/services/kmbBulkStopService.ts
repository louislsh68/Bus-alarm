import { db } from '../../db.js';

const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';

const deleteKMBStopSnapshotsStmt = db.prepare(`
  DELETE FROM stop_snapshots
  WHERE company = 'KMB'
`);

const insertStopSnapshotStmt = db.prepare(`
  INSERT INTO stop_snapshots (company, route, direction, service_type, stop_id, stop_name, sequence, updated_at)
  VALUES (@company, @route, @direction, @service_type, @stop_id, @stop_name, @sequence, @updated_at)
`);

const replaceKMBStopSnapshotsTx = db.transaction((rows: Array<{
  company: 'KMB';
  route: string;
  direction: 'outbound' | 'inbound';
  service_type: string;
  stop_id: string;
  stop_name: string;
  sequence: number;
  updated_at: string;
}>) => {
  deleteKMBStopSnapshotsStmt.run();
  for (const row of rows) {
    insertStopSnapshotStmt.run(row);
  }
});

function normalizeDirection(bound: string): 'outbound' | 'inbound' {
  return bound === 'I' ? 'inbound' : 'outbound';
}

export async function rebuildKMBStopSnapshots(): Promise<{ variants: number; rows: number }> {
  const [routeStopResponse, stopResponse] = await Promise.all([
    fetch(`${KMB_BASE}/route-stop`),
    fetch(`${KMB_BASE}/stop`),
  ]);

  const routeStopJson = (await routeStopResponse.json()) as { data?: any[] };
  const stopJson = (await stopResponse.json()) as { data?: any[] };

  const routeStops = Array.isArray(routeStopJson.data) ? routeStopJson.data : [];
  const stops = Array.isArray(stopJson.data) ? stopJson.data : [];
  const stopNameMap = new Map<string, string>(
    stops.map((item) => [item.stop, item.name_tc ?? item.name_en ?? item.stop]),
  );

  const updatedAt = new Date().toISOString();
  const rows = routeStops.map((item) => ({
    company: 'KMB' as const,
    route: item.route,
    direction: normalizeDirection(item.bound),
    service_type: String(item.service_type ?? '1'),
    stop_id: item.stop,
    stop_name: stopNameMap.get(item.stop) ?? item.stop,
    sequence: Number(item.seq ?? 0),
    updated_at: updatedAt,
  }));

  replaceKMBStopSnapshotsTx(rows);

  const variantKeys = new Set(rows.map((row) => `${row.route}::${row.direction}::${row.service_type}`));
  return { variants: variantKeys.size, rows: rows.length };
}
