import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  contentPadding?: number;
};

export function GlassPanel({ children, style, contentPadding = 16 }: Props) {
  const radius = 22;
  return (
    <View style={[styles.shell, { borderRadius: radius }, style]}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.10)' },
          ]}
        />
      ) : (
        <BlurView
          intensity={52}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.22)',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.35)',
            opacity: 0.45,
          },
        ]}
      />
      <View style={[styles.inner, { padding: contentPadding }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  inner: {
    padding: 16,
  },
});
