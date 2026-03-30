import { refreshRouteFamiliesCache } from '../transit/services/catalogService.js';
import { runStopSnapshotRefresh } from '../transit/services/stopRefreshService.js';
import { rebuildCTBStopSnapshots } from '../transit/services/ctbBulkStopService.js';
import { rebuildKMBStopSnapshots } from '../transit/services/kmbBulkStopService.js';

export async function refreshCanonicalTransitData(): Promise<{
  routeFamilies: { all: number; kmb: number; ctb: number };
  stopSnapshots: {
    kmb: { variants: number; rows: number };
    ctb: { variants: number; rows: number; emptyVariants: number };
  };
}> {
  const [allFamilies, kmbFamilies, ctbFamilies] = await Promise.all([
    refreshRouteFamiliesCache(),
    refreshRouteFamiliesCache('KMB'),
    refreshRouteFamiliesCache('CTB'),
  ]);

  const kmb = await runStopSnapshotRefresh({ company: 'KMB', runner: rebuildKMBStopSnapshots });
  const ctb = await runStopSnapshotRefresh({ company: 'CTB', runner: rebuildCTBStopSnapshots });

  return {
    routeFamilies: {
      all: allFamilies.length,
      kmb: kmbFamilies.length,
      ctb: ctbFamilies.length,
    },
    stopSnapshots: {
      kmb,
      ctb,
    },
  };
}
