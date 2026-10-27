import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme';

/** Ойнату жолағы: әкімші басып немесе сүйреп орынды өзгерте алады. */
export function SeekBar({
  position,
  duration,
  disabled,
  onSeek,
  label,
}: {
  position: number;
  duration: number;
  disabled?: boolean;
  onSeek(seconds: number): void;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const fraction = duration > 0 ? Math.min(1, Math.max(0, (preview ?? position) / duration)) : 0;
  const interactive = !disabled && duration > 0 && width > 0;

  const at = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    return Math.min(1, Math.max(0, x / width)) * duration;
  };

  return (
    <View
      testID="seek-bar"
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(preview ?? position) }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={styles.hit}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={(e) => setPreview(at(e))}
      onResponderMove={(e) => setPreview(at(e))}
      onResponderRelease={(e) => {
        const seconds = at(e);
        setPreview(null);
        onSeek(seconds);
      }}
      onResponderTerminate={() => setPreview(null)}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
      {interactive ? <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, fraction * width - 7) }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 24, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primary },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white, top: 5 },
});
