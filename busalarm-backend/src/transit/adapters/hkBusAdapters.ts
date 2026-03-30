import type { BusCompany, RouteRecord, StopRecord } from '../types.js';
import { normalizeCompany, normalizeDirection, normalizeServiceType } from '../services/params.js';

const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CTB_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';

export async function fetchRawRoutes(company?: string): Promise<RouteRecord[]> {
  const normalized = company?.toUpperCase();
  const out: RouteRecord[] = [];

  if (!normalized || normalized === 'KMB') {
    const response = await fetch(`${KMB_BASE}/route/`);
    const json = (await response.json()) as { data: any[] };
    out.push(
      ...json.data.map((item) => ({
        company: 'KMB' as BusCompany,
        route: item.route,
        direction: item.bound,
        serviceType: item.service_type ?? '1',
        origin: item.orig_tc ?? item.orig_en,
        destination: item.dest_tc ?? item.dest_en,
      })),
    );
  }

  if (!normalized || normalized === 'CTB') {
    const response = await fetch(`${CTB_BASE}/route/CTB`);
    const json = (await response.json()) as { data: any[] };
    out.push(
      ...json.data.map((item) => ({
        company: 'CTB' as BusCompany,
        route: item.route,
        direction: 'O',
        serviceType: '1',
        origin: item.orig_tc ?? item.orig_en ?? '',
        destination: item.dest_tc ?? item.dest_en ?? '',
      })),
    );
  }

  return out;
}

export async function fetchRawStops(params: {
  company: string;
  route: string;
  direction: string;
  serviceType?: string;
}): Promise<StopRecord[]> {
  const company = normalizeCompany(params.company);
  const direction = normalizeDirection(params.direction);
  const serviceType = normalizeServiceType(params.serviceType);
  const route = params.route.trim();

  if (company === 'KMB') {
    const routeStopUrl = `${KMB_BASE}/route-stop/${route}/${direction}/${serviceType}`;
    const routeStopResponse = await fetch(routeStopUrl);
    const routeStopJson = (await routeStopResponse.json()) as { data?: any[] };
    const routeStops = Array.isArray(routeStopJson.data) ? routeStopJson.data : [];

    return Promise.all(
      routeStops.map(async (item, index) => {
        const detail = await fetch(`${KMB_BASE}/stop/${item.stop}`);
        const detailJson = (await detail.json()) as { data?: any };
        return {
          id: item.stop,
          name: detailJson.data?.name_tc ?? detailJson.data?.name_en ?? item.stop,
          sequence: Number(item.seq ?? index + 1),
        } satisfies StopRecord;
      }),
    );
  }

  const routeStopUrl = `${CTB_BASE}/route-stop/CTB/${route}/${direction}`;
  const routeStopResponse = await fetch(routeStopUrl);
  const routeStopJson = (await routeStopResponse.json()) as { data?: any[] };
  const routeStops = Array.isArray(routeStopJson.data) ? routeStopJson.data : [];

  return Promise.all(
    routeStops.map(async (item, index) => {
      const detail = await fetch(`${CTB_BASE}/stop/${item.stop}`);
      const detailJson = (await detail.json()) as { data?: any };
      return {
        id: item.stop,
        name: detailJson.data?.name_tc ?? detailJson.data?.name_en ?? item.stop,
        sequence: Number(item.seq ?? index + 1),
      } satisfies StopRecord;
    }),
  );
}

export async function fetchRawETA(params: {
  company: string;
  route: string;
  stopId: string;
  serviceType?: string;
}): Promise<any[]> {
  const company = params.company.toUpperCase();
  const serviceType = params.serviceType ?? '1';

  if (company === 'KMB') {
    const response = await fetch(`${KMB_BASE}/eta/${params.stopId}/${params.route}/${serviceType}`);
    const json = (await response.json()) as { data: any[] };
    return json.data;
  }

  if (company === 'CTB') {
    const response = await fetch(`${CTB_BASE}/eta/ctb/${params.stopId}/${params.route}`);
    const json = (await response.json()) as { data: any[] };
    return json.data;
  }

  throw new Error(`Unsupported company: ${params.company}`);
}
