# BusAlarm Backend Architecture

This backend currently has **two practical domains** inside one service:

1. **Transit data domain**
   - routes
   - route families
   - stops
   - ETA
   - cache / refresh / rebuild / audit

2. **Alarm app domain**
   - users
   - alarms
   - devices

The codebase is still a single backend process, but the files are organized to make these domains easier to follow.

---

## High-level flow

### Public API
- `src/routes/public.ts`
- Used by app / browser / frontend UAT

### Internal API
- `src/routes/internal.ts`
- Used for cache inspection, rebuilds, audits, and maintenance

### App bootstrap
- `src/index.ts` → starts server + refresh loops
- `src/app.ts` → builds express app and mounts routers

---

## Domain folders

### `src/transit/`
Transit data and cache logic.

- `adapters/`
  - raw upstream fetchers for KMB / CTB
- `stores/`
  - persistence for route families and stop snapshots
- `services/`
  - route family building
  - stop lookup
  - ETA lookup
  - refresh loops
  - rebuilds
  - maintenance
  - audits
- `types.ts`
  - transit-specific types

### `src/alarm/`
App/user/alarm/device persistence and future scheduler logic.

- `stores/`
  - users / alarms / devices
- `types.ts`
  - app-domain types

---

## Current main data paths

### Route families
1. route handler calls transit service
2. service checks SQLite cache
3. if cache missing, fetches upstream raw routes
4. builds canonical route families
5. saves snapshot locally
6. returns cached/built data with metadata

### Stops
1. route handler calls transit stop service
2. stop snapshot is checked first
3. if cache miss, upstream stop list is fetched
4. snapshot is persisted to SQLite
5. result returned to client

### ETA
1. route handler calls ETA service
2. ETA is fetched live from upstream
3. normalized response returned

### Users / alarms / devices
1. public API writes to alarm-domain stores
2. SQLite persists app data
3. this will later feed scheduler / notification logic

---

## SQLite tables

### App-domain tables
- `users`
- `alarms`
- `devices`

### Transit-domain tables
- `route_families_cache`
- `stop_snapshots`
- `refresh_state`

---

## Design rule

### Transit domain should NOT know about:
- users
- alarms
- devices
- notifications

### Alarm domain MAY depend on transit domain for:
- stop data
- ETA data
- route metadata

That dependency direction keeps the system understandable.

---

## What is still missing

The main missing piece is the **scheduler / alarm execution layer**:
- scan enabled alarms
- check repeat days / active time window
- fetch ETA
- decide trigger
- later deliver to registered devices

That should be built on top of the current structure, not mixed into the transit services.
