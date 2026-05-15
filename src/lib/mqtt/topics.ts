import type { PairedDeviceV1 } from '../pairingTypes';

export type DeviceTopics = {
  base: string;
  telemetry: string;
  status: string;
  relayCmd: string;
};

export function deviceTopics(deviceId: string): DeviceTopics {
  const base = `iot/${deviceId}`;
  return {
    base,
    telemetry: `${base}/telemetry`,
    status: `${base}/status`,
    relayCmd: `${base}/relay/cmd`,
  };
}

export function topicsForProfile(profile: PairedDeviceV1): DeviceTopics {
  return deviceTopics(profile.deviceId);
}
