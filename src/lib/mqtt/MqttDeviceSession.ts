import mqtt, { type MqttClient } from 'mqtt';
import type { PairedDeviceV1 } from '../pairingTypes';
import {
  FIRST_TELEMETRY_WAIT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RELAY_ACK_TIMEOUT_MS,
  TELEMETRY_STALE_MS,
} from './constants';
import { parseStatusPayload, parseTelemetryPayload } from './parse';
import { relayCmdPayload } from './relay';
import { topicsForProfile } from './topics';
import type {
  BrokerState,
  MqttDeviceView,
  RelayMode,
  TelemetrySnapshot,
} from './types';
import { mqttWssUrl } from './wssUrl';

type Listener = (view: MqttDeviceView) => void;

const emptyView = (): MqttDeviceView => ({
  broker: 'idle',
  brokerError: null,
  telemetry: null,
  telemetryAt: null,
  telemetryFresh: false,
  statusOnline: false,
  deviceStale: false,
  pendingRelay: null,
  relayAckError: null,
});

export class MqttDeviceSession {
  private client: MqttClient | null = null;
  private profile: PairedDeviceV1 | null = null;
  private password: string | null = null;
  private listeners = new Set<Listener>();
  private view: MqttDeviceView = emptyView();
  private intentionalDisconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private relayAckTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private connectedAt: number | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.view);
    return () => this.listeners.delete(fn);
  }

  getView(): MqttDeviceView {
    return this.view;
  }

  async connect(profile: PairedDeviceV1, password: string): Promise<void> {
    this.intentionalDisconnect = false;
    this.profile = profile;
    this.password = password;
    this.reconnectAttempt = 0;
    await this.openClient();
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnect();
    this.clearRelayAck();
    this.stopStaleCheck();
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        /* ignore */
      }
      this.client = null;
    }
    this.connectedAt = null;
    this.patch({
      broker: 'disconnected',
      brokerError: null,
      telemetryFresh: false,
      deviceStale: false,
      statusOnline: false,
      pendingRelay: null,
      relayAckError: null,
    });
  }

  publishRelay(mode: RelayMode): void {
    if (!this.client?.connected || !this.profile) return;
    const { relayCmd } = topicsForProfile(this.profile);
    const payload = relayCmdPayload(mode);
    this.client.publish(relayCmd, payload, { qos: 0 }, (err) => {
      if (err) {
        this.patch({
          pendingRelay: null,
          relayAckError: 'Không gửi được lệnh relay',
        });
        return;
      }
      this.patch({ pendingRelay: mode, relayAckError: null });
      this.armRelayAck(mode);
    });
  }

  retryConnect(): void {
    if (!this.profile || !this.password) return;
    this.intentionalDisconnect = false;
    this.reconnectAttempt = 0;
    void this.openClient();
  }

  private async openClient(): Promise<void> {
    if (!this.profile || !this.password) return;

    this.clearReconnect();
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        /* ignore */
      }
      this.client = null;
    }

    this.patch({
      broker: 'connecting',
      brokerError: null,
      relayAckError: null,
    });

    const { mqttHost } = this.profile;
    const url = mqttWssUrl(mqttHost);
    const clientId = `iot_app_${this.profile.deviceId}_${Date.now().toString(36)}`;

    const client = mqtt.connect(url, {
      clientId,
      username: this.profile.mqttUser,
      password: this.password,
      protocol: 'wss',
      keepalive: 60,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 20000,
    });

    this.client = client;

    client.on('connect', () => {
      this.reconnectAttempt = 0;
      this.connectedAt = Date.now();
      const topics = topicsForProfile(this.profile!);
      client.subscribe([topics.telemetry, topics.status], { qos: 0 }, (err) => {
        if (err) {
          this.patch({
            broker: 'error',
            brokerError: 'Subscribe topic thất bại',
          });
          return;
        }
        this.patch({ broker: 'connected', brokerError: null });
        this.startStaleCheck();
      });
    });

    client.on('message', (topic, buf) => this.onMessage(topic, buf.toString()));

    client.on('error', (err) => {
      this.patch({
        broker: 'error',
        brokerError: err.message || 'Lỗi MQTT',
      });
    });

    client.on('close', () => {
      this.stopStaleCheck();
      if (this.intentionalDisconnect) {
        this.patch({ broker: 'disconnected' });
        return;
      }
      this.patch({
        broker: 'disconnected',
        telemetryFresh: false,
        deviceStale: false,
      });
      this.scheduleReconnect();
    });

    client.on('offline', () => {
      if (!this.intentionalDisconnect) {
        this.patch({ broker: 'disconnected', telemetryFresh: false });
      }
    });
  }

  private onMessage(topic: string, raw: string): void {
    if (!this.profile) return;
    const topics = topicsForProfile(this.profile);

    if (topic === topics.telemetry) {
      const tel = parseTelemetryPayload(raw);
      if (!tel) return;
      const now = Date.now();
      const acked =
        this.view.pendingRelay !== null &&
        tel.relay_mode === this.view.pendingRelay;
      this.patch({
        telemetry: tel,
        telemetryAt: now,
        telemetryFresh: true,
        deviceStale: false,
        statusOnline: true,
        pendingRelay: acked ? null : this.view.pendingRelay,
        relayAckError: acked ? null : this.view.relayAckError,
      });
      if (acked) this.clearRelayAck();
      return;
    }

    if (topic === topics.status) {
      const st = parseStatusPayload(raw);
      if (!st) return;
      if (st.event === 'online') {
        this.patch({ statusOnline: true });
        return;
      }
      if (st.event === 'relay_mode') {
        const tel = this.view.telemetry;
        const nextTel: TelemetrySnapshot | null = tel
          ? {
              ...tel,
              relay_mode: st.mode,
              relay_cut:
                st.mode === 'force_cut'
                  ? true
                  : st.mode === 'force_connect'
                    ? false
                    : tel.relay_cut,
            }
          : null;
        const acked = this.view.pendingRelay === st.mode;
        this.patch({
          statusOnline: true,
          telemetry: nextTel ?? tel,
          pendingRelay: acked ? null : this.view.pendingRelay,
          relayAckError: acked ? null : this.view.relayAckError,
        });
        if (acked) this.clearRelayAck();
      }
    }
  }

  private armRelayAck(expected: RelayMode): void {
    this.clearRelayAck();
    this.relayAckTimer = setTimeout(() => {
      if (this.view.pendingRelay === expected) {
        this.patch({
          pendingRelay: null,
          relayAckError: 'Thiết bị chưa xác nhận lệnh (timeout)',
        });
      }
    }, RELAY_ACK_TIMEOUT_MS);
  }

  private clearRelayAck(): void {
    if (this.relayAckTimer) {
      clearTimeout(this.relayAckTimer);
      this.relayAckTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect || !this.profile || !this.password) return;
    this.clearReconnect();
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.openClient();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startStaleCheck(): void {
    this.stopStaleCheck();
    this.staleTimer = setInterval(() => this.refreshStale(), 1000);
  }

  private stopStaleCheck(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
  }

  private refreshStale(): void {
    if (this.view.broker !== 'connected') return;
    const now = Date.now();
    const at = this.view.telemetryAt;
    const fresh = at !== null && now - at < TELEMETRY_STALE_MS;
    let stale = false;
    if (at !== null) {
      stale = !fresh;
    } else if (
      this.connectedAt !== null &&
      now - this.connectedAt > FIRST_TELEMETRY_WAIT_MS
    ) {
      stale = true;
    }
    if (fresh !== this.view.telemetryFresh || stale !== this.view.deviceStale) {
      this.patch({ telemetryFresh: fresh, deviceStale: stale });
    }
  }

  private patch(partial: Partial<MqttDeviceView>): void {
    this.view = { ...this.view, ...partial };
    for (const fn of this.listeners) fn(this.view);
  }
}

/** Shared session for the app process. */
export const mqttSession = new MqttDeviceSession();
