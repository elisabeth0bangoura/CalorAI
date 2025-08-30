import { collection, onSnapshot, orderBy, query } from '@react-native-firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  PixelRatio,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { height, width } from 'react-native-responsive-sizes';

export default function TwoRowMonthlyHeatmap({
  db,
  userId,
  monthsAhead = 4,      // initial future months rendered
  monthsBack = 0,       // initial past months (kept for your API)
  gap = 6,
  createdAtField = 'created_at',
  onDayPress,
  loadBatchSize = 12,   // how many more months to append each time
}) {
  const screenW = Dimensions.get('window').width;

  // keep your padding + container math
  const H_PADDING = 10;
  const containerW = screenW - H_PADDING * 1.9;

  const [eventsByDay, setEventsByDay] = useState({});
  const [months, setMonths] = useState(() => buildInitialMonths(new Date(), monthsBack, monthsAhead));
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef(null);

  /* ---------------- Firestore live data ---------------- */
  useEffect(() => {
    if (!db || !userId) return;
    const ref = collection(db, `users/${userId}/Inventory`);
    const q = query(ref, orderBy(createdAtField, 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const m = {};
      snap.forEach((doc) => {
        const d = doc.data()?.[createdAtField];
        if (!d) return;
        const date = d?.toDate ? d.toDate() : new Date(d);
        const key = iso(date);
        m[key] = (m[key] || 0) + 1;
      });
      setEventsByDay(m);
    });
    return () => unsub();
  }, [db, userId, createdAtField]);

  // jump to current month page
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToIndex({ index: monthsBack, animated: false }), 0);
  }, [monthsBack]);

  /* ---------------- Infinite append ahead ---------------- */
  const onEndReached = useCallback(() => {
    if (loadingMore || months.length === 0) return;
    setLoadingMore(true);

    const last = months[months.length - 1];
    const lastDate = new Date(last.year, last.monthIndex, 1);

    const more = buildRange(offsetMonth(lastDate, 1), loadBatchSize);
    setMonths((prev) => prev.concat(more));

    setLoadingMore(false);
  }, [loadingMore, months, loadBatchSize]);

  /* ---------------- Render ---------------- */
  const renderMonth = ({ item }) => {
    const { year, monthIndex, label, daysInMonth } = item;
    const monthKey = `${year}-${pad(monthIndex + 1)}`;

    const firstRowCount  = Math.ceil(daysInMonth / 2);
    const secondRowCount = daysInMonth - firstRowCount;

    // UNIFORM SQUARE SIZE ACROSS ALL MONTHS
    const MAX_COLUMNS = 16; // ceil(31 / 2)
   const  theAvailable = containerW - gap * (MAX_COLUMNS - 1);
    const squareSize = PixelRatio.roundToNearestPixel(theAvailable / MAX_COLUMNS);

    const row1 = Array.from({ length: firstRowCount },  (_, i) => i + 1);
    const row2 = Array.from({ length: secondRowCount }, (_, i) => firstRowCount + i + 1);

    let maxCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${monthKey}-${pad(d)}`;
      if (eventsByDay[k] && eventsByDay[k] > maxCount) maxCount = eventsByDay[k];
    }

    const Row = ({ days }) => (
      <View style={[styles.row, { gap }]}>
        {days.map((day) => {
          const key = `${monthKey}-${pad(day)}`;
          const count = eventsByDay[key] || 0;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.7}
              onPress={() => onDayPress?.(key)}
              style={{
                width: squareSize,
                height: squareSize,
                borderRadius: 4,
                backgroundColor: levelColor(count, maxCount),
              }}
            />
          );
        })}
      </View>
    );

    return (
      <View style={[styles.page, { width: screenW, paddingHorizontal: H_PADDING }]}>
        <Text style={styles.monthLabel}>{label}</Text>
        <Row days={row1} />
        <View style={{ height: gap }} />
        <Row days={row2} />
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={months}
      horizontal
      pagingEnabled
      removeClippedSubviews={false}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(m) => `${m.year}-${m.monthIndex}`}
      renderItem={renderMonth}
      getItemLayout={(_, i) => ({ length: screenW, offset: screenW * i, index: i })}
      decelerationRate="fast"
      snapToInterval={screenW}
      snapToAlignment="center"
      initialScrollIndex={monthsBack}
      onEndReachedThreshold={0.6}
      onEndReached={onEndReached}
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

/* ---------------- helpers (unchanged styling) ---------------- */
function buildInitialMonths(now, monthsBack, monthsAhead) {
  const arr = [];
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = monthsBack; i > 0; i--) arr.push(buildMeta(offsetMonth(start, -i)));
  for (let i = 0; i <= monthsAhead; i++) arr.push(buildMeta(offsetMonth(start, i)));
  return arr;
}
function buildRange(startDate, count) {
  const arr = [];
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  for (let i = 0; i < count; i++) arr.push(buildMeta(offsetMonth(start, i)));
  return arr;
}
const offsetMonth = (d, offset) => new Date(d.getFullYear(), d.getMonth() + offset, 1);
const buildMeta = (d) => {
  const year = d.getFullYear();
  const monthIndex = d.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
  return { year, monthIndex, daysInMonth, label };
};
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Same green (#00A12D), opacity scales with activity.
 * - 0 events: very light grey
 * - low activity: light green (alpha ~20%)
 * - high activity: solid green (alpha 100%)
 *
 * NOTE: React Native wants #AARRGGBB (alpha first).
 */
// keep your styling; just replace levelColor
// Only go full #00A12D at 3–4+ posts; keep earlier days lighter
function levelColor(count /*, maxCount not needed anymore */) {
  if (!count) return '#E5EAF0';                 // 0 posts: grey
  if (count === 1) return 'rgba(0,161,45,0.25)'; // 1 post: very light green
  if (count === 2) return 'rgba(0,161,45,0.50)'; // 2 posts: medium light
  if (count === 3) return 'rgba(0,161,45,0.75)'; // 3 posts: strong
  return '#00A12D';                               // 4+ posts: solid green
}


const styles = StyleSheet.create({
  page: { paddingVertical: 10 },
  monthLabel: { fontSize: 16, marginLeft: width(3), fontWeight: '700', marginBottom: height(1.5) },
  row: { flexDirection: 'row', marginBottom: height(0.2) },
});
