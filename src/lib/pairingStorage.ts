import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { PairedDeviceV1 } from './pairingTypes';

const PROFILE_KEY = 'iot_paired_profile_v1';
const PASS_KEY = 'iot_mqtt_password_v1';

export async function loadPairedProfile(): Promise<PairedDeviceV1 | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as PairedDeviceV1;
    if (!o || o.v !== 1 || typeof o.deviceId !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

export async function savePairedProfile(
  profile: PairedDeviceV1,
  mqttPassword: string,
): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  await SecureStore.setItemAsync(PASS_KEY, mqttPassword, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function loadMqttPassword(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PASS_KEY);
  } catch {
    return null;
  }
}

export async function clearPairedProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
  try {
    await SecureStore.deleteItemAsync(PASS_KEY);
  } catch {
    return;
  }
}
