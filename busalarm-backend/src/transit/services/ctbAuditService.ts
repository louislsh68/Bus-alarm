import { fetchRouteFamilies } from './catalogService.js';
import { db } from '../../db.js';

export async function auditCTBEmptyStopVariants(): Promise<Array<{
  route: string;
  direction: string;
  serviceType: string;
  origin: string;
  destination: string;
  variantKey: string;
}>> {
  const families = (await fetchRouteFamilies('CTB')).data;
  const snapshotKeys = new Set(
    (db.prepare(`
      SELECT DISTINCT route || '::' || direction || '::' || service_type AS snapshot_key
      FROM stop_snapshots
      WHERE company = 'CTB'
    `).all() as Array<{ snapshot_key: string }>).map((row) => row.snapshot_key),
  );

  return families.flatMap((family) =>
    family.variants
      .filter((variant: any) => variant.company === 'CTB')
      .map((variant: any) => ({
        route: family.route,
        direction: variant.direction,
        serviceType: variant.serviceType,
        origin: variant.origin,
        destination: variant.destination,
        variantKey: variant.variantKey,
      }))
      .filter((variant) => !snapshotKeys.has(`${variant.route}::${variant.direction}::${variant.serviceType}`)),
  );
}
