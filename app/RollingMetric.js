// components/RollingMetric.js  (JS)
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedRollingNumber } from 'react-native-animated-rolling-numbers';
import { Easing } from 'react-native-reanimated';

export default function RollingMetric({
  label,
  value = 0,
  unit = '',
  toFixed,               // e.g. 0 or 1 (leave undefined for ints)
  compact = false,       // use K/M/B/T for huge numbers
  color = '#111',
  style,
  numberStyle,
}) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;

  return (
    <View style={[style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <AnimatedRollingNumber
          value={v}
          toFixed={toFixed}
          useGrouping
          enableCompactNotation={compact}
          compactToFixed={2}
          textStyle={[styles.digits, { color }, numberStyle]}
          spinningAnimationConfig={{ duration: 500, easing: Easing.out(Easing.cubic) }}
        />
        {!!unit && <Text style={[styles.unit, { color }]}>{` ${unit}`}</Text>}
      </View>
     
    </View>
  );
}

const styles = StyleSheet.create({

  digits: { fontSize: 32, fontWeight: '800' },
  unit: { fontSize: 18, fontWeight: '600',  opacity: 0.9 },
  label: { marginTop: 6, fontSize: 14, color: '#6b7280', fontWeight: '600' },
});
