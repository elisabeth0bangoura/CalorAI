// MyWeightAndStrikesComponent.js
import { Flame } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, size } from "react-native-responsive-sizes";

import { useSheets } from "@/app/Context/SheetsContext";
import { useStreak } from "@/app/Context/StreakContext";

import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";





















// WeekDots.js
import { Check } from 'lucide-react-native';

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

export  function WeekDots({
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





/* ---------------- Time helpers ---------------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const clamp0 = (x) => (x < 0 ? 0 : x);

/* Firestore Timestamp | Date | number | string -> Date */
const toDateSafe = (v) =>
  v?.toDate?.() ??
  (v instanceof Date
    ? v
    : typeof v === "number"
    ? new Date(v)
    : typeof v === "string"
    ? new Date(v)
    : v?.seconds
    ? new Date(v.seconds * 1000)
    : null);

/* ======================================================================== */
/*                         LIGHT PROGRESS BAR (PAUSED)                      */
/* ======================================================================== */
const ProgressBar = ({
  height: h = 8,
  progress = 0, // 0..100
  animated = true,
  progressDuration = 700,
  paused = false,
  backgroundColor = "#5BC951",
  trackColor = "#E9EEF3",
}) => {
  const w = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    if (paused || !animated) {
      w.stopAnimation && w.stopAnimation();
      w.setValue(progress);
      return;
    }
    Animated.timing(w, {
      toValue: Math.max(0, Math.min(progress, 100)),
      duration: progressDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width changes can't use native driver
      isInteraction: false,
    }).start();
  }, [progress, paused, animated, progressDuration, w]);

  return (
    <View style={{ width: "100%" }}>
      <View
        style={{
          width: "100%",
          height: h,
          overflow: "hidden",
          borderRadius: h / 2,
          backgroundColor: trackColor,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            borderRadius: h / 2,
            backgroundColor,
            width: w.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
};

/* Memoized WeekDots so it only rerenders when dates change */
const MemoWeekDots = React.memo(WeekDots);

/* ======================================================================== */
/*                  MAIN: MyWeightAndStrikesComponent (PAUSED-AWARE)        */
/* ======================================================================== */
export default function MyWeightAndStrikesComponent({ paused = false }) {
  // Streak context — provides 0..7, ratio [0..1], and week dates
  const { capped7: STREAK, ratio, week } = useStreak();
  const { present } = useSheets();

  // Animate only *opacities* (native driver OK). No animated colors.
  const anim = useRef(new Animated.Value(ratio || 0)).current;

  // Weight + weekly check label
  const [kg, setKg] = useState(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [label, setLabel] = useState("");

  // Safety: avoid setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Opacity crossfade thresholds (native-driver friendly) ---
  const WHITE_START = 5 / 7;
  const toBlack = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, WHITE_START - 0.002, WHITE_START],
        outputRange: [1, 1, 0],
        extrapolate: "clamp",
      }),
    [anim]
  );
  const toWhite = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, WHITE_START - 0.002, WHITE_START],
        outputRange: [0, 0, 1],
        extrapolate: "clamp",
      }),
    [anim]
  );

  /* ---------------- Animate the ratio (PAUSED-aware) ---------------- */
  useEffect(() => {
    anim.stopAnimation && anim.stopAnimation();
    if (paused) {
      anim.setValue(ratio || 0);
      return;
    }
    Animated.timing(anim, {
      toValue: ratio || 0,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true, // we only drive opacities
      isInteraction: false,
    }).start();
  }, [ratio, paused, anim]);

  /* ---------------- Single Firestore listener (PAUSED-aware) ---------------- */
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    if (paused) return; // no background listeners

    const ref = doc(getFirestore(), "users", uid);

    const lastKgRef = { current: null };
    const lastLabelRef = { current: "" };

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};

        // weight (only set if changed)
        const nextKg = Number.isFinite(Number(data?.kg)) ? Number(data.kg) : null;
        if (nextKg !== lastKgRef.current) {
          lastKgRef.current = nextKg;
          if (mountedRef.current) setKg(nextKg);
        }

        // weekly progress computation (cheap)
        const base = toDateSafe(data?.updatedAt) || new Date();
        const today0 = sod(new Date());
        const base0 = sod(base);
        const daysSince = clamp0(Math.floor((today0.getTime() - base0.getTime()) / MS_DAY));
        const cycle = daysSince % 7; // 0..6
        const left = (6 - cycle + 7) % 7; // 6..0
        setDaysLeft(left);

        const lbl = left === 0 ? "today" : `${left}d`;
        if (lbl !== lastLabelRef.current) {
          lastLabelRef.current = lbl;
          if (mountedRef.current) setLabel(lbl);
        }
      },
      () => {}
    );

    return () => unsub();
  }, [paused]);

  const openWeightSheet = useCallback(() => {
    present("s7");
  }, [present]);

  // Stable, memoized dates prop for WeekDots
  const doneDates = useMemo(() => week?.doneDates ?? [], [week?.doneDates]);

  return (
    <View
      style={{
        height: height(28),
        width: "90%",
        flexDirection: "row",
        alignSelf: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left card — Weight */}
      <TouchableOpacity
        onPress={openWeightSheet}
        activeOpacity={0.85}
        style={{
          height: "90%",
          width: "48%",
          paddingBottom: height(5),
          alignSelf: "center",
          borderRadius: 19,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
              }
            : { elevation: 6, shadowColor: "#00000050" }),
        }}
      >
        <Text
          style={{
            marginTop: height(2),
            fontSize: size(16),
            fontWeight: "800",
            color: "#BCC1CA",
          }}
        >
          My Weight
        </Text>

        <Text
          style={{
            fontSize: size(35),
            fontWeight: "800",
            color: "#000",
            marginTop: height(1),
          }}
        >
          {kg != null && Number.isFinite(kg) ? kg : 0} kg
        </Text>

        <View style={{ marginTop: height(2), width: "80%", alignSelf: "center" }}>
          <ProgressBar progress={95} height={8} backgroundColor="#5BC951" paused={paused} />
        </View>

        <Text
          style={{
            marginTop: height(2),
            fontSize: size(13),
            textAlign: "center",
            width: "90%",
            position: "absolute",
            bottom: height(5),
            color: "#000",
          }}
        >
          progress check - {label || "in 0d"}
        </Text>
      </TouchableOpacity>

      {/* Right card — Streak */}
      <View
        style={{
          height: "90%",
          width: "48%",
          paddingBottom: height(5),
          alignSelf: "center",
          borderRadius: 19,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shouldRasterizeIOS: true,
              }
            : {
                elevation: 6,
                shadowColor: "#00000050",
                renderToHardwareTextureAndroid: true,
              }),
        }}
      >
        {/* ICON crossfade (native driver) */}
        <View style={{ position: "relative", height: 65 }}>
          <Animated.View
            style={{
              alignItems: "center",
              position: "absolute",
              opacity: toBlack,
              left: 0,
              right: 0,
            }}
          >
            <Flame size={65} color="#000" />
          </Animated.View>
          <Animated.View
            style={{
              alignItems: "center",
              position: "absolute",
              opacity: toWhite,
              left: 0,
              right: 0,
            }}
          >
            <Flame size={65} color="#fff" />
          </Animated.View>
        </View>

        {/* NUMBER crossfade */}
        <View style={{ position: "relative", height: size(34), marginTop: height(-2.8) }}>
          <Animated.Text
            style={{
              position: "absolute",
              fontSize: size(30),
              fontWeight: "800",
              alignSelf: "center",
              paddingVertical: 5,
              color: "#000",
              opacity: toBlack,
              backgroundColor: "#fff",
            }}
          >
            {STREAK}
          </Animated.Text>
          <Animated.Text
            style={{
              position: "absolute",
              fontSize: size(30),
              fontWeight: "800",
              alignSelf: "center",
              paddingVertical: 5,
              color: "#fff",
              opacity: toWhite,
              backgroundColor: "#5BC951",
              borderRadius: 6,
              paddingHorizontal: 5,
            }}
          >
            {STREAK}
          </Animated.Text>
        </View>

        {/* LABEL crossfade */}
        <View style={{ position: "relative", height: size(18), marginTop: 2 }}>
          <Animated.Text
            style={{
              position: "absolute",
              fontWeight: "500",
              fontSize: size(13),
              alignSelf: "center",
              color: "#000",
              opacity: toBlack,
            }}
          >
            Stay-On-Track
          </Animated.Text>
          <Animated.Text
            style={{
              position: "absolute",
              fontWeight: "500",
              fontSize: size(13),
              alignSelf: "center",
              color: "#fff",
              opacity: toWhite,
            }}
          >
            Stay-On-Track
          </Animated.Text>
        </View>

        <MemoWeekDots doneDates={doneDates} />
      </View>
    </View>
  );
}
