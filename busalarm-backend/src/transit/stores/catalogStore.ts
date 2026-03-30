import { db } from '../../db.js';
import type { RouteFamilyRecord } from '../../types.js';

const upsertRouteFamiliesStmt = db.prepare(`
  INSERT INTO route_families_cache (company_scope, payload_json, updated_at)
  VALUES (@company_scope, @payload_json, @updated_at)
  ON CONFLICT(company_scope) DO UPDATE SET
    payload_json = excluded.payload_json,
    updated_at = excluded.updated_at
`);

const getRouteFamiliesStmt = db.prepare(`
  SELECT company_scope, payload_json, updated_at
  FROM route_families_cache
  WHERE company_scope = ?
`);

const upsertRefreshStateStmt = db.prepare(`
  INSERT INTO refresh_state (catalog_name, status, last_success_at, last_failure_at, next_retry_at, error_message, updated_at)
  VALUES (@catalog_name, @status, @last_success_at, @last_failure_at, @next_retry_at, @error_message, @updated_at)
  ON CONFLICT(catalog_name) DO UPDATE SET
    status = excluded.status,
    last_success_at = excluded.last_success_at,
    last_failure_at = excluded.last_failure_at,
    next_retry_at = excluded.next_retry_at,
    error_message = excluded.error_message,
    updated_at = excluded.updated_at
`);

const getRefreshStateStmt = db.prepare(`
  SELECT catalog_name, status, last_success_at, last_failure_at, next_retry_at, error_message, updated_at
  FROM refresh_state
  WHERE catalog_name = ?
`);

const listRefreshStatesStmt = db.prepare(`
  SELECT catalog_name, status, last_success_at, last_failure_at, next_retry_at, error_message, updated_at
  FROM refresh_state
  ORDER BY catalog_name ASC
`);

const deleteRouteFamiliesStmt = db.prepare(`
  DELETE FROM route_families_cache
  WHERE company_scope = ?
`);

export type RefreshStateRecord = {
  catalogName: string;
  status: 'idle' | 'success' | 'failed';
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  nextRetryAt: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

function mapRefreshState(row: any): RefreshStateRecord {
  return {
    catalogName: row.catalog_name,
    status: row.status,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    nextRetryAt: row.next_retry_at,
    errorMessage: row.error_message,
    updatedAt: row.updated_at,
  };
}

export function saveRouteFamilies(companyScope: string, families: RouteFamilyRecord[]): void {
  upsertRouteFamiliesStmt.run({
    company_scope: companyScope,
    payload_json: JSON.stringify(families),
    updated_at: new Date().toISOString(),
  });
}

export function loadRouteFamilies(companyScope: string): { updatedAt: string; data: RouteFamilyRecord[] } | null {
  const row = getRouteFamiliesStmt.get(companyScope) as { updated_at: string; payload_json: string } | undefined;
  if (!row) return null;

  return {
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload_json),
  };
}

export function saveRefreshState(state: RefreshStateRecord): void {
  upsertRefreshStateStmt.run({
    catalog_name: state.catalogName,
    status: state.status,
    last_success_at: state.lastSuccessAt,
    last_failure_at: state.lastFailureAt,
    next_retry_at: state.nextRetryAt,
    error_message: state.errorMessage,
    updated_at: state.updatedAt,
  });
}

export function getRefreshState(catalogName: string): RefreshStateRecord | null {
  const row = getRefreshStateStmt.get(catalogName);
  return row ? mapRefreshState(row) : null;
}

export function listRefreshStates(): RefreshStateRecord[] {
  return listRefreshStatesStmt.all().map(mapRefreshState);
}

export function clearRouteFamilies(companyScope: string): void {
  deleteRouteFamiliesStmt.run(companyScope);
}
