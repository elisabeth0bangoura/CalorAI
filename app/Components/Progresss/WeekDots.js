// WeekDots.js
import { useStreak } from '@/app/Context/StreakContext';
import { Check } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { height } from 'react-native-responsive-sizes';

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const startOfWeek = (date, weekStartsOn = 1) => {
  const d = new Date(date);
  const day = (d.getDay() + 7 - weekStartsOn) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function WeekDots({
  doneDates = [],           // <- if you pass real dates, these win
  weekStartsOn = 1,
  size = 12,
  spacing = 10,
  greenCount,               // fallback gauge if no dates available
  solidGreen = '#22C55E',
  checkColor = '#fff',
  undoneDotColor = '#F1F3F9',
}) {
  const { colors, greenCount: ctxGreenCount, week } = useStreak();

  const dotGreen = colors?.dotGreen ?? solidGreen;
  const dotIdle  = colors?.dotIdle  ?? undoneDotColor;
  const checkCol = colors?.checkColor ?? checkColor;
  const isWhiteTheme = colors?.fg === '#FFFFFF';

  // Decide data source:
  const sourceDoneDates =
    (doneDates && doneDates.length > 0)
      ? doneDates
      : (week?.doneDates ?? []);

  const gaugeCount = Number.isFinite(greenCount)
    ? Math.max(0, Math.min(7, greenCount))
    : (ctxGreenCount ?? 0);

  const today = new Date();
  const start = startOfWeek(today, weekStartsOn);

  const days = useMemo(() => {
    const labels = ['M','T','W','T','F','S','S'];
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = iso(d);
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      arr.push({ key, label: labels[i], isToday });
    }

    if (sourceDoneDates.length > 0) {
      const set = new Set(sourceDoneDates);
      return arr.map(item => ({
        ...item,
        isDone: set.has(item.key),
        color: set.has(item.key) ? dotGreen : dotIdle,
      }));
    }

    // fallback: gauge (first N greens)
    return arr.map((item, idx) => ({
      ...item,
      isDone: idx < gaugeCount,
      color: idx < gaugeCount ? dotGreen : dotIdle,
    }));
  }, [sourceDoneDates, dotGreen, dotIdle, start, today, gaugeCount]);

  return (
    <View style={{ alignItems: 'center', position: 'absolute', bottom: height(2.8) }}>
      <View style={{ flexDirection: 'row', gap: spacing }}>
        {days.map(d => (
          <View
            key={d.key}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: d.color,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: d.isToday ? 1 : 0,
              borderColor: d.isToday ? d.color : 'transparent',
            }}
          >
            {d.isDone ? (
              <Check size={Math.max(10, size * 0.7)} color={checkCol} strokeWidth={3} />
            ) : (
              <View
                style={{
                  width: size * 0.5,
                  height: size * 0.5,
                  borderRadius: (size * 0.5) / 2,
                  backgroundColor: '#000',
                  opacity: isWhiteTheme ? 0.55 : 0.25,
                }}
              />
            )}
          </View>
        ))}
      </View>

      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', gap: spacing }}>
        {days.map(d => (
          <Text
            key={d.key + '-label'}
            style={{
              width: size,
              textAlign: 'center',
              fontWeight: d.isToday ? '700' : '500',
              color: isWhiteTheme
                ? (d.isToday ? '#FFFFFF' : 'rgba(255,255,255,0.8)')
                : (d.isToday ? '#111827' : '#9CA3AF'),
            }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
