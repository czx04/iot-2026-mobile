import type { PairingQrV1, PairedDeviceV1 } from './pairingTypes';

const isNonEmpty = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0;

const clampPort = (n: unknown): number => {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return 8883;
  const p = Math.round(x);
  if (p < 1 || p > 65535) return 8883;
  return p;
};

const readMqttPassField = (o: Record<string, unknown>): string | undefined => {
  const v = o.mqttPass ?? o.mqttPassword;
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.slice(0, 256);
};

export function parsePairingQrData(raw: string): PairingQrV1 | null {
  const t = raw.trim();
  if (!t) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(t);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (!isNonEmpty(o.deviceId)) return null;
  if (!isNonEmpty(o.mqttHost)) return null;
  const deviceId = String(o.deviceId).trim();
  const mqttHost = String(o.mqttHost).trim();
  if (deviceId.length > 80 || mqttHost.length > 253) return null;
  const mqttPort = o.mqttPort === undefined ? undefined : clampPort(o.mqttPort);
  const mqttUser =
    o.mqttUser === undefined || o.mqttUser === null
      ? undefined
      : String(o.mqttUser).trim().slice(0, 128);
  const label =
    o.label === undefined || o.label === null
      ? undefined
      : String(o.label).trim().slice(0, 80);
  const mqttPass = readMqttPassField(o);
  return {
    v: 1,
    deviceId,
    mqttHost,
    mqttPort,
    mqttUser: mqttUser === '' ? undefined : mqttUser,
    label: label === '' ? undefined : label,
    mqttPass,
  };
}

export function toPairedDevice(
  qr: PairingQrV1,
  mqttUser: string,
  pairedAt: number,
): PairedDeviceV1 {
  return {
    v: 1,
    deviceId: qr.deviceId,
    mqttHost: qr.mqttHost,
    mqttPort: qr.mqttPort === undefined ? 8883 : clampPort(qr.mqttPort),
    mqttUser: mqttUser.trim().slice(0, 128),
    label: qr.label,
    pairedAt,
  };
}
