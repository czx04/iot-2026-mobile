import type { RelayMode, StatusPayload, TelemetrySnapshot } from './types';

const RELAY_MODES: RelayMode[] = ['auto', 'force_cut', 'force_connect'];

const asNum = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const asBool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
};

const asRelayMode = (v: unknown): RelayMode | null => {
  if (typeof v !== 'string') return null;
  return RELAY_MODES.includes(v as RelayMode) ? (v as RelayMode) : null;
};

export function parseTelemetryPayload(raw: string): TelemetrySnapshot | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  const vbus = asNum(o.vbus);
  const vavg = asNum(o.vavg);
  const current_mA = asNum(o.current_mA);
  const temp_c = asNum(o.temp_c);
  const percent = asNum(o.percent);
  const charging = asBool(o.charging);
  const temp_valid = asBool(o.temp_valid);
  const relay_cut = asBool(o.relay_cut);
  const relay_mode = asRelayMode(o.relay_mode);

  if (
    vbus === null ||
    vavg === null ||
    current_mA === null ||
    temp_c === null ||
    percent === null ||
    charging === null ||
    temp_valid === null ||
    relay_cut === null ||
    relay_mode === null
  ) {
    return null;
  }

  return {
    vbus,
    vavg,
    current_mA,
    temp_c,
    percent,
    charging,
    temp_valid,
    relay_cut,
    relay_mode,
  };
}

export function parseStatusPayload(raw: string): StatusPayload | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (o.event === 'online') return { event: 'online' };
  if (o.event === 'relay_mode') {
    const mode = asRelayMode(o.mode);
    if (!mode) return null;
    return { event: 'relay_mode', mode };
  }
  return null;
}
