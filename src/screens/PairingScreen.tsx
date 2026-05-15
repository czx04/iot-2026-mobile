import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '../components/GlassPanel';
import { probeMqttBroker } from '../lib/mqtt/probe';
import { parsePairingQrData, toPairedDevice } from '../lib/pairingPayload';
import type { PairingQrV1 } from '../lib/pairingTypes';
import { savePairedProfile } from '../lib/pairingStorage';

type Step = 'scan' | 'confirm';

type Props = {
  onComplete: () => void;
};

export default function PairingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [step, setStep] = useState<Step>('scan');
  const [qr, setQr] = useState<PairingQrV1 | null>(null);
  const [mqttUser, setMqttUser] = useState('');
  const [mqttPass, setMqttPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const lastDataRef = useRef<string>('');
  const lastTsRef = useRef(0);
  const finishingRef = useRef(false);

  const saveAndEnter = useCallback(
    async (p: PairingQrV1, password: string, explicitUser?: string) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setSaving(true);
      try {
        const user = (explicitUser ?? p.mqttUser ?? '').trim();
        const profile = toPairedDevice(p, user, Date.now());
        await savePairedProfile(profile, password);
        onComplete();
      } catch {
        finishingRef.current = false;
        Alert.alert('Lỗi', 'Không lưu được. Thử lại.');
      } finally {
        setSaving(false);
      }
    },
    [onComplete],
  );

  const applyPayload = useCallback(
    (data: string) => {
      if (saving || finishingRef.current) return;
      const p = parsePairingQrData(data);
      if (!p) {
        Alert.alert(
          'Không đọc được mã',
          'QR không hợp lệ. Dùng đúng mã dán trên thiết bị.',
        );
        return;
      }
      const passFromQr = (p.mqttPass ?? '').trim();
      if (passFromQr) {
        void saveAndEnter(p, passFromQr);
        return;
      }
      setQr(p);
      setMqttUser(p.mqttUser ?? '');
      setMqttPass('');
      setStep('confirm');
    },
    [saveAndEnter, saving],
  );

  const onBarcode = useCallback(
    (ev: { data: string }) => {
      if (step !== 'scan' || saving || finishingRef.current) return;
      const now = Date.now();
      if (ev.data === lastDataRef.current && now - lastTsRef.current < 2500) {
        return;
      }
      lastDataRef.current = ev.data;
      lastTsRef.current = now;
      applyPayload(ev.data);
    },
    [applyPayload, saving, step],
  );

  const onSave = async () => {
    if (!qr) return;
    if (!mqttPass.trim()) {
      Alert.alert(
        'Thiếu mật khẩu',
        'Thêm mqttPass vào QR hoặc nhập mật khẩu bên dưới.',
      );
      return;
    }
    await saveAndEnter(qr, mqttPass.trim(), mqttUser.trim());
  };

  const onProbe = async () => {
    if (!qr) return;
    const pass = (qr.mqttPass ?? mqttPass).trim();
    if (!pass) {
      Alert.alert('Thiếu mật khẩu', 'Nhập mqttPass để kiểm tra broker.');
      return;
    }
    setProbing(true);
    const user = (mqttUser || qr.mqttUser || '').trim();
    const result = await probeMqttBroker(
      { deviceId: qr.deviceId, mqttHost: qr.mqttHost, mqttUser: user },
      pass,
    );
    setProbing(false);
    if (result.ok) {
      Alert.alert('Kết nối thử', 'Đăng nhập broker WSS thành công.');
    } else {
      Alert.alert('Kết nối thử thất bại', result.message);
    }
  };

  const granted = perm?.granted === true;

  return (
    <LinearGradient
      colors={['#070b14', '#0f1f3a', '#132b4d']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Ghép nối thiết bị</Text>
        <Text style={styles.lead}>
          Đưa mã QR trên thiết bị vào khung bên dưới để ghép nối.
        </Text>

        {step === 'scan' && (
          <>
            {Platform.OS !== 'web' && !granted ? (
              <Pressable
                onPress={() => {
                  void requestPerm();
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryTxt}>Cấp quyền camera để quét QR</Text>
              </Pressable>
            ) : null}
            {Platform.OS !== 'web' && granted ? (
              <GlassPanel style={styles.camWrap} contentPadding={0}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onBarcode}
                />
              </GlassPanel>
            ) : null}
            {Platform.OS === 'web' ? (
              <GlassPanel>
                <Text style={styles.webHint}>
                  Bản web không quét QR. Dùng app trên điện thoại (iOS/Android).
                </Text>
              </GlassPanel>
            ) : null}
          </>
        )}

        {step === 'confirm' && qr && (
          <GlassPanel style={styles.confirm}>
            <Text style={styles.confirmTitle}>Xác nhận</Text>
            <Text style={styles.kv}>Thiết bị: {qr.deviceId}</Text>
            {qr.label ? (
              <Text style={styles.kv}>Nhãn: {qr.label}</Text>
            ) : null}
            <Text style={styles.kv}>
              Broker: {qr.mqttHost}:{qr.mqttPort ?? 8883}
            </Text>
            <Text style={styles.fieldLab}>MQTT user</Text>
            <TextInput
              value={mqttUser}
              onChangeText={setMqttUser}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder="user"
              placeholderTextColor="rgba(226,232,240,0.35)"
            />
            <Text style={styles.fieldLab}>MQTT password</Text>
            <TextInput
              value={mqttPass}
              onChangeText={setMqttPass}
              secureTextEntry
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(226,232,240,0.35)"
            />
            <Pressable
              onPress={() => void onProbe()}
              disabled={saving || probing}
              style={({ pressed }) => [
                styles.secondaryBtn,
                (pressed || saving || probing) && styles.pressed,
              ]}
            >
              {probing ? (
                <ActivityIndicator color="#e2e8f0" />
              ) : (
                <Text style={styles.secondaryTxt}>Kết nối thử broker</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void onSave()}
              disabled={saving || probing}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || saving || probing) && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryTxt}>Lưu và vào app</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                finishingRef.current = false;
                setStep('scan');
                setQr(null);
                setMqttPass('');
              }}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            >
              <Text style={styles.ghostTxt}>Quay lại quét</Text>
            </Pressable>
          </GlassPanel>
        )}
      </ScrollView>

      {saving ? (
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.overlayTxt}>Đang ghép nối…</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18, gap: 14 },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
  },
  lead: {
    color: 'rgba(226,232,240,0.78)',
    fontSize: 14,
    lineHeight: 20,
  },
  camWrap: { padding: 0, overflow: 'hidden' },
  camera: { width: '100%', height: 320, borderRadius: 18 },
  primaryBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryTxt: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryTxt: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  pressed: { opacity: 0.88 },
  confirm: {},
  confirmTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  kv: {
    color: 'rgba(226,232,240,0.88)',
    fontSize: 14,
    marginBottom: 6,
  },
  fieldLab: {
    color: 'rgba(226,232,240,0.65)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#f8fafc',
    fontSize: 15,
  },
  ghostBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostTxt: { color: 'rgba(226,232,240,0.85)', fontWeight: '700', fontSize: 14 },
  webHint: {
    color: 'rgba(226,232,240,0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,11,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  overlayTxt: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
});
