import { listRefreshStates } from '../stores/catalogStore.js';
import { refreshRouteFamiliesCache } from './catalogService.js';
import { REFRESH_FULL_MS, REFRESH_RETRY_MS } from './refreshConfig.js';
let started = false;

async function refreshAllScopes(): Promise<void> {
  await refreshRouteFamiliesCache();
  await refreshRouteFamiliesCache('KMB');
  await refreshRouteFamiliesCache('CTB');
}

async function runStartupRefreshIfNeeded(): Promise<void> {
  const states = listRefreshStates();
  if (states.length === 0) {
    await refreshAllScopes();
    return;
  }

  const shouldRetry = states.some((state) => {
    if (state.status !== 'failed' || !state.nextRetryAt) return false;
    return Date.now() >= new Date(state.nextRetryAt).getTime();
  });

  if (shouldRetry) {
    await refreshAllScopes();
  }
}

function scheduleRetryLoop(): void {
  setInterval(async () => {
    const states = listRefreshStates();
    const shouldRetry = states.some((state) => {
      if (state.status !== 'failed' || !state.nextRetryAt) return false;
      return Date.now() >= new Date(state.nextRetryAt).getTime();
    });

    if (!shouldRetry) return;

    try {
      await refreshAllScopes();
      console.log('✅ Catalog retry refresh succeeded');
    } catch (error) {
      console.error('❌ Catalog retry refresh failed:', error);
    }
  }, REFRESH_RETRY_MS);
}

function scheduleDailyRefreshLoop(): void {
  setInterval(async () => {
    try {
      await refreshAllScopes();
      console.log('✅ Daily catalog refresh succeeded');
    } catch (error) {
      console.error('❌ Daily catalog refresh failed:', error);
    }
  }, REFRESH_FULL_MS);
}

export async function startCatalogRefreshLoop(): Promise<void> {
  if (started) return;
  started = true;

  try {
    await runStartupRefreshIfNeeded();
    console.log('🗂️ Catalog refresh bootstrap complete');
  } catch (error) {
    console.error('❌ Catalog refresh bootstrap failed:', error);
  }

  scheduleRetryLoop();
  scheduleDailyRefreshLoop();
}
