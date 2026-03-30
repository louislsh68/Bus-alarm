import type { RouteFamilyRecord, RouteVariantRecord } from '../../types.js';

const CTB_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';

async function fetchRouteStopCount(route: string, direction: 'outbound' | 'inbound'): Promise<number> {
  const response = await fetch(`${CTB_BASE}/route-stop/CTB/${encodeURIComponent(route)}/${direction}`);
  if (!response.ok) return 0;
  const json = (await response.json()) as { data?: any[] };
  return Array.isArray(json.data) ? json.data.length : 0;
}

function reverseVariant(route: string, variant: RouteVariantRecord): RouteVariantRecord {
  const reversedDirection: 'outbound' | 'inbound' = variant.direction === 'outbound' ? 'inbound' : 'outbound';
  return {
    variantKey: `${variant.company}::${route}::${reversedDirection}::${variant.serviceType}`,
    company: variant.company,
    direction: reversedDirection,
    serviceType: variant.serviceType,
    origin: variant.destination,
    destination: variant.origin,
    directionLabel: variant.destination && variant.origin ? `${variant.destination} → ${variant.origin}` : variant.destination || variant.origin,
    stopDirectionCode: reversedDirection === 'outbound' ? 'O' : 'I',
    isCanonicalReversePair: true,
  };
}

export async function enrichCTBDirections(families: RouteFamilyRecord[]): Promise<RouteFamilyRecord[]> {
  const output: RouteFamilyRecord[] = [];

  for (const family of families) {
    if (!family.companies.includes('CTB') || family.companies.length !== 1 || family.variants.length !== 1) {
      output.push(family);
      continue;
    }

    const variant = family.variants[0];
    if (variant.company !== 'CTB') {
      output.push(family);
      continue;
    }

    const outboundCount = await fetchRouteStopCount(family.route, 'outbound');
    const inboundCount = await fetchRouteStopCount(family.route, 'inbound');

    if (outboundCount > 0 && inboundCount > 0) {
      const outboundVariant = variant.direction === 'outbound' ? variant : reverseVariant(family.route, variant);
      const inboundVariant = variant.direction === 'inbound' ? variant : reverseVariant(family.route, variant);
      output.push({
        ...family,
        familyType: 'bidirectional',
        primaryOrigin: outboundVariant.origin,
        primaryDestination: outboundVariant.destination,
        summary: outboundVariant.origin && outboundVariant.destination ? `${outboundVariant.origin} ↔ ${outboundVariant.destination}` : family.summary,
        variants: [
          { ...outboundVariant, isCanonicalReversePair: true },
          { ...inboundVariant, isCanonicalReversePair: true },
        ],
      });
      continue;
    }

    output.push(family);
  }

  return output;
}
