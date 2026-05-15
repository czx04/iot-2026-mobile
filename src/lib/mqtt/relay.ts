import type { RelayMode } from './types';

export function relayModeLabel(mode: RelayMode): string {
  if (mode === 'force_cut') return 'Ép cắt';
  if (mode === 'force_connect') return 'Ép nối';
  return 'Tự động';
}

export function relayCmdPayload(mode: RelayMode): string {
  if (mode === 'force_cut') return 'cut';
  if (mode === 'force_connect') return 'connect';
  return 'auto';
}

export function isAutoThermalCut(
  telemetry: { relay_mode: RelayMode; relay_cut: boolean } | null,
): boolean {
  return (
    telemetry?.relay_mode === 'auto' && telemetry.relay_cut === true
  );
}
