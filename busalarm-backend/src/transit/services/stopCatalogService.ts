import type { BusCompany, StopRecord, StopSnapshotRecord } from '../types.js';
import { loadStopSnapshot, saveStopSnapshot } from '../stores/stopStore.js';
import { fetchRawStops } from '../adapters/hkBusAdapters.js';
import { normalizeCompany, normalizeDirection, normalizeServiceType } from './params.js';

function toSnapshotRecord(params: {
  company: BusCompany;
  route: string;
  direction: 'outbound' | 'inbound';
  serviceType: string;
  stops: StopRecord[];
}): StopSnapshotRecord[] {
  return params.stops.map((stop, index) => ({
    company: params.company,
    route: params.route,
    direction: params.direction,
    serviceType: params.serviceType,
    stopId: stop.id,
    stopName: stop.name,
    sequence: stop.sequence ?? index + 1,
  }));
}

export async function fetchStops(params: {
  company: string;
  route: string;
  direction: string;
  serviceType?: string;
}): Promise<{ updatedAt: string | null; data: StopRecord[] }> {
  const company = normalizeCompany(params.company);
  const direction = normalizeDirection(params.direction);
  const serviceType = normalizeServiceType(params.serviceType);
  const route = params.route.trim();

  const cached = loadStopSnapshot({ company, route, direction, serviceType });
  if (cached.data.length > 0) {
    return {
      updatedAt: cached.updatedAt,
      data: cached.data.map((record) => ({
        id: record.stopId,
        name: record.stopName,
        sequence: record.sequence,
      })),
    };
  }

  const stops = await fetchRawStops({ company, route, direction, serviceType });
  saveStopSnapshot(toSnapshotRecord({ company, route, direction, serviceType, stops }));
  return {
    updatedAt: new Date().toISOString(),
    data: stops,
  };
}
