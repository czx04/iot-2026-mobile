import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '../components/GlassPanel';
import { useMqttDevice } from '../hooks/useMqttDevice';
import { env } from '../lib/env';
import { formatUpdatedAt } from '../lib/formatTime';
import { TEMP_HIGH_C } from '../lib/mqtt/constants';
import { isAutoThermalCut, relayModeLabel } from '../lib/mqtt/relay';
import { topicsForProfile } from '../lib/mqtt/topics';
import type { RelayMode } from '../lib/mqtt/types';
import type { PairedDeviceV1 } from '../lib/pairingTypes';

export type HomeScreenProps = {
  pairing: PairedDeviceV1;
  onUnpair: () => void | Promise<void>;
};

function brokerBannerText(
  broker: string,
  err: string | null,
): { text: string; tone: 'ok' | 'warn' | 'err' | 'muted' } {
  if (broker === 'connecting') {
    return { text: 'Đang kết nối broker…', tone: 'warn' };
  }
  if (broker === 'connected') {
    return { text: 'Broker: đã kết nối', tone: 'ok' };
  }
  if (broker === 'error') {
    return { text: err ?? 'Lỗi broker', tone: 'err' };
  }
  if (broker === 'disconnected') {
    return { text: 'Broker: đã ngắt', tone: 'muted' };
  }
  return { text: 'Broker: chưa kết nối', tone: 'muted' };
}

export default function HomeScreen({ pairing, onUnpair }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { view, passwordError, disconnect, reconnect, publishRelay } =
    useMqttDevice(pairing);
  const [helpOpen, setHelpOpen] = useState(false);

  const topics = topicsForProfile(pairing);
  const tel = view.telemetry;
  const pending = view.pendingRelay;

  const titleLine = pairing.label
    ? `${pairing.label} · ${pairing.deviceId}`
    : pairing.deviceId;

  const brokerUi = brokerBannerText(view.broker, view.brokerError);

  const sendRelay = useCallback(
    (mode: RelayMode) => {
      if (view.broker !== 'connected') {
        Alert.alert('Chưa kết nối', 'Kết nối broker trước khi gửi lệnh relay.');
        return;
      }
      publishRelay(mode);
    },
    [publishRelay, view.broker],
  );

  const onRelayPress = useCallback(
    (mode: RelayMode) => {
      if (mode === 'force_connect' && tel?.temp_valid && tel.temp_c >= TEMP_HIGH_C) {
        Alert.alert(
          'Nhiệt độ cao',
          `Nhiệt ${tel.temp_c.toFixed(1)} °C (≥ ${TEMP_HIGH_C} °C). Ép nối relay có thể không an toàn. Tiếp tục?`,
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Ép nối', style: 'destructive', onPress: () => sendRelay(mode) },
          ],
        );
        return;
      }
      sendRelay(mode);
    },
    [sendRelay, tel],
  );

  const handleUnpair = () => {
    Alert.alert(
      'Ghép lại thiết bị?',
      'Ngắt MQTT và xóa cấu hình trên máy này.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Ghép lại',
          style: 'destructive',
          onPress: () => {
            disconnect();
            void onUnpair();
          },
        },
      ],
    );
  };

  const showDash = !tel || view.broker !== 'connected';

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
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{env.appName}</Text>
              <Text style={styles.sub}>{titleLine}</Text>
              <Text style={styles.subMuted}>
                {pairing.mqttHost} · WSS {8884}
              </Text>
            </View>
            <Pressable
              onPress={handleUnpair}
              style={({ pressed }) => [styles.unpair, pressed && styles.btnPressed]}
            >
              <Text style={styles.unpairTxt}>Ghép lại</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.banner,
              brokerUi.tone === 'ok' && styles.bannerOk,
              brokerUi.tone === 'warn' && styles.bannerWarn,
              brokerUi.tone === 'err' && styles.bannerErr,
            ]}
          >
            {view.broker === 'connecting' ? (
              <ActivityIndicator size="small" color="#fde68a" style={styles.bannerSpin} />
            ) : null}
            <Text style={styles.bannerTxt}>{brokerUi.text}</Text>
          </View>

          {passwordError ? (
            <Text style={styles.errInline}>{passwordError}</Text>
          ) : null}

          <View style={styles.connRow}>
            <Pressable
              onPress={reconnect}
              disabled={view.broker === 'connecting'}
              style={({ pressed }) => [
                styles.connBtn,
                pressed && styles.btnPressed,
                view.broker === 'connecting' && styles.connBtnDisabled,
              ]}
            >
              <Text style={styles.connBtnTxt}>Kết nối lại</Text>
            </Pressable>
            <Pressable
              onPress={disconnect}
              disabled={view.broker === 'idle' || view.broker === 'disconnected'}
              style={({ pressed }) => [
                styles.connBtn,
                styles.connBtnGhost,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.connBtnGhostTxt}>Ngắt</Text>
            </Pressable>
            <Pressable
              onPress={() => setHelpOpen(true)}
              style={({ pressed }) => [styles.connBtn, styles.connBtnGhost, pressed && styles.btnPressed]}
            >
              <Text style={styles.connBtnGhostTxt}>Topic</Text>
            </Pressable>
          </View>

          <View style={styles.badges}>
            {view.statusOnline ? (
              <View style={[styles.badge, styles.badgeOk]}>
                <Text style={styles.badgeTxt}>Thiết bị trên broker</Text>
              </View>
            ) : null}
            {view.telemetryFresh ? (
              <View style={[styles.badge, styles.badgeOk]}>
                <Text style={styles.badgeTxt}>Đang gửi telemetry</Text>
              </View>
            ) : null}
            {view.deviceStale && view.broker === 'connected' ? (
              <View style={[styles.badge, styles.badgeWarn]}>
                <Text style={styles.badgeTxt}>Chưa có dữ liệu mới</Text>
              </View>
            ) : null}
          </View>

          {view.deviceStale && view.broker === 'connected' ? (
            <Text style={styles.hintStale}>
              App đang nghe{' '}
              <Text style={styles.hintMono}>iot/{pairing.deviceId}/…</Text>. Simulator
              mặc định là{' '}
              <Text style={styles.hintMono}>esp32_bat_sim</Text> — ghép lại đúng QR
              hoặc đổi deviceId trong config simulator.
            </Text>
          ) : null}

          {view.relayAckError ? (
            <Text style={styles.errInline}>{view.relayAckError}</Text>
          ) : null}
        </View>

        <GlassPanel style={styles.hero}>
          <Text style={styles.heroEyebrow}>Mức pin</Text>
          <Text style={styles.heroPct}>
            {showDash ? '—' : `${tel!.percent.toFixed(1)}%`}
          </Text>
          {view.telemetryAt ? (
            <Text style={styles.updatedAt}>
              Cập nhật lúc {formatUpdatedAt(view.telemetryAt)}
            </Text>
          ) : (
            <Text style={styles.updatedAt}>Chưa nhận telemetry</Text>
          )}
          <View style={styles.rowChips}>
            <View style={[styles.chip, tel?.charging && styles.chipOn]}>
              <Text style={styles.chipTxt}>
                {showDash ? '—' : tel!.charging ? 'Đang sạc' : 'Không sạc'}
              </Text>
            </View>
            <View style={[styles.chip, tel?.temp_valid && styles.chipOn]}>
              <Text style={styles.chipTxt}>
                {showDash ? '—' : tel!.temp_valid ? 'Nhiệt hợp lệ' : 'Nhiệt lỗi'}
              </Text>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={styles.metrics}>
          <View style={styles.metricGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLab}>Vbus</Text>
              <Text style={styles.metricVal}>
                {showDash ? '—' : `${tel!.vbus.toFixed(3)} V`}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLab}>Vavg</Text>
              <Text style={styles.metricVal}>
                {showDash ? '—' : `${tel!.vavg.toFixed(3)} V`}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLab}>Dòng</Text>
              <Text style={styles.metricVal}>
                {showDash ? '—' : `${tel!.current_mA.toFixed(1)} mA`}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLab}>Nhiệt độ</Text>
              <Text style={styles.metricVal}>
                {showDash
                  ? '—'
                  : tel!.temp_valid
                    ? `${tel!.temp_c.toFixed(1)} °C`
                    : '—'}
              </Text>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={styles.relay}>
          <Text style={styles.sectionTitle}>Relay</Text>
          <View style={styles.relayRow}>
            <Text style={styles.relayState}>
              {showDash ? '—' : tel!.relay_cut ? 'Đang cắt' : 'Đang nối'}
            </Text>
            <View style={styles.modePill}>
              <Text style={styles.modePillTxt}>
                {showDash ? '—' : relayModeLabel(tel!.relay_mode)}
              </Text>
            </View>
          </View>
          {tel && isAutoThermalCut(tel) ? (
            <Text style={styles.relayHint}>
              Chế độ tự động: relay đang cắt do nhiệt (firmware). Bấm Tự động để
              giữ logic auto.
            </Text>
          ) : null}
        </GlassPanel>
      </ScrollView>

      <View
        style={[
          styles.dock,
          {
            paddingBottom: Math.max(insets.bottom, 14),
            paddingTop: 10,
          },
        ]}
      >
        <GlassPanel style={styles.dockInner}>
          <View style={styles.actions}>
            <Pressable
              onPress={() => onRelayPress('auto')}
              disabled={!!pending || view.broker !== 'connected'}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                pressed && styles.btnPressed,
                pending === 'auto' && styles.btnGlow,
              ]}
            >
              {pending === 'auto' ? (
                <ActivityIndicator color="#e2e8f0" />
              ) : (
                <Text style={styles.btnGhostTxt}>Tự động</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => onRelayPress('force_cut')}
              disabled={!!pending || view.broker !== 'connected'}
              style={({ pressed }) => [
                styles.btn,
                styles.btnCut,
                pressed && styles.btnPressed,
                pending === 'force_cut' && styles.btnGlow,
              ]}
            >
              {pending === 'force_cut' ? (
                <ActivityIndicator color="#fecaca" />
              ) : (
                <Text style={styles.btnCutTxt}>Cắt</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => onRelayPress('force_connect')}
              disabled={!!pending || view.broker !== 'connected'}
              style={({ pressed }) => [
                styles.btn,
                styles.btnOk,
                pressed && styles.btnPressed,
                pending === 'force_connect' && styles.btnGlow,
              ]}
            >
              {pending === 'force_connect' ? (
                <ActivityIndicator color="#ccfbf1" />
              ) : (
                <Text style={styles.btnOkTxt}>Nối</Text>
              )}
            </Pressable>
          </View>
        </GlassPanel>
      </View>

      <Modal visible={helpOpen} animationType="fade" transparent onRequestClose={() => setHelpOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setHelpOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Topic MQTT</Text>
            <Text style={styles.modalBody}>
              App subscribe (nhận):{'\n'}
              • {topics.telemetry} — JSON pin, dòng, nhiệt, relay{'\n'}
              • {topics.status} — online / relay_mode (retain){'\n\n'}
              App publish (gửi):{'\n'}
              • {topics.relayCmd} — chuỗi: auto, cut, connect
            </Text>
            <Pressable
              onPress={() => setHelpOpen(false)}
              style={({ pressed }) => [styles.modalClose, pressed && styles.btnPressed]}
            >
              <Text style={styles.modalCloseTxt}>Đóng</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18, gap: 14 },
  header: { gap: 8 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  subMuted: {
    color: 'rgba(226,232,240,0.55)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  unpair: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  unpairTxt: { color: '#fecaca', fontSize: 12, fontWeight: '800' },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sub: {
    color: 'rgba(226,232,240,0.72)',
    fontSize: 14,
    fontWeight: '500',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bannerOk: {
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderColor: 'rgba(45,212,191,0.3)',
  },
  bannerWarn: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.3)',
  },
  bannerErr: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  bannerSpin: { marginRight: 8 },
  bannerTxt: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  errInline: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
  },
  hintStale: {
    color: 'rgba(253,224,71,0.88)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  hintMono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '700',
  },
  connRow: { flexDirection: 'row', gap: 8 },
  connBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.4)',
  },
  connBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  connBtnDisabled: { opacity: 0.5 },
  connBtnTxt: { color: '#e0f2fe', fontSize: 12, fontWeight: '800' },
  connBtnGhostTxt: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeOk: {
    backgroundColor: 'rgba(45,212,191,0.14)',
    borderColor: 'rgba(45,212,191,0.35)',
  },
  badgeWarn: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  badgeTxt: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  hero: {},
  heroEyebrow: {
    color: 'rgba(226,232,240,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroPct: {
    marginTop: 6,
    color: '#e0f2fe',
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
  },
  updatedAt: {
    marginTop: 6,
    color: 'rgba(226,232,240,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  rowChips: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: {
    backgroundColor: 'rgba(45,212,191,0.16)',
    borderColor: 'rgba(45,212,191,0.35)',
  },
  chipTxt: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  metrics: {},
  sectionTitle: {
    color: 'rgba(226,232,240,0.75)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCell: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metricLab: {
    color: 'rgba(226,232,240,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  metricVal: {
    marginTop: 6,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  relay: {},
  relayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  relayState: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  modePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.35)',
  },
  modePillTxt: { color: '#e0f2fe', fontSize: 12, fontWeight: '800' },
  relayHint: {
    marginTop: 10,
    color: 'rgba(253,224,71,0.9)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
  },
  dockInner: { paddingVertical: 12, paddingHorizontal: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  btnGlow: {
    shadowColor: '#38bdf8',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  btnGhost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  btnGhostTxt: { color: '#e2e8f0', fontWeight: '800', fontSize: 13 },
  btnCut: {
    backgroundColor: 'rgba(248,113,113,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  btnCutTxt: { color: '#fecaca', fontWeight: '900', fontSize: 13 },
  btnOk: {
    backgroundColor: 'rgba(45,212,191,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,212,191,0.35)',
  },
  btnOkTxt: { color: '#ccfbf1', fontWeight: '900', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,11,20,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0f1f3a',
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalBody: {
    color: 'rgba(226,232,240,0.85)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.25)',
    alignItems: 'center',
  },
  modalCloseTxt: { color: '#e0f2fe', fontWeight: '800', fontSize: 14 },
});
