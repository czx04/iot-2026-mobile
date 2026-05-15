export type RelayMode = 'auto' | 'force_cut' | 'force_connect';

export type TelemetrySnapshot = {
  vbus: number;
  vavg: number;
  current_mA: number;
  temp_c: number;
  percent: number;
  charging: boolean;
  temp_valid: boolean;
  relay_cut: boolean;
  relay_mode: RelayMode;
};

export type BrokerState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type StatusPayload =
  | { event: 'online' }
  | { event: 'relay_mode'; mode: RelayMode };

export type MqttDeviceView = {
  broker: BrokerState;
  brokerError: string | null;
  telemetry: TelemetrySnapshot | null;
  telemetryAt: number | null;
  telemetryFresh: boolean;
  statusOnline: boolean;
  deviceStale: boolean;
  pendingRelay: RelayMode | null;
  relayAckError: string | null;
};
