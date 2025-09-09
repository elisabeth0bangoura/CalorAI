// MonthScroller.js (JS)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Text, TouchableOpacity, View } from 'react-native';






export default function MonthScroller({monthsBack = 12, monthsAhead = 12, itemWidth = 85, gap = 12, onChange, locale = undefined}) {


  const screenW = Dimensions.get('window').width;
  const snap = itemWidth + gap;
  const sidePad = (screenW - itemWidth) / 2; // so the centered item sits in the middle

  const listRef = useRef(null);
  const [index, setIndex] = useState(monthsBack); // start on current month

  const data = useMemo(() => buildMonths({ monthsBack, monthsAhead, locale }), [
    monthsBack,
    monthsAhead,
    locale,
  ]);

  // jump to "now" (index = monthsBack)
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToIndex({ index: monthsBack, animated: false }), 0);
  }, [monthsBack]);

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / snap);
    if (i !== index) {
      setIndex(i);
      onChange?.(data[i]);
    }
  };

  const renderItem = ({ item, index: i }) => {
    const selected = i === index;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => listRef.current?.scrollToIndex({ index: i, animated: true })}
        style={{
          width: itemWidth,
          marginRight: gap,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 14,
            transform: [{ scale: selected ? 1 : 0.96 }],
          }}
        >
          <Text
            style={{
              color: selected ? '#000' : '#A6B0B8',
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {item.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(m) => m.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: sidePad }}
      renderItem={renderItem}
      getItemLayout={(_, i) => ({ length: snap, offset: snap * i, index: i })}
      snapToInterval={snap}
      decelerationRate="fast"
      onMomentumScrollEnd={onMomentumEnd}
      initialScrollIndex={monthsBack}
    />
  );
}

/* helpers */
function buildMonths({ monthsBack, monthsAhead, locale }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const arr = [];
  for (let i = monthsBack; i > 0; i--) arr.push(meta(addMonths(start, -i), locale));
  arr.push(meta(start, locale));
  for (let i = 1; i <= monthsAhead; i++) arr.push(meta(addMonths(start, i), locale));
  return arr;
}

function meta(d, locale) {
  const label = d.toLocaleString(locale, { month: 'short', year: '2-digit' }); // e.g., "Feb 25"
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { key, label, date: d, year: d.getFullYear(), monthIndex: d.getMonth() };
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
