import mqtt from 'mqtt';
import type { PairedDeviceV1 } from '../pairingTypes';
import { mqttWssUrl } from './wssUrl';

export type ProbeResult =
  | { ok: true }
  | { ok: false; message: string };

/** F-03: quick broker login test (no subscribe). */
export function probeMqttBroker(
  profile: Pick<PairedDeviceV1, 'mqttHost' | 'mqttUser' | 'deviceId'>,
  password: string,
  timeoutMs = 15000,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const url = mqttWssUrl(profile.mqttHost);
    const clientId = `iot_probe_${profile.deviceId}_${Date.now().toString(36)}`;
    let settled = false;

    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const client = mqtt.connect(url, {
      clientId,
      username: profile.mqttUser,
      password,
      protocol: 'wss',
      keepalive: 30,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      finish({ ok: false, message: 'Hết thời gian chờ broker' });
    }, timeoutMs);

    client.on('connect', () => {
      finish({ ok: true });
    });

    client.on('error', (err) => {
      finish({ ok: false, message: err.message || 'Lỗi kết nối' });
    });
  });
}
