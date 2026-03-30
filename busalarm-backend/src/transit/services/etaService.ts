import type { BusCompany, ETARecord } from '../types.js';
import { fetchRawETA } from '../adapters/hkBusAdapters.js';

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Hong_Kong',
  }).format(date);
}

function calculateMinutes(iso: string): number | null {
  const eta = new Date(iso);
  if (Number.isNaN(eta.getTime())) return null;
  const minutes = Math.ceil((eta.getTime() - Date.now()) / 60000);
  return Math.max(0, minutes);
}

export async function fetchETA(params: {
  company: string;
  route: string;
  stopId: string;
  direction?: string;
  serviceType?: string;
}): Promise<ETARecord[]> {
  const company = params.company.toUpperCase() as BusCompany;
  const updatedAt = new Date().toISOString();
  const data = await fetchRawETA(params);

  return data
    .filter((item) => item.eta)
    .slice(0, 3)
    .map((item) => ({
      company,
      route: params.route,
      stopId: params.stopId,
      destination: item.dest_tc ?? item.dest_en ?? params.route,
      etaIso: item.eta,
      etaTimeText: formatClock(item.eta),
      minutes: calculateMinutes(item.eta),
      remark: item.rmk_tc ?? item.rmk_en ?? '',
      updatedAt,
    }));
}
