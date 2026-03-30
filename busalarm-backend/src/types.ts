export type BusCompany = 'KMB' | 'CTB';

export interface RouteRecord {
  company: BusCompany;
  route: string;
  direction?: string;
  serviceType: string;
  origin?: string;
  destination?: string;
}

export interface RouteVariantRecord {
  variantKey: string;
  company: BusCompany;
  direction: 'outbound' | 'inbound';
  serviceType: string;
  origin: string;
  destination: string;
  directionLabel: string;
  stopDirectionCode: 'O' | 'I';
  isCanonicalReversePair: boolean;
}

export interface RouteFamilyRecord {
  routeKey: string;
  route: string;
  companies: BusCompany[];
  familyType: 'bidirectional' | 'one_way' | 'circular' | 'unknown';
  primaryOrigin: string;
  primaryDestination: string;
  summary: string;
  variants: RouteVariantRecord[];
}

export interface ApiMeta {
  company?: string;
  route?: string;
  direction?: string;
  serviceType?: string;
  cachedAt?: string | null;
  sourceUpdatedAt?: string | null;
  builtAt?: string | null;
}

export interface StopRecord {
  id: string;
  name: string;
  sequence?: number;
}

export interface StopSnapshotRecord {
  company: BusCompany;
  route: string;
  direction: 'outbound' | 'inbound';
  serviceType: string;
  stopId: string;
  stopName: string;
  sequence: number;
}

export interface ETARecord {
  company: BusCompany;
  route: string;
  stopId: string;
  destination: string;
  etaIso: string;
  etaTimeText: string;
  minutes: number | null;
  remark?: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  createdAt: string;
}

export interface AlarmRecord {
  id: string;
  userId: string;
  route: string;
  company: BusCompany;
  stopId: string;
  stopName: string;
  direction: string;
  serviceType: string;
  repeatDays: number[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  pushToken: string;
  deviceName: string | null;
  appVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}
