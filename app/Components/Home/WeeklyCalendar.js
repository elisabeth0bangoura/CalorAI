// InfiniteWeekCalendar.js
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  Timestamp,
  where,
} from "@react-native-firebase/firestore";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

/* ===== Helpers ===== */
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
const endOfDay   = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
const addDays    = (d,n)=> { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const addWeeks   = (d,n)=> addDays(d, n*7);
const startOfWeekSunday = d => addDays(startOfDay(d), -d.getDay());
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const pctOfDayLeft = (d) => {
  const start = startOfDay(d).getTime();
  const end   = endOfDay(d).getTime();
  const now   = Date.now();
  if (now <= start) return 1;
  if (now >= end)   return 0;
  return (end - now) / (end - start);
};
const pctOfDayElapsed = (d) => 1 - pctOfDayLeft(d);

const toDateSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate();
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") return new Date(raw);
  return null;
};

export default function InfiniteWeekCalendar({
  userId,
  selectedDate = new Date(),
  onChangeDate,
}) {
  const db = getFirestore();

  /* ===== Geometry ===== */
  const SCREEN_WIDTH  = Dimensions.get("window").width;
  const ITEM_WIDTH    = SCREEN_WIDTH;
  const OUTER_PADDING = 16;

  const RING   = 42;   // pill diameter
  const CELL_H = 72;
  const GAP    = 25;

  const EDGE       = Math.max(OUTER_PADDING, Math.ceil(RING/2)+8);
  const maxStep    = (ITEM_WIDTH - EDGE*2) / 6;
  const desired    = RING + GAP;
  const step       = Math.min(maxStep, desired);
  const contentW   = RING + step*6;
  const firstCenter= (ITEM_WIDTH - contentW)/2 + RING/2;
  const hitW       = Math.max(RING + 24, step);

  const WINDOW = 10000, MIDDLE = WINDOW;
  const baseSunday = useMemo(() => startOfWeekSunday(new Date()), []);

  const [hasCalPerm, setHasCalPerm] = useState(null);
  const [eventsCache, setEventsCache] = useState({});
  const [entryCache,  setEntryCache]  = useState({});
  const [entryLoaded, setEntryLoaded] = useState({});

  // tick updates the today ring as time passes
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const initialIndex = useMemo(() => {
    const diffMs = startOfWeekSunday(selectedDate).getTime() - baseSunday.getTime();
    return MIDDLE + Math.round(diffMs / (7*24*3600*1000));
  }, [selectedDate, baseSunday]);

  /* ===== Permissions ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (mounted) setHasCalPerm(status === "granted");
    })();
    return () => { mounted = false; };
  }, []);

  const weekStartFromIndex = (index) => addWeeks(baseSunday, index - MIDDLE);
  const weekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /* ===== Prefetch ===== */
  const prefetchWeek = useCallback(async (weekStart) => {
    const wkKey = ymd(startOfWeekSunday(weekStart));
    const days  = weekDays(weekStart);

    if (hasCalPerm && !eventsCache[wkKey]) {
      const ids = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).map(c => c.id);
      const events = await Calendar.getEventsAsync(ids, weekStart, endOfDay(addDays(weekStart,6)));
      const map = {};
      days.forEach(d => (map[ymd(d)] = 0));
      events.forEach(e => {
        const k = ymd(new Date(e.startDate));
        if (map[k] !== undefined) map[k] += 1;
      });
      setEventsCache(prev => ({ ...prev, [wkKey]: map }));
    }

    if (!entryLoaded[wkKey]) {
      const startTs = Timestamp.fromDate(weekStart);
      const endTs   = Timestamp.fromDate(endOfDay(addDays(weekStart,6)));
      const uid     = userId ?? getAuth().currentUser?.uid;
      const colRef  = collection(db, `users/${uid}/RecentlyEaten`);

      const qSnake = query(colRef, where("created_at", ">=", startTs), where("created_at", "<=", endTs));
      const qCamel = query(colRef, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));

      const [snapSnake, snapCamel] = await Promise.allSettled([getDocs(qSnake), getDocs(qCamel)]);

      const map = {};
      days.forEach(d => (map[ymd(d)] = false));

      const mark = (snap) => {
        if (!snap?.docs) return;
        snap.docs.forEach(doc => {
          const data = doc.data();
          const raw  = data?.created_at !== undefined ? data.created_at : data?.createdAt;
          const dt   = toDateSafe(raw);
          if (!dt) return;
          const key = ymd(dt);
          if (map[key] !== undefined) map[key] = true;
        });
      };

      mark(snapSnake.status === "fulfilled" ? snapSnake.value : null);
      mark(snapCamel.status === "fulfilled" ? snapCamel.value : null);

      setEntryCache(prev => ({ ...prev, [wkKey]: map }));
      setEntryLoaded(prev => ({ ...prev, [wkKey]: true }));
    }
  }, [db, userId, hasCalPerm, eventsCache, entryLoaded]);

  useEffect(() => {
    [initialIndex - 1, initialIndex, initialIndex + 1].forEach(i =>
      prefetchWeek(weekStartFromIndex(i))
    );
  }, [initialIndex, prefetchWeek]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems.forEach(v => {
      const idx = v.index ?? 0;
      [idx - 1, idx, idx + 1].forEach(i => prefetchWeek(weekStartFromIndex(i)));
    });
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  /* ===== Render ===== */
  const renderWeek = ({ item: index }) => {
    const weekStart   = weekStartFromIndex(index);
    const wkKey       = ymd(startOfWeekSunday(weekStart));
    const days        = weekDays(weekStart);
    const todayKey    = ymd(new Date());
    const entriesByDay= entryCache[wkKey]  || {};

    return (
      <View style={{ width: ITEM_WIDTH, paddingVertical: 8, backgroundColor: "#fff" }}>
        <View style={{ height: CELL_H, position: "relative" }}>
          {days.map((d, i) => {
            const k        = ymd(d);
            const isToday  = k === todayKey;
            const hasEntry = entriesByDay[k] === true;

            const BLACK = "#000";
            const GREEN = "#39C463";

            // pill border: remove it for TODAY so the grey track is visible
            let borderColor = GREEN, borderStyle = "solid", borderWidth = 1.5;
            if (hasEntry) {
              borderColor = GREEN; borderStyle = "solid"; borderWidth = 1.5;
            } else if (isToday) {
              borderColor = "transparent"; borderStyle = "solid"; borderWidth = 0; // <-- key change
            } else {
              borderColor = BLACK; borderStyle = "dashed"; borderWidth = 1.5;
            }

            const centerX = firstCenter + i * step;
            const left    = Math.round(centerX - hitW / 2);

            return (
              <Pressable
                key={k}
                onPress={() => { Haptics.selectionAsync(); onChangeDate?.(d); }}
                style={{
                  position: "absolute",
                  left,
                  width: hitW,
                  height: CELL_H,
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <View
                  style={{
                    width: RING, height: RING, borderRadius: RING/2,
                    justifyContent: "center", alignItems: "center",
                    backgroundColor: "#fff",
                    borderWidth,
                    borderColor,
                    borderStyle,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: "#111" }}>
                    {DAY[d.getDay()]}
                  </Text>

                  {/* TODAY ring */}
                  {isToday && (
                    <Svg
                      pointerEvents="none"
                      width={RING}
                      height={RING}
                      style={{ position: "absolute", top: 0, left: 0 }}
                    >
                      {(() => {
                        const SIZE      = RING;
                        const R         = SIZE / 2;
                        const STROKE_W  = 3; // thicker so grey is obvious
                        const rDraw     = R - STROKE_W / 2 - 0.5;
                        const CIRC      = 2 * Math.PI * rDraw;

                        const elapsed   = Math.max(0, Math.min(0.999, pctOfDayElapsed(new Date())));
                        const dashOff   = CIRC * (1 - elapsed);

                        return (
                          <>
                            {/* grey full track = time left */}
                            <Circle
                              cx={R}
                              cy={R}
                              r={rDraw}
                              stroke="#E5E7EB"
                              strokeWidth={STROKE_W}
                              fill="none"
                            />
                            {/* black arc = elapsed */}
                            <Circle
                              cx={R}
                              cy={R}
                              r={rDraw}
                              stroke="#000"
                              strokeWidth={STROKE_W}
                              fill="none"
                              strokeDasharray={`${CIRC} ${CIRC}`}
                              strokeDashoffset={dashOff}
                              strokeLinecap="butt"
                              transform={`rotate(-90 ${R} ${R})`}
                            />
                          </>
                        );
                      })()}
                    </Svg>
                  )}
                </View>

                <Text style={{ marginTop: 6, fontWeight: "600", color: "#111" }}>
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}

          {/* edge masks */}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: OUTER_PADDING, backgroundColor: "#fff" }}/>
          <View pointerEvents="none" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: OUTER_PADDING, backgroundColor: "#fff" }}/>
        </View>
      </View>
    );
  };

  const data = useMemo(() => Array.from({ length: WINDOW*2+1 }, (_, i) => i), []);

  return (
    <FlatList
      horizontal
      snapToInterval={ITEM_WIDTH}
      snapToAlignment="start"
      decelerationRate="fast"
      bounces={false}
      overScrollMode="never"
      data={data}
      keyExtractor={(i) => String(i)}
      renderItem={renderWeek}
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH*index, index })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      windowSize={5}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      removeClippedSubviews={false}
    />
  );
}
