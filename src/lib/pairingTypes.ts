export type PairingQrV1 = {
  v: 1;
  deviceId: string;
  mqttHost: string;
  mqttPort?: number;
  mqttUser?: string;
  mqttPass?: string;
  label?: string;
};

export type PairedDeviceV1 = {
  v: 1;
  deviceId: string;
  mqttHost: string;
  mqttPort: number;
  mqttUser: string;
  label?: string;
  pairedAt: number;
};
