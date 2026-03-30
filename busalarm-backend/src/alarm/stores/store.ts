import { randomUUID } from 'node:crypto';
import { db } from '../../db.js';
import type { AlarmRecord, UserRecord } from '../../types.js';

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, created_at)
  VALUES (@id, @created_at)
`);

const getUserStmt = db.prepare(`
  SELECT id, created_at
  FROM users
  WHERE id = ?
`);

const insertAlarmStmt = db.prepare(`
  INSERT INTO alarms (
    id, user_id, route, company, stop_id, stop_name, direction, service_type,
    repeat_days_json, start_time, end_time, enabled, created_at, updated_at
  ) VALUES (
    @id, @user_id, @route, @company, @stop_id, @stop_name, @direction, @service_type,
    @repeat_days_json, @start_time, @end_time, @enabled, @created_at, @updated_at
  )
`);

const listAlarmsStmt = db.prepare(`
  SELECT id, user_id, route, company, stop_id, stop_name, direction, service_type,
         repeat_days_json, start_time, end_time, enabled, created_at, updated_at
  FROM alarms
  WHERE user_id = ?
  ORDER BY created_at ASC
`);

function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
  };
}

function mapAlarm(row: any): AlarmRecord {
  return {
    id: row.id,
    userId: row.user_id,
    route: row.route,
    company: row.company,
    stopId: row.stop_id,
    stopName: row.stop_name,
    direction: row.direction,
    serviceType: row.service_type,
    repeatDays: JSON.parse(row.repeat_days_json),
    startTime: row.start_time,
    endTime: row.end_time,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createUser(): UserRecord {
  const user: UserRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  insertUserStmt.run({
    id: user.id,
    created_at: user.createdAt,
  });

  return user;
}

export function getUser(userId: string): UserRecord | undefined {
  const row = getUserStmt.get(userId);
  return row ? mapUser(row) : undefined;
}

export function createAlarm(input: Omit<AlarmRecord, 'id' | 'createdAt' | 'updatedAt'>): AlarmRecord {
  const now = new Date().toISOString();
  const alarm: AlarmRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  insertAlarmStmt.run({
    id: alarm.id,
    user_id: alarm.userId,
    route: alarm.route,
    company: alarm.company,
    stop_id: alarm.stopId,
    stop_name: alarm.stopName,
    direction: alarm.direction,
    service_type: alarm.serviceType,
    repeat_days_json: JSON.stringify(alarm.repeatDays),
    start_time: alarm.startTime,
    end_time: alarm.endTime,
    enabled: alarm.enabled ? 1 : 0,
    created_at: alarm.createdAt,
    updated_at: alarm.updatedAt,
  });

  return alarm;
}

export function listAlarmsForUser(userId: string): AlarmRecord[] {
  return listAlarmsStmt.all(userId).map(mapAlarm);
}
