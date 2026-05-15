/** Firmware publish interval (`MQTT_PUBLISH_MS`). */
export const TELEMETRY_PUBLISH_MS = 5000;

/** No telemetry for 2× publish cycle → stale warning (F-11). */
export const TELEMETRY_STALE_MS = TELEMETRY_PUBLISH_MS * 2;

/** Wait for `status` relay_mode after cmd (F-33). */
export const RELAY_ACK_TIMEOUT_MS = 5000;

/** HiveMQ Cloud MQTT over WebSocket (TLS). TCP uses 8883 on firmware. */
export const MQTT_WSS_PORT = 8884;

export const RECONNECT_BASE_MS = 2000;
export const RECONNECT_MAX_MS = 30000;

/** UX confirm before force connect when hot (`TEMP_CUT_CHARGE_C`). */
export const TEMP_HIGH_C = 45;

/** No telemetry this long after broker connect → show stale hint. */
export const FIRST_TELEMETRY_WAIT_MS = 12000;
