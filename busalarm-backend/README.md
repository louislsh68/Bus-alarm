# BusAlarm Backend

TypeScript + Express backend for BusAlarm.

It currently serves two domains inside one backend:

1. **Transit data**
   - routes
   - route families
   - stops
   - ETA
   - cache / refresh / rebuild / audit

2. **Alarm app data**
   - users
   - alarms
   - devices

The backend is still a **single service** with a local SQLite database.

---

## Current structure

```text
src/
  app.ts
  index.ts
  db.ts
  types.ts
  routes/
    public.ts
    internal.ts
  transit/
    adapters/
    services/
    stores/
  alarm/
    stores/
```

See also:
- `ARCHITECTURE.md`

---

## Quick start

```bash
cd busalarm-backend
npm install
npm run dev
```

Optional environment variables:
- `PORT`
- `HOST`
- `ADMIN_REFRESH_KEY`
- `REFRESH_RETRY_MS`
- `REFRESH_FULL_MS`

---

## Public API

### Health
- `GET /health`

### Routes
- `GET /api/routes`
- `GET /api/routes?company=KMB`
- `GET /api/routes?company=CTB`

Response includes:
- `ok`
- `count`
- `meta.builtAt`
- `data`

### Route families
- `GET /api/route-families`
- `GET /api/route-families?company=KMB`
- `GET /api/route-families?company=CTB`

Route families are:
- persisted in SQLite
- scoped by company + route
- keyed like `KMB::1`, `CTB::1`

Response metadata includes:
- `meta.company`
- `meta.cachedAt`
- `meta.builtAt`
- `meta.isStale`

Each route family contains:
- `routeKey`
- `route`
- `companies`
- `familyType`
- `primaryOrigin`
- `primaryDestination`
- `summary`
- `variants[]`

Each variant contains:
- `variantKey`
- `company`
- `direction` (`outbound` / `inbound`)
- `serviceType`
- `origin`
- `destination`
- `directionLabel`
- `stopDirectionCode` (`O` / `I`)
- `isCanonicalReversePair`

### Stops
Examples:
- `GET /api/stops?company=KMB&route=2E&direction=outbound&serviceType=1`
- `GET /api/stops?company=CTB&route=1&direction=outbound&serviceType=1`

Stops are:
- read from local SQLite snapshot first
- fetched upstream on cache miss
- then persisted locally

Response metadata includes:
- `meta.company`
- `meta.route`
- `meta.direction`
- `meta.serviceType`
- `meta.cachedAt`
- `meta.isStale`

### ETA
Examples:
- `GET /api/eta?company=KMB&route=2E&stopId=...&direction=outbound&serviceType=1`
- `GET /api/eta?company=CTB&route=1&stopId=...&direction=outbound&serviceType=1`

ETA is fetched live from upstream and normalized into rows containing:
- `company`
- `route`
- `stopId`
- `destination`
- `etaIso`
- `etaTimeText`
- `minutes`
- `remark`
- `updatedAt`

### Users
- `POST /api/users`
- `GET /api/users/:userId`

### Alarms
- `POST /api/users/:userId/alarms`
- `GET /api/users/:userId/alarms`

### Devices
- `POST /api/users/:userId/devices`
- `GET /api/users/:userId/devices`

Device registration currently stores:
- `platform` (`ios` / `android` / `web`)
- `pushToken`
- `deviceName`
- `appVersion`
- timestamps / lastSeenAt

---

## Internal / admin API

### Status / audit
- `GET /internal/refresh/status`
- `GET /internal/stops/status`
- `GET /internal/stops/scope?company=KMB&route=2E&direction=outbound&serviceType=1`
- `GET /internal/audit/ctb-empty-stop-variants`
- `GET /internal/maintenance/cache-stats`

### Refresh / rebuild
All POST endpoints below require:
- header: `x-admin-refresh-key: <ADMIN_REFRESH_KEY>`

Endpoints:
- `POST /internal/refresh/catalog`
- `POST /internal/rebuild/catalog`
- `POST /internal/rebuild/stops/kmb`
- `POST /internal/rebuild/stops/ctb`
- `POST /internal/maintenance/reset-canonical-caches`
- `POST /internal/maintenance/refresh-canonical`

---

## SQLite tables

### Alarm/app tables
- `users`
- `alarms`
- `devices`

### Transit/cache tables
- `route_families_cache`
- `stop_snapshots`
- `refresh_state`

Database file:
- `data/busalarm.db`

---

## Current behavior notes

- route family cache is persisted in SQLite
- stop snapshot cache is persisted in SQLite
- KMB stop snapshots support bulk rebuild
- CTB stop snapshots support bulk rebuild
- CTB audit endpoint reports upstream route variants that exist in catalog but have empty `route-stop` data
- automatic catalog refresh loop starts with the server
- automatic stop snapshot refresh loop starts with the server
- refresh intervals are configurable via `REFRESH_RETRY_MS` and `REFRESH_FULL_MS`
- canonical transit cache can be reset and rebuilt without deleting users / alarms / devices
- public route-family and stop APIs now expose freshness metadata (`cachedAt`, `isStale`)

---

## What is still missing

The biggest missing application feature is still:
- **alarm scheduler / execution layer**

Meaning the backend can already:
- store alarms
- store devices
- serve transit data

But it does **not yet**:
- scan enabled alarms on a schedule
- fetch ETA for each active alarm
- decide whether a notification should fire
- deliver notifications to registered devices

That is the next major backend milestone.
