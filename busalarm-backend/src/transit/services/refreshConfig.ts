function readMs(envName: string, fallbackMs: number): number {
  const raw = process.env[envName];
  if (!raw) return fallbackMs;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallbackMs;
}

export const REFRESH_RETRY_MS = readMs('REFRESH_RETRY_MS', 60 * 60 * 1000);
export const REFRESH_FULL_MS = readMs('REFRESH_FULL_MS', 24 * 60 * 60 * 1000);
