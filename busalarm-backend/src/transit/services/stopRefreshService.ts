import { getRefreshState, saveRefreshState } from '../stores/catalogStore.js';

function refreshStateKey(company?: string): string {
  return `stop_snapshots:${company?.toUpperCase() || 'ALL'}`;
}

export function getStopSnapshotRefreshState(company?: string) {
  return getRefreshState(refreshStateKey(company));
}

export async function runStopSnapshotRefresh<T extends { variants: number; rows: number }>(params: {
  company?: string;
  runner: () => Promise<T>;
}): Promise<T> {
  const now = new Date().toISOString();
  const key = refreshStateKey(params.company);

  try {
    const result = await params.runner();
    saveRefreshState({
      catalogName: key,
      status: 'success',
      lastSuccessAt: now,
      lastFailureAt: null,
      nextRetryAt: null,
      errorMessage: null,
      updatedAt: now,
    });
    return result;
  } catch (error) {
    const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    saveRefreshState({
      catalogName: key,
      status: 'failed',
      lastSuccessAt: getRefreshState(key)?.lastSuccessAt ?? null,
      lastFailureAt: now,
      nextRetryAt: retryAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: now,
    });
    throw error;
  }
}
