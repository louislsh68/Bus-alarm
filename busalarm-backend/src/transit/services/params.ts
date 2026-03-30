import type { BusCompany } from '../types.js';

export function normalizeCompany(input: string): BusCompany {
  const value = input.trim().toUpperCase();
  if (value === 'KMB' || value === 'CTB') return value;
  throw new Error(`Unsupported company: ${input}`);
}

export function normalizeDirection(input?: string): 'outbound' | 'inbound' {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'o' || value === 'outbound') return 'outbound';
  if (value === 'i' || value === 'inbound') return 'inbound';
  throw new Error(`Unsupported direction: ${input ?? ''}`);
}

export function normalizeServiceType(input?: string): string {
  const value = (input ?? '1').trim();
  return value || '1';
}
