import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import PairingScreen from './src/screens/PairingScreen';
import type { PairedDeviceV1 } from './src/lib/pairingTypes';
import { clearPairedProfile, loadPairedProfile } from './src/lib/pairingStorage';

type Gate = 'load' | 'pair' | 'home';

export default function App() {
  const [gate, setGate] = useState<Gate>('load');
  const [profile, setProfile] = useState<PairedDeviceV1 | null>(null);

  const refresh = useCallback(async () => {
    const p = await loadPairedProfile();
    setProfile(p);
    setGate(p ? 'home' : 'pair');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPaired = useCallback(() => {
    void refresh();
  }, [refresh]);

  const onUnpair = useCallback(() => {
    setGate('pair');
    setProfile(null);
  }, []);

  if (gate === 'load') {
    return (
      <SafeAreaProvider>
        <View style={styles.load}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {gate === 'pair' ? (
        <PairingScreen
          onComplete={() => {
            void refresh();
          }}
        />
      ) : profile ? (
        <HomeScreen
          pairing={profile}
          onUnpair={async () => {
            await clearPairedProfile();
            onUnpair();
          }}
        />
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  load: {
    flex: 1,
    backgroundColor: '#070b14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
