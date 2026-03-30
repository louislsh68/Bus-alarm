import type { RouteVariantRecord } from '../types.js';
import { db } from '../../db.js';
import { fetchRouteFamilies } from './catalogService.js';

const CTB_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';

const deleteCTBStopSnapshotsStmt = db.prepare(`
  DELETE FROM stop_snapshots
  WHERE company = 'CTB'
`);

const insertStopSnapshotStmt = db.prepare(`
  INSERT INTO stop_snapshots (company, route, direction, service_type, stop_id, stop_name, sequence, updated_at)
  VALUES (@company, @route, @direction, @service_type, @stop_id, @stop_name, @sequence, @updated_at)
`);

const replaceCTBStopSnapshotsTx = db.transaction((rows: Array<{
  company: 'CTB';
  route: string;
  direction: 'outbound' | 'inbound';
  service_type: string;
  stop_id: string;
  stop_name: string;
  sequence: number;
  updated_at: string;
}>) => {
  deleteCTBStopSnapshotsStmt.run();
  for (const row of rows) {
    insertStopSnapshotStmt.run(row);
  }
});

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CTB upstream failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current]);
    }
  }

  const workerCount = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function rebuildCTBStopSnapshots(): Promise<{ variants: number; rows: number; emptyVariants: number }> {
  const families = (await fetchRouteFamilies('CTB')).data;
  const variants: Array<RouteVariantRecord & { route: string }> = families.flatMap((family) =>
    family.variants
      .filter((variant) => variant.company === 'CTB')
      .map((variant) => ({ route: family.route, ...variant })),
  );

  const variantStops = new Map<string, Array<{ stopId: string; sequence: number }>>();

  await mapWithConcurrency(variants, 12, async (variant) => {
    const routeStopUrl = `${CTB_BASE}/route-stop/CTB/${encodeURIComponent(variant.route)}/${variant.direction}`;
    const routeStopJson = (await fetchJson(routeStopUrl)) as { data?: any[] };
    const routeStops = Array.isArray(routeStopJson.data) ? routeStopJson.data : [];
    const key = `${variant.route}::${variant.direction}::${variant.serviceType}`;
    const rows = routeStops.map((item, index) => ({
      stopId: String(item.stop),
      sequence: Number(item.seq ?? index + 1),
    }));
    variantStops.set(key, rows);
    return null;
  });

  const stopIds = Array.from(
    new Set(
      Array.from(variantStops.values()).flatMap((stops) => stops.map((stop) => stop.stopId)),
    ),
  );

  const stopDetails = await mapWithConcurrency(stopIds, 20, async (stopId) => {
    const stopUrl = `${CTB_BASE}/stop/${encodeURIComponent(stopId)}`;
    const stopJson = (await fetchJson(stopUrl)) as { data?: any };
    return {
      stopId,
      stopName: stopJson.data?.name_tc ?? stopJson.data?.name_en ?? stopId,
    };
  });

  const stopNameMap = new Map<string, string>(stopDetails.map((item) => [item.stopId, item.stopName]));

  const emptyVariants = Array.from(variantStops.values()).filter((stops) => stops.length === 0).length;

  const updatedAt = new Date().toISOString();
  const rows = variants.flatMap((variant) => {
    const key = `${variant.route}::${variant.direction}::${variant.serviceType}`;
    const stops = variantStops.get(key) ?? [];
    return stops.map((stop) => ({
      company: 'CTB' as const,
      route: variant.route,
      direction: variant.direction,
      service_type: variant.serviceType,
      stop_id: stop.stopId,
      stop_name: stopNameMap.get(stop.stopId) ?? stop.stopId,
      sequence: stop.sequence,
      updated_at: updatedAt,
    }));
  });

  replaceCTBStopSnapshotsTx(rows);
  return { variants: variants.length, rows: rows.length, emptyVariants };
}
