import { randomUUID } from 'node:crypto';
import { db } from '../../db.js';
import type { DeviceRecord } from '../../types.js';

const upsertDeviceStmt = db.prepare(`
  INSERT INTO devices (id, user_id, platform, push_token, device_name, app_version, last_seen_at, created_at, updated_at)
  VALUES (@id, @user_id, @platform, @push_token, @device_name, @app_version, @last_seen_at, @created_at, @updated_at)
  ON CONFLICT(user_id, push_token) DO UPDATE SET
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at
`);

const listDevicesForUserStmt = db.prepare(`
  SELECT id, user_id, platform, push_token, device_name, app_version, last_seen_at, created_at, updated_at
  FROM devices
  WHERE user_id = ?
  ORDER BY updated_at DESC
`);

function mapDevice(row: any): DeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    pushToken: row.push_token,
    deviceName: row.device_name,
    appVersion: row.app_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerDevice(input: {
  userId: string;
  platform: 'ios' | 'android' | 'web';
  pushToken: string;
  deviceName?: string | null;
  appVersion?: string | null;
}): DeviceRecord {
  const now = new Date().toISOString();
  const device: DeviceRecord = {
    id: randomUUID(),
    userId: input.userId,
    platform: input.platform,
    pushToken: input.pushToken,
    deviceName: input.deviceName ?? null,
    appVersion: input.appVersion ?? null,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };

  upsertDeviceStmt.run({
    id: device.id,
    user_id: device.userId,
    platform: device.platform,
    push_token: device.pushToken,
    device_name: device.deviceName,
    app_version: device.appVersion,
    last_seen_at: device.lastSeenAt,
    created_at: device.createdAt,
    updated_at: device.updatedAt,
  });

  const latest = listDevicesForUser(device.userId).find((item) => item.pushToken === device.pushToken);
  return latest ?? device;
}

export function listDevicesForUser(userId: string): DeviceRecord[] {
  return listDevicesForUserStmt.all(userId).map(mapDevice);
}
