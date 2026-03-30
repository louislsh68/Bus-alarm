import { getStopSnapshotRefreshState, runStopSnapshotRefresh } from './stopRefreshService.js';
import { rebuildCTBStopSnapshots } from './ctbBulkStopService.js';
import { rebuildKMBStopSnapshots } from './kmbBulkStopService.js';
import { REFRESH_FULL_MS, REFRESH_RETRY_MS } from './refreshConfig.js';
let started = false;

async function refreshAllStopScopes(): Promise<void> {
  await runStopSnapshotRefresh({ company: 'KMB', runner: rebuildKMBStopSnapshots });
  await runStopSnapshotRefresh({ company: 'CTB', runner: rebuildCTBStopSnapshots });
}

async function runStartupRefreshIfNeeded(): Promise<void> {
  const kmb = getStopSnapshotRefreshState('KMB');
  const ctb = getStopSnapshotRefreshState('CTB');

  if (!kmb || !ctb) {
    await refreshAllStopScopes();
    return;
  }

  const shouldRetry = [kmb, ctb].some((state) => {
    if (state.status !== 'failed' || !state.nextRetryAt) return false;
    return Date.now() >= new Date(state.nextRetryAt).getTime();
  });

  if (shouldRetry) {
    await refreshAllStopScopes();
  }
}

function scheduleRetryLoop(): void {
  setInterval(async () => {
    const states = [getStopSnapshotRefreshState('KMB'), getStopSnapshotRefreshState('CTB')].filter(Boolean);
    const shouldRetry = states.some((state) => {
      if (!state || state.status !== 'failed' || !state.nextRetryAt) return false;
      return Date.now() >= new Date(state.nextRetryAt).getTime();
    });

    if (!shouldRetry) return;

    try {
      await refreshAllStopScopes();
      console.log('✅ Stop snapshot retry refresh succeeded');
    } catch (error) {
      console.error('❌ Stop snapshot retry refresh failed:', error);
    }
  }, REFRESH_RETRY_MS);
}

function scheduleDailyRefreshLoop(): void {
  setInterval(async () => {
    try {
      await refreshAllStopScopes();
      console.log('✅ Daily stop snapshot refresh succeeded');
    } catch (error) {
      console.error('❌ Daily stop snapshot refresh failed:', error);
    }
  }, REFRESH_FULL_MS);
}

export async function startStopRefreshLoop(): Promise<void> {
  if (started) return;
  started = true;

  try {
    await runStartupRefreshIfNeeded();
    console.log('🛑 Stop snapshot refresh bootstrap complete');
  } catch (error) {
    console.error('❌ Stop snapshot refresh bootstrap failed:', error);
  }

  scheduleRetryLoop();
  scheduleDailyRefreshLoop();
}
