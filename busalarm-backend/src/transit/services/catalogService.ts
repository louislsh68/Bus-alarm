import type { BusCompany, RouteFamilyRecord, RouteRecord, RouteVariantRecord } from '../types.js';
import { clearRouteFamilies, getRefreshState, loadRouteFamilies, saveRefreshState, saveRouteFamilies } from '../stores/catalogStore.js';
import { fetchRawRoutes } from '../adapters/hkBusAdapters.js';
import { normalizeDirection } from './params.js';

function toStopDirectionCode(direction: 'outbound' | 'inbound'): 'O' | 'I' {
  return direction === 'outbound' ? 'O' : 'I';
}

function buildVariantKey(company: BusCompany, route: string, direction: 'outbound' | 'inbound', serviceType: string): string {
  return `${company}::${route}::${direction}::${serviceType}`;
}

function buildSummary(variants: Array<{ origin: string; destination: string }>): string {
  const descriptions = variants
    .map((variant) => {
      const origin = variant.origin.trim();
      const destination = variant.destination.trim();
      if (origin && destination) return `${origin} ↔ ${destination}`;
      return origin || destination;
    })
    .filter(Boolean);

  return Array.from(new Set(descriptions)).slice(0, 2).join(' / ');
}

function buildFamilySummary(
  familyType: RouteFamilyRecord['familyType'],
  primaryOrigin: string,
  primaryDestination: string,
  variants: RouteVariantRecord[],
): string {
  if (familyType === 'circular') {
    return primaryOrigin && primaryDestination
      ? `${primaryOrigin} ↺ ${primaryDestination}`
      : buildSummary(variants);
  }

  if (familyType === 'bidirectional' && primaryOrigin && primaryDestination) {
    return `${primaryOrigin} ↔ ${primaryDestination}`;
  }

  if (familyType === 'one_way' && primaryOrigin && primaryDestination) {
    return `${primaryOrigin} → ${primaryDestination}`;
  }

  return buildSummary(variants);
}

function finalizeFamily(family: RouteFamilyRecord): RouteFamilyRecord {
  const uniqueDirections = Array.from(new Set(family.variants.map((variant) => variant.direction)));
  const first = family.variants[0];

  const maybeCircular = family.variants.some((variant) =>
    variant.origin && variant.destination && variant.origin === variant.destination,
  ) || (family.variants.length === 1 && first.origin && first.destination && first.origin === first.destination);

  let familyType: RouteFamilyRecord['familyType'] = 'unknown';
  if (maybeCircular) {
    familyType = 'circular';
  } else if (uniqueDirections.length >= 2) {
    familyType = 'bidirectional';
  } else if (family.variants.length === 1) {
    familyType = 'one_way';
  }

  const variants = family.variants.map((variant) => ({
    ...variant,
    isCanonicalReversePair: familyType === 'bidirectional',
  }));

  const outbound = variants.find((variant) => variant.direction === 'outbound') ?? first;
  const primaryOrigin = outbound?.origin ?? '';
  const primaryDestination = outbound?.destination ?? '';

  return {
    ...family,
    familyType,
    primaryOrigin,
    primaryDestination,
    summary: buildFamilySummary(familyType, primaryOrigin, primaryDestination, variants),
    variants,
  };
}

export async function fetchRoutes(company?: string): Promise<RouteRecord[]> {
  return fetchRawRoutes(company);
}

function buildRouteFamiliesFromRoutes(routes: RouteRecord[]): RouteFamilyRecord[] {
  const families = new Map<string, RouteFamilyRecord>();

  for (const route of routes) {
    const key = `${route.company}::${route.route.trim().toUpperCase()}`;
    const direction = normalizeDirection(route.direction);
    const origin = route.origin?.trim() || '';
    const destination = route.destination?.trim() || '';

    const variant: RouteVariantRecord = {
      variantKey: buildVariantKey(route.company, route.route, direction, route.serviceType),
      company: route.company,
      direction,
      serviceType: route.serviceType,
      origin,
      destination,
      directionLabel: origin && destination ? `${origin} → ${destination}` : origin || destination,
      stopDirectionCode: toStopDirectionCode(direction),
      isCanonicalReversePair: false,
    };

    const existing = families.get(key);
    if (!existing) {
      families.set(key, {
        routeKey: key,
        route: route.route,
        companies: [route.company],
        familyType: 'unknown',
        primaryOrigin: variant.origin,
        primaryDestination: variant.destination,
        summary: buildSummary([variant]),
        variants: [variant],
      });
      continue;
    }

    if (!existing.companies.includes(route.company)) {
      existing.companies.push(route.company);
      existing.companies.sort();
    }

    const duplicated = existing.variants.some((item) => item.variantKey === variant.variantKey);
    if (!duplicated) {
      existing.variants.push(variant);
      existing.summary = buildSummary(existing.variants);
    }
  }

  return Array.from(families.values())
    .map((family) => finalizeFamily(family))
    .sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }));
}

function companyScopeKey(company?: string): string {
  return company?.toUpperCase() || 'ALL';
}

export async function refreshRouteFamiliesCache(company?: string): Promise<RouteFamilyRecord[]> {
  const scope = companyScopeKey(company);
  const now = new Date().toISOString();

  try {
    console.log(`[catalog refresh] start scope=${scope}`);
    const routes = await fetchRawRoutes(company);
    console.log(`[catalog refresh] fetched routes scope=${scope} count=${routes.length}`);
    const families = buildRouteFamiliesFromRoutes(routes);
    console.log(`[catalog refresh] built families scope=${scope} count=${families.length}`);
    saveRouteFamilies(scope, families);
    saveRefreshState({
      catalogName: `route_families:${scope}`,
      status: 'success',
      lastSuccessAt: now,
      lastFailureAt: null,
      nextRetryAt: null,
      errorMessage: null,
      updatedAt: now,
    });
    console.log(`[catalog refresh] saved scope=${scope}`);
    return families;
  } catch (error) {
    console.error(`[catalog refresh] failed scope=${scope}`, error);
    const retryAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    saveRefreshState({
      catalogName: `route_families:${scope}`,
      status: 'failed',
      lastSuccessAt: getRefreshState(`route_families:${scope}`)?.lastSuccessAt ?? null,
      lastFailureAt: now,
      nextRetryAt: retryAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: now,
    });
    throw error;
  }
}

export async function fetchRouteFamilies(company?: string): Promise<{ updatedAt: string; data: RouteFamilyRecord[] }> {
  const scope = companyScopeKey(company);
  const cached = loadRouteFamilies(scope);
  if (cached) {
    return cached;
  }

  const data = await refreshRouteFamiliesCache(company);
  return {
    updatedAt: new Date().toISOString(),
    data,
  };
}

export async function rebuildRouteFamiliesSnapshot(company?: string): Promise<RouteFamilyRecord[]> {
  const scope = companyScopeKey(company);
  console.log(`[catalog rebuild] clearing route families scope=${scope}`);
  clearRouteFamilies(scope);
  return refreshRouteFamiliesCache(company);
}
