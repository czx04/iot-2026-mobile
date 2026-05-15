import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { loadMqttPassword } from '../lib/pairingStorage';
import type { PairedDeviceV1 } from '../lib/pairingTypes';
import { mqttSession } from '../lib/mqtt/MqttDeviceSession';
import type { MqttDeviceView, RelayMode } from '../lib/mqtt/types';

export function useMqttDevice(profile: PairedDeviceV1) {
  const [view, setView] = useState<MqttDeviceView>(mqttSession.getView());
  const [passwordReady, setPasswordReady] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    return mqttSession.subscribe(setView);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPasswordReady(false);
    setPasswordError(null);

    void (async () => {
      const pass = await loadMqttPassword();
      if (cancelled) return;
      if (!pass) {
        setPasswordError('Không đọc được mật khẩu MQTT đã lưu');
        setPasswordReady(true);
        return;
      }
      setPasswordReady(true);
      await mqttSession.connect(profile, pass);
    })();

    return () => {
      cancelled = true;
      mqttSession.disconnect();
    };
  }, [profile.deviceId, profile.mqttHost, profile.mqttUser, profile.mqttPort]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active' && view.broker === 'disconnected') {
        mqttSession.retryConnect();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [view.broker]);

  const disconnect = useCallback(() => {
    mqttSession.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    mqttSession.retryConnect();
  }, []);

  const publishRelay = useCallback((mode: RelayMode) => {
    mqttSession.publishRelay(mode);
  }, []);

  return {
    view,
    passwordReady,
    passwordError,
    disconnect,
    reconnect,
    publishRelay,
  };
}
