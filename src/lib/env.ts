const trim = (v: string | undefined, fallback: string) =>
  (v && v.trim()) || fallback;

const deviceId = trim(process.env.EXPO_PUBLIC_DEVICE_ID, 'esp32_bat_001');

export const env = {
  deviceId,
  appName: trim(process.env.EXPO_PUBLIC_APP_NAME, 'Giám sát pin'),
  topicBase: `iot/${deviceId}`,
};
