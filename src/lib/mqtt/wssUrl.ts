import { MQTT_WSS_PORT } from './constants';

/** HiveMQ Cloud WebSocket endpoint (app); firmware uses TCP :8883. */
export function mqttWssUrl(host: string): string {
  const h = host.trim().replace(/^wss?:\/\//i, '').split('/')[0];
  return `wss://${h}:${MQTT_WSS_PORT}/mqtt`;
}
