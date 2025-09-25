// HealthTimeline.js — uncompromising “Today” focus (mount/focus/resume/midnight) — de-flickered

import { getAuth } from "@react-native-firebase/auth";
import { collection, getFirestore, onSnapshot, orderBy, query } from "@react-native-firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Localization from "expo-localization";
import * as LucideIcons from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, InteractionManager, Platform, Text, TouchableOpacity, View } from "react-native";
import { height, width as rsWidth, size, width } from "react-native-responsive-sizes";

/* ---------- tokens ---------- */
const COL = {
  text: "#0A0A0A",
  sub: "#BCC1CA",
  rail: "#E9EEF5",
  card: "#FFFFFF",
  pill: "#FFB020",
  shadow: "#00000030",
  placeholder: "#F1F3F7",
  fabBg: "#111111",
  fabFg: "#FFFFFF",
};

/* ---------- locale & tz (Expo) ---------- */
const getLocaleAndTimeZone = () => {
  const locale = "en-US";
  const tz =
    Localization.getCalendars?.()[0]?.timeZone ||
    Localization.timezone ||
    undefined;
  return { locale, timeZone: tz };
};

const makeDayFormatters = (locale, timeZone) => ({
  weekdayFmt: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }),
  dateLineFmt: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", timeZone }),
  hourFmt: new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone }),
});

/* ---------- time helpers (LOCAL, no DST weirdness) ---------- */
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const pad2 = (n) => String(n).padStart(2, "0");
const todayKeyLocal = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth()+1)}-${pad2(n.getDate())}`;
};
const keyFromDate = (d) => {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${pad2(x.getMonth()+1)}-${pad2(x.getDate())}`;
};
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v?.seconds  != null) return new Date(v.seconds  * 1000);
  if (v?._seconds != null) return new Date(v._seconds * 1000);
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  if (typeof v === "string") { const d = new Date(v); return isNaN(d) ? null : d; }
  return null;
};

/* ---------- helpers ---------- */
const normalizeImageUrl = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const u = raw.trim();
  return u.startsWith("http://") || u.startsWith("https://") ? u : null;
};
const stripEmojiPrefix = (s = "") =>
  s.replace(/^\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]+)\s*/u, "").trim();

const buildFlags = (data) => {
  const parts = (data?.proms && data.proms.parts) || data?.parts || {};
  const order = ["kidney", "heart", "diabetes"];
  return order.map((key) => {
    const raw = typeof parts[key] === "string" ? parts[key] : "";
    if (!raw) return null;
    return { key, text: stripEmojiPrefix(raw) };
  }).filter(Boolean);
};

/* ---------- UI atoms ---------- */
const PlaceholderBlock = () => (
  <View
    style={{
      height: height(10),
      borderRadius: 15,
      backgroundColor: COL.placeholder,
    }}
  />
);

/* ---------- ItemCard (memo + image stable transition) ---------- */
const ItemCard = React.memo(function ItemCard({ itemDoc }) {
  const img =
    normalizeImageUrl(itemDoc.image_cloud_url) ||
    normalizeImageUrl(itemDoc.image_url) ||
    normalizeImageUrl(itemDoc.image) ||
    null;

  const title = itemDoc?.items?.[0]?.name || itemDoc?.title || "Item";
  const kcal =
    Math.round(Number(itemDoc?.items?.[0]?.calories_kcal ?? itemDoc?.calories_kcal_total ?? 0)) || null;
  const flags = buildFlags(itemDoc);

  const imgUriRef = useRef(img);
  const shouldTransition = img !== imgUriRef.current;
  useEffect(() => { imgUriRef.current = img; }, [img]);

  const THEME = {
    kidney:  { bg: "#EAF2FF", fg: "#1E67FF", icon: "Droplets", label: "Kidney" },
    heart:   { bg: "#FFECEF", fg: "#FE1B20", icon: "Heart",    label: "Heart" },
    diabetes:{ bg: "#FFF6E6", fg: "#F59E0B", icon: "Syringe",  label: "Diabetes" },
  };

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        paddingHorizontal: 0,
        paddingVertical: 10,
        ...(Platform.OS === "ios"
          ? { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25 }
          : { elevation: 2, shadowColor: "#00000030" }),
      }}>
      <View style={{ paddingTop: height(2), borderRadius: 15, paddingHorizontal: width(4) }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              height: size(50), width: size(50), borderRadius: 16, overflow: "hidden", backgroundColor: "#F2F4F7",
            }}
          >
            {img ? (
              <Image
                source={{ uri: img }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={shouldTransition ? 120 : 0}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <LucideIcons.Image size={18} color="#9AA3AD" />
              </View>
            )}
          </View>

          <View style={{ flex: 1, marginLeft: width(3) }}>
            <Text numberOfLines={2} style={{ fontSize: size(16), fontWeight: "900", color: COL.text }}>
              {title}
            </Text>
            {!!kcal && <Text style={{ marginTop: 2, color: COL.sub, fontWeight: "700" }}>+{kcal} cal</Text>}
          </View>
        </View>
      </View>

      {flags.length > 0 && (
        <FlatList
          horizontal
          data={flags}
          keyExtractor={(f, i) => `${f.key}-${i}`}
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          style={{ height: height(20) }}
          contentContainerStyle={{ alignItems: "center", paddingRight: width(5), paddingLeft: width(5) }}
          ItemSeparatorComponent={() => <View style={{ width: width(3) }} />}
          renderItem={({ item: f }) => {
            const theme = { bg: "#F3F4F6", fg: "#111", icon: "Info", label: f.key[0].toUpperCase() + f.key.slice(1), ...(THEME[f.key] || {}) };
            const Icon = LucideIcons[theme.icon] || LucideIcons.Info;
            return (
              <View style={{ width: width(60), height: height(15), paddingHorizontal: width(3), backgroundColor: theme.bg, borderRadius: 12, flexDirection: "row", alignItems: "center" }}>
                <View style={{ height: size(24), width: size(24), borderRadius: size(24)/2, backgroundColor: theme.fg + "1A", alignItems: "center", justifyContent: "center", marginRight: width(2.2) }}>
                  <Icon size={14} strokeWidth={2.4} color={theme.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.fg, fontWeight: "800", fontSize: size(12), marginBottom: 1 }}>{theme.label}</Text>
                  <Text style={{ color: COL.text, fontSize: size(13), lineHeight: size(13) * 1.45 }}>{f.text}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
});

/* ---------- Day block (00 → 23) ---------- */
const HOURS_START = 0;
const HOURS_END   = 23;

const DayBlock = React.memo(function DayBlock({ date, items, weekday, dateLine, hourLabels, onMeasure }) {
  const byHour = useMemo(() => {
    const map = new Map();
    for (let h = HOURS_START; h <= HOURS_END; h++) map.set(h, []);
    for (const it of items) {
      const d = toDate(it._createdAny);
      if (!d) continue;
      const h = d.getHours();
      if (h < HOURS_START || h > HOURS_END) continue;
      map.get(h).push(it);
    }
    for (const [, arr] of map) arr.sort((a, b) => +toDate(a._createdAny) - +toDate(b._createdAny));
    return map;
  }, [items]);

  return (
    <View onLayout={(e) => onMeasure?.(e.nativeEvent.layout.height)} style={{ paddingBottom: height(4) }}>
      <View style={{ paddingHorizontal: rsWidth(5), marginTop: height(5) }}>
        <Text style={{ fontSize: size(28), fontWeight: "900", color: COL.text }}>{weekday}</Text>
        <Text style={{ marginTop: 6, color: COL.sub, fontWeight: "800", marginBottom: height(2) }}>{dateLine}</Text>
      </View>

      {Array.from({ length: HOURS_END - HOURS_START + 1 }).map((_, idx) => {
        const hour = HOURS_START + idx;
        const label = hourLabels[idx];

        const bucket = byHour.get(hour) || [];
        return (
          <View key={hour} style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: rsWidth(5), marginBottom: height(2) }}>
            <View style={{ width: rsWidth(17) }}>
              <Text style={{ color: COL.sub, fontSize: size(13), fontWeight: "900" }}>{label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {bucket.length === 0 ? <PlaceholderBlock /> : bucket.map((doc, i) => (
                <View key={doc.id || i} style={{ zIndex: 100, marginBottom: i < bucket.length - 1 ? height(1.4) : 0 }}>
                  <ItemCard itemDoc={doc} />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}, (prev, next) =>
  prev.items === next.items &&
  prev.date.getTime() === next.date.getTime() &&
  prev.weekday === next.weekday &&
  prev.dateLine === next.dateLine &&
  prev.hourLabels === next.hourLabels
);

/* ---------- Main timeline (bulletproof “Today” jump) ---------- */
export default function HealthChecksCardFlatList({ userId, showHeader = true }) {
  const uid = userId || getAuth().currentUser?.uid;
  const db = getFirestore();

  const [rows, setRows] = useState([]);
  const [bootReady, setBootReady] = useState(false);
  const [dayHeight, setDayHeight] = useState(null);
  const listRef = useRef(null);

  // track user gesture + auto-jump settling
  const userScrollingRef = useRef(false);

  // Firestore stream (with dedupe + boot gate)
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "RecentlyEaten"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data() || {};
          const t = data.created_at?.toDate?.() || null;
          return { id: d.id, ...data, _createdAny: t };
        });
        setRows((prev) => {
          const sameLen = prev.length === docs.length;
          const same = sameLen && prev.every((p, i) => p.id === docs[i].id && +p._createdAny === +docs[i]._createdAny);
          if (!bootReady) setBootReady(true);
          return same ? prev : docs;
        });
      },
      (e) => console.warn("[HealthTimeline] onSnapshot error:", e?.message || e)
    );
    return () => unsub();
  }, [uid, db, bootReady]);

  // locale + formatters
  const { locale, timeZone } = useMemo(getLocaleAndTimeZone, []);
  const { weekdayFmt, dateLineFmt, hourFmt } = useMemo(
    () => makeDayFormatters(locale, timeZone),
    [locale, timeZone]
  );

  // Precompute hour labels once
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let h = HOURS_START; h <= HOURS_END; h++) {
      const d = new Date(2000, 0, 1, h, 0, 0);
      labels.push(hourFmt.format(d).toUpperCase());
    }
    return labels;
  }, [hourFmt]);

  // Days for this year → 2099 (chronological) WITH precomputed labels
  const [daysMeta] = useState(() => {
    const now = new Date();
    const start = startOfDay(new Date(now.getFullYear(), 0, 1));
    const end   = startOfDay(new Date(2099, 11, 31));
    const arr = [];
    for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const date = new Date(d);
      const key = keyFromDate(date);
      arr.push({ date, key, weekday: "", dateLine: "" });
    }
    return arr;
  });

  // Fill weekday/dateLine once (or when tz/locale changes) without changing array identity
  useEffect(() => {
    for (const d of daysMeta) {
      d.weekday  = weekdayFmt.format(d.date).toUpperCase();
      d.dateLine = dateLineFmt.format(d.date).toUpperCase();
    }
    // no setState needed; props read from objects will reflect the new strings
  }, [daysMeta, weekdayFmt, dateLineFmt]);

  const todayKey = todayKeyLocal();
  const todayIndex = useMemo(() => {
    const idx = daysMeta.findIndex((d) => d.key === todayKey);
    return Math.max(0, idx);
  }, [daysMeta, todayKey]);

  // Group items by day (stable references per day key)
  const byDay = useMemo(() => {
    const next = new Map();
    for (const r of rows) {
      const d = r._createdAny ? startOfDay(r._createdAny) : null;
      if (!d) continue;
      const k = keyFromDate(d);
      if (!next.has(k)) next.set(k, []);
      next.get(k).push(r);
    }
    for (const [k, arr] of next) {
      arr.sort((a,b) => +a._createdAny - +b._createdAny);
      next.set(k, arr);
    }
    return next;
  }, [rows]);

  // optional: if a sticky/overlay header covers the very top, put its height here
  const VIEW_OFFSET = height(8);

  // Jump helper (single source of truth)
  const jumpToToday = useCallback((animated, { force = false } = {}) => {
    if (!listRef.current) return;
    if (!force && userScrollingRef.current) return;

    try {
      listRef.current.scrollToIndex({
        index: todayIndex,
        animated,
        viewPosition: 0,
        viewOffset: VIEW_OFFSET,
      });
    } catch {
      const approxLen = dayHeight ?? height(60);
      const approx = approxLen * todayIndex;
      listRef.current?.scrollToOffset({ offset: approx, animated: false });
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({
            index: todayIndex,
            animated: false,
            viewPosition: 0,
            viewOffset: VIEW_OFFSET,
          });
        } catch {}
      });
    }
  }, [todayIndex, dayHeight]);

  // One-time jump after first data + layout settle
  useEffect(() => {
    if (!bootReady) return;
    let canceled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!canceled) jumpToToday(false, { force: true });
    });
    return () => { canceled = true; task.cancel?.(); };
  }, [bootReady, jumpToToday]);

  // Debounced resnap on focus/foreground (no spam)
  const lastSnapRef = useRef(0);
  const debouncedResnap = useCallback(() => {
    if (userScrollingRef.current) return;
    const now = Date.now();
    if (now - lastSnapRef.current < 500) return;
    lastSnapRef.current = now;
    jumpToToday(false);
  }, [jumpToToday]);

  useFocusEffect(useCallback(() => { if (bootReady) debouncedResnap(); }, [bootReady, debouncedResnap]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active" && bootReady) debouncedResnap(); });
    return () => sub.remove();
  }, [bootReady, debouncedResnap]);

  // getItemLayout once we have a measured height to avoid scrollToIndexFailed churn
  const itemLen = dayHeight ?? height(60);
  const getItemLayout = dayHeight != null ? (data, index) => ({
    length: itemLen,
    offset: itemLen * index,
    index,
  }) : undefined;

  // render gate to avoid pre-data flicker
  if (!bootReady) {
    return (
      <View style={{ flex: 1, padding: rsWidth(5), justifyContent: "center" }}>
        <PlaceholderBlock />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={daysMeta}
        keyExtractor={(d) => d.key}
        getItemLayout={getItemLayout}
        initialScrollIndex={dayHeight != null ? todayIndex : undefined}
        // if we don't yet have dayHeight, we'll still jump via InteractionManager above
        ListHeaderComponent={
          showHeader ? (
            <Text style={{ marginTop: height(6), marginLeft: rsWidth(5), fontSize: size(20), fontWeight: "900", color: COL.text }}>
              Health Checks
            </Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: height(12) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: day }) => {
          const items = byDay.get(day.key) || [];
          return (
            <View
              onLayout={(e) => {
                if (dayHeight == null && e.nativeEvent.layout.height > 0) {
                  setDayHeight(e.nativeEvent.layout.height);
                }
              }}
            >
              <DayBlock
                date={day.date}
                items={items}
                weekday={day.weekday}
                dateLine={day.dateLine}
                hourLabels={hourLabels}
              />
            </View>
          );
        }}
        // tuned batching to smooth first paint
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        removeClippedSubviews
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { userScrollingRef.current = true; }}
        onMomentumScrollBegin={() => { userScrollingRef.current = true; }}
        onMomentumScrollEnd={() => { userScrollingRef.current = false; }}
        onScrollEndDrag={() => { userScrollingRef.current = false; }}
      />

      {/* Floating "Today" button */}
      <TouchableOpacity
        onPress={() => jumpToToday(true, { force: true })}
        activeOpacity={0.9}
        style={{
          position: "absolute",
          right: rsWidth(6),
          bottom: height(7),
          height: size(45),
          width: size(45),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COL.fabBg,
          borderRadius: 13,
          ...Platform.select({
            ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10 },
            android: { elevation: 6, shadowColor: "#000" },
          }),
        }}
      >
        <LucideIcons.ClockArrowDown size={18} color={"#fff"} />
      </TouchableOpacity>
    </View>
  );
}
