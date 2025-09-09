// ./Cameras/ScanFood_PageAfterScan.js
import * as Haptics from "expo-haptics";
import * as LucideIcons from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { height, size, width } from "react-native-responsive-sizes";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

import LottieView from "lottie-react-native";
import { CircularProgressBase } from "react-native-circular-progress-indicator";

/* ---------- Collapsing header sizes ---------- */
const HEADER_MAX_HEIGHT = height(45);
const HEADER_MIN_HEIGHT = height(2);
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

/* ---------- Helpers ---------- */
const sText = (v, d = "") => (typeof v === "string" ? v : d);
const sNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

/* ---------- Mini ring ---------- */
const MiniRing = React.memo(function MiniRing({
  value = 0,
  color = "#000",
  radius = 40,
  duration = 800,
  maxValue = 200,
  active = true,
  strokeWidth = 12,
  bumpKey,
}) {
  const safeVal = Number.isFinite(+value) ? +value : 0;
  const safeMax = Math.max(1, Number(maxValue) || 1);
  const DIAMETER = radius * 2;
  const ringColor = active ? color : "#E6ECF2";
  const dur = active ? duration : 0;

  return (
    <View style={{ alignSelf: "center", width: DIAMETER, height: DIAMETER, position: "relative" }}>
      <CircularProgressBase
        key={bumpKey}
        value={safeVal}
        maxValue={safeMax}
        radius={radius}
        duration={dur}
        showProgressValue={false}
        activeStrokeColor={ringColor}
        activeStrokeWidth={strokeWidth + 2}
        inActiveStrokeColor="#E6ECF2"
        inActiveStrokeOpacity={0.35}
        inActiveStrokeWidth={strokeWidth}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={styles.ringNumber}>{String(Math.round(safeVal))}</Text>
      </View>
    </View>
  );
});

/* ---------- Shallow gate for snapshot (now includes flags) ---------- */
function changedSubset(a, b) {
  if (!a || !b) return true;
  const keys = [
    "title",
    "brand",
    "image_cloud_url",
    "calories_kcal_total",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "health_score",
  ];
  for (const k of keys) if (a[k] !== b[k]) return true;

  // alternatives length
  const alA = a?.alternatives?.other_brands?.length ?? 0;
  const alB = b?.alternatives?.other_brands?.length ?? 0;
  if (alA !== alB) return true;

  // ingredients length
  const ingA = a?.ingredients_full?.length ?? 0;
  const ingB = b?.ingredients_full?.length ?? 0;
  if (ingA !== ingB) return true;

  // flags text / parts
  const aText = a?.profile_used?.text || a?.proms?.text || "";
  const bText = b?.profile_used?.text || b?.proms?.text || "";
  if (aText !== bText) return true;

  const ap = a?.proms?.parts || a?.parts || {};
  const bp = b?.proms?.parts || b?.parts || {};
  for (const key of ["kidney", "heart", "diabetes"]) {
    if ((ap?.[key] || "") !== (bp?.[key] || "")) return true;
  }

  return false;
}

/* =================== PAGE =================== */
function ScanPageHome() {
  const { currentItemId, currentItem, setCurrentItem } = useCurrentScannedItemId();
  const { present, isS8Open, isS9Open } = useSheets();

  const { width: screenW, height: screenH } = useWindowDimensions();

  const [ringBump, setRingBump] = useState(0);
  const [page, setPage] = useState(0);
  const pagerX = useRef(new Animated.Value(0)).current;

  // forces resubscribe + refetch when edit closes
  const [refreshVer, setRefreshVer] = useState(0);
  // forces FlatList remount (so rows slide back in)
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (isS8Open) setRingBump((b) => b + 1);
  }, [isS8Open]);

  const p = currentItem?.protein_g ?? 0;
  const c = currentItem?.carbs_g ?? 0;
  const f = currentItem?.fat_g ?? 0;
  const prevVals = useRef({ p, c, f });
  useEffect(() => {
    const changed = p !== prevVals.current.p || c !== prevVals.current.c || f !== prevVals.current.f;
    if (changed && isS8Open) setRingBump((b) => b + 1);
    prevVals.current = { p, c, f };
  }, [p, c, f, isS8Open]);

  /* Collapsing header */
  const scrollY = useRef(new Animated.Value(0)).current;
  const onVerticalScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: "clamp",
  });
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 100],
    extrapolate: "clamp",
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0.9],
    extrapolate: "clamp",
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 0, -8],
    extrapolate: "clamp",
  });

  // NEW: top bar (gray "Scanned ...") is HIDDEN at top and slides in after a small scroll
  const topBarTranslateY = scrollY.interpolate({
    inputRange: [0, 24, 48],
    outputRange: [-height(6), -height(6), 0], // fully hidden at top, slides in by ~48px
    extrapolate: "clamp",
  });
  const topBarOpacity = scrollY.interpolate({
    inputRange: [24, 48],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const lastSnapRef = useRef(null);

  // helper to map Firestore doc into our local shape
  const shapeFromDoc = (d) => {
    const title = sText(d.title, "Scanned meal");
    const brand = sText(d.brand, "");
    const caloriesTotal = Number.isFinite(sNum(d.calories_kcal_total, NaN)) ? sNum(d.calories_kcal_total, NaN) : null;

    // Ingredients -> cards (rounded)
    const ingredients = Array.isArray(d.ingredients_full) ? d.ingredients_full : [];
    const ingredientCards = ingredients.map((ing) => {
      const kcal = Math.round(Number.isFinite(sNum(ing?.estimated_kcal, NaN)) ? sNum(ing?.estimated_kcal, 0) : 0);
      return {
        label: sText(ing?.name, ""),
        amt: `+${kcal} cal`,
        icon: "Utensils",
        IconCOlor: "#1E67FF",
        iconColorBg: "#EEF3FF",
        color: "#FFFFFF",
      };
    });

    const ingredients_kcal_sum = ingredients.reduce(
      (sum, r) => sum + (Number.isFinite(+r?.estimated_kcal) ? +r.estimated_kcal : 0),
      0
    );
    const remainingRaw =
      Number.isFinite(caloriesTotal) && Number.isFinite(ingredients_kcal_sum)
        ? caloriesTotal - ingredients_kcal_sum
        : null;
    const ingredients_kcal_remaining = remainingRaw == null ? null : Math.round(remainingRaw);
    if (Number.isFinite(ingredients_kcal_remaining) && Math.abs(ingredients_kcal_remaining) > 1) {
      ingredientCards.push({
        label: "Other / rounding",
        amt: `${ingredients_kcal_remaining >= 0 ? "+" : ""}${ingredients_kcal_remaining} cal`,
        icon: "Utensils",
        IconCOlor: "#1E67FF",
        iconColorBg: "#EEF3FF",
        color: "#FFFFFF",
      });
    }

    // Alternatives -> cards
    let alternativesCards = [];
    if (Array.isArray(d.alternatives_flat)) {
      alternativesCards = d.alternatives_flat.map((p) => ({
        label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")].filter(Boolean).join(" "),
        amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN)) ? `${sNum(p?.calories_per_package_kcal, 0)}cal` : "—",
        moreOrLess: p?.bucket === "lower" ? "less" : p?.bucket === "higher" ? "more" : "similar",
      }));
    } else if (d.alternatives && (Array.isArray(d.alternatives.same_brand) || Array.isArray(d.alternatives.other_brands))) {
      const mix = [
        ...(Array.isArray(d.alternatives.same_brand) ? d.alternatives.same_brand : []),
        ...(Array.isArray(d.alternatives.other_brands) ? d.alternatives.other_brands : []),
      ];
      alternativesCards = mix.map((p) => ({
        label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")].filter(Boolean).join(" "),
        amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN)) ? `${sNum(p?.calories_per_package_kcal, 0)}cal` : "—",
        moreOrLess: p?.bucket === "lower" ? "less" : p?.bucket === "higher" ? "more" : "similar",
      }));
    }

    const items = Array.isArray(d.items) ? d.items : [];
    const itemsSafe = items.map((it) => ({
      name: sText(it?.name, "Item"),
      subtitle: sText(it?.subtitle, ""),
      calories_kcal: sNum(it?.calories_kcal, 0),
      icon: "Utensils",
    }));

    // --------- Personalized flags ----------
    const parts = (d?.proms && d.proms.parts) || d?.parts || {};
    const flagsParts = [];
    if (typeof parts.kidney === "string" && parts.kidney) {
      flagsParts.push({ key: "kidney", icon: "Droplets", color: "#0EA5E9", text: parts.kidney });
    }
    if (typeof parts.heart === "string" && parts.heart) {
      flagsParts.push({ key: "heart", icon: "Heart", color: "#EF4444", text: parts.heart });
    }
    if (typeof parts.diabetes === "string" && parts.diabetes) {
      flagsParts.push({ key: "diabetes", icon: "Syringe", color: "#7C3AED", text: parts.diabetes });
    }
    const flagsText = sText(d?.profile_used?.text || d?.proms?.text || "", "");

    return {
      ...d,
      title,
      brand,
      calories_kcal_total: caloriesTotal,
      ingredientCards,
      alternativesCards,
      items: itemsSafe,
      ingredients_kcal_sum,
      ingredients_kcal_remaining,
      flagsParts,
      flagsText,
    };
  };

  /* Firestore live subscription (re-bound on refreshVer) */
  useEffect(() => {
    if (!isS8Open) return;

    const uid = getAuth()?.currentUser?.uid;
    if (!uid || !currentItemId) return;

    const db = getFirestore();
    const refDoc = doc(db, "users", uid, "RecentlyEaten", currentItemId);

    const unsub = onSnapshot(
      refDoc,
      (snap) => {
        if (!snap.exists) {
          setCurrentItem(null);
          lastSnapRef.current = null;
          return;
        }
        const d = snap.data() || {};
        if (lastSnapRef.current && !changedSubset(d, lastSnapRef.current)) return;
        lastSnapRef.current = d;

        setCurrentItem(shapeFromDoc(d));
      },
      (err) => console.log("[onSnapshot] error:", err?.message || err)
    );

    return () => {
      unsub();
      lastSnapRef.current = null;
    };
  }, [isS8Open, currentItemId, setCurrentItem, refreshVer]);

  /* When edit sheet (s9) closes -> bump rings, reset list, force fetch + resubscribe */
  useEffect(() => {
    if (isS9Open === false) {
      setRingBump((b) => b + 1);
      resetHidden();
      setListKey((k) => k + 1);
      setRefreshVer((v) => v + 1);

      const uid = getAuth()?.currentUser?.uid;
      if (!uid || !currentItemId) return;
      const db = getFirestore();
      getDoc(doc(db, "users", uid, "RecentlyEaten", currentItemId))
        .then((snap) => {
          if (snap.exists) setCurrentItem(shapeFromDoc(snap.data() || {}));
        })
        .catch(() => {});
    }
  }, [isS9Open, currentItemId, setCurrentItem]);

  /* Bump keys for page rings */
  const bumpKeys = useMemo(
    () => ({ protein: `protein-${ringBump}`, carbs: `carbs-${ringBump}`, fat: `fat-${ringBump}` }),
    [ringBump]
  );

  /* Pager */
  const pagerRef = useRef(null);
  const onPagerScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: pagerX } } }], { useNativeDriver: false }),
    [pagerX]
  );
  useEffect(() => {
    const sub = pagerX.addListener(({ value }) => {
      const idx = Math.round(value / screenW);
      if (idx !== page) setPage(idx);
    });
    return () => pagerX.removeListener(sub);
  }, [pagerX, page, screenW]);

  /* Little cards */
  const littleCards = useMemo(
    () => [
      { key: "fiber", label: "Fiber", amt: `${sNum(currentItem?.fiber_g, 0)}g`, value: sNum(currentItem?.fiber_g, 0), max: 30, color: "#22C55E" },
      { key: "sugar", label: "Sugar", amt: `${sNum(currentItem?.sugar_g, 0)}g`, value: sNum(currentItem?.sugar_g, 0), max: 50, color: "#F7931A" },
      { key: "sodium", label: "Sodium", amt: `${sNum(currentItem?.sodium_mg, 0)}mg`, value: sNum(currentItem?.sodium_mg, 0), max: 2300, color: "#0058FF" },
    ],
    [currentItem?.fiber_g, currentItem?.sugar_g, currentItem?.sodium_mg]
  );

  // ===== colors for alternatives
  const MORE_COLOR = "#EF4444"; // red
  const LESS_COLOR = "#22C55E"; // green
  const SIMILAR_COLOR = "#000"; // gray

  // ---- Animation store (no hooks inside renderItem)
  const animX = useRef(new Map()).current;
  const animOp = useRef(new Map()).current;
  const responders = useRef(new Map()).current;
  const openRowRef = useRef(null);
  const panStartX = useRef(new Map()).current;

  const getVal = (map, id, init) => {
    if (!map.has(id)) map.set(id, new Animated.Value(init));
    return map.get(id);
  };

  const [exitingIds, setExitingIds] = useState([]);

  const resetHidden = () => {
    setExitingIds([]);
    animX.clear();
    animOp.clear();
    responders.clear();
    openRowRef.current = null;
    panStartX.clear();
  };

  // slide-out helper (translateX + fade) — deletes from UI after animation
  const slideOut = (id, onAfter) => {
    const x = getVal(animX, id, 0);
    const op = getVal(animOp, id, 1);
    Animated.parallel([
      Animated.timing(x, { toValue: -width(100), duration: 250, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setExitingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      animX.delete(id);
      animOp.delete(id);
      responders.delete(id);
      if (openRowRef.current === id) openRowRef.current = null;
      panStartX.delete(id);
      onAfter && onAfter();
    });
  };

  // PanResponder per-row: reveal-only (no delete on swipe)
  const getPan = (id, x, op) => {
    if (responders.has(id)) return responders.get(id);

    const REVEAL_W = width(18);
    const THRESH = width(12);

    const r = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,

      onPanResponderGrant: () => {
        let startX = 0;
        try {
          startX = x.__getValue ? x.__getValue() : 0;
        } catch {}
        panStartX.set(id, startX);
      },

      onPanResponderMove: (_, g) => {
        const startX = panStartX.get(id) || 0;
        const next = Math.max(-REVEAL_W, Math.min(0, startX + g.dx));
        x.setValue(next);
        const fade = 1 + next / (REVEAL_W * 2);
        op.setValue(Math.max(0.5, fade));
      },

      onPanResponderRelease: (_, g) => {
        const startX = panStartX.get(id) || 0;
        const finalX = startX + g.dx;

        if (finalX <= -THRESH) {
          if (openRowRef.current && openRowRef.current !== id) {
            const prevX = getVal(animX, openRowRef.current, 0);
            Animated.spring(prevX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
          }
          openRowRef.current = id;

          Animated.parallel([
            Animated.spring(x, { toValue: -REVEAL_W, useNativeDriver: true, bounciness: 0, speed: 20 }),
            Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start();
        } else {
          if (openRowRef.current === id) openRowRef.current = null;
          Animated.parallel([
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }),
            Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start();
        }
      },

      onPanResponderTerminate: () => {
        const REOPEN = openRowRef.current === id;
        Animated.parallel([
          Animated.spring(x, { toValue: REOPEN ? -REVEAL_W : 0, useNativeDriver: true, bounciness: 0, speed: 20 }),
          Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      },
    });

    responders.set(id, r);
    return r;
  };

  // ---- helpers (top of file) ----
  const stripEmojiPrefix = (s = "") =>
    s.replace(/^\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]+)\s*/u, "").trim();

  // Which icon to use per flag key
  const FLAG_ICON = {
    kidney: "Droplet",
    heart: "Heart",
    diabetes: "Syringe",
    reduceCoffee: "Coffee",
    stopSmoking: "Ban",
  };

  // ---- inside your component ----
  const healthFlags = useMemo(() => {
    const parts =
      (currentItem?.proms && currentItem.proms.parts) ||
      currentItem?.parts ||
      {};
    const order = ["kidney", "heart", "diabetes", "reduceCoffee", "stopSmoking"];

    return order
      .map((key) => {
        const raw = typeof parts[key] === "string" ? parts[key] : "";
        if (!raw) return null;
        return {
          key,
          text: stripEmojiPrefix(raw),
          icon: FLAG_ICON[key] || "Info",
        };
      })
      .filter(Boolean);
  }, [currentItem?.proms, currentItem?.parts]);

  // Per-flag colors (bg = chip background, fg = icon color)
  const FLAG_COLORS = {
    kidney:       { bg: "#EAF2FF", fg: "#1E67FF" }, // blue
    heart:        { bg: "#FFECEF", fg: "#FE1B20" }, // red
    diabetes:     { bg: "#FFF6E6", fg: "#F59E0B" }, // orange
    reduceCoffee: { bg: "#F3E8FF", fg: "#7C3AED" }, // purple
    stopSmoking:  { bg: "#ECFDF5", fg: "#059669" }, // teal/green
  };

  const animation = useRef(null);
  useEffect(() => {
    // animation.current?.play();
  }, []);

  const CARD_W  = width(80);
  const GAP     = width(5);
  const SNAP    = CARD_W + GAP;

  const lastIndex = useRef(-1);

  const formatCreatedAt = (raw) => {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(d)) return "";
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return isToday
      ? `Today ${time}`
      : `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} ${time}`;
  };

  return (
    <View style={{ height: height(100), backgroundColor: "#fff" }}>
      <Animated.ScrollView
        contentContainerStyle={{
          paddingTop: HEADER_MAX_HEIGHT - 32,
          paddingBottom: height(15),
          // ensure at least full screen height so page is always 100%
          minHeight: screenH + HEADER_MAX_HEIGHT,
        }}
        scrollEventThrottle={16}
        onScroll={onVerticalScroll}
        removeClippedSubviews
      >
        {/* Title + Edit */}
        <View style={{ width: "100%" }}>
          <Text style={styles.helperText}>Edit the detected dish or add ingredients — tap Edit.</Text>

          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{currentItem?.title}</Text>

            <TouchableOpacity
              onPress={() => {
                present("s9");
              }}
              style={styles.editBtn}
            >
              <View style={{ flexDirection: "row" }}>
                <LucideIcons.Pencil size={18} color={"#000"} strokeWidth={4} />
                <Text style={styles.editTxt}>Edit</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pager */}
        <View style={{ height: height(45) }} pointerEvents="box-none">
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            removeClippedSubviews
          >
            {/* Page 1 */}
            <View style={{ width: screenW }}>
              <View style={styles.caloriesCard}>
                <View style={{
                  borderRadius: 19,
                  height: "100%",
                  width: "100%",
                  position: 'absolute',
                  overflow: 'hidden'
                }}>
                  <LottieView
                    autoPlay
                    ref={animation}
                    style={{ width: 500, height: 500 }}
                    contentFit="contain"
                    source={require("../../../assets/CaloriesBackground.json")}
                  />
                </View>
                <Text style={{
                  marginTop: height(3),
                  marginLeft: width(5),
                  fontSize: size(18),
                  fontWeight: "800",
                }}>Calories</Text>
                <View style={styles.caloriesRow}>
                  <View style={{
                    height: size(40),
                    width: size(40),
                    borderRadius: size(40) / 2,
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <LucideIcons.Flame size={38} strokeWidth={3} color={"#000"} />
                  </View>
                  <Text style={styles.caloriesValue}>{currentItem?.calories_kcal_total}</Text>
                </View>
              </View>

              <View style={styles.ringsRow}>
                <View style={styles.tile3}>
                  <MiniRing
                    value={p}
                    color="#632EFF"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={bumpKeys.protein}
                  />
                  <Text style={styles.amtText}>{p}g</Text>
                  <Text style={styles.capText}>Protein</Text>
                </View>

                <View style={styles.tile3}>
                  <MiniRing
                    value={c}
                    color="#F7931A"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={bumpKeys.carbs}
                  />
                  <Text style={styles.amtText}>{c}g</Text>
                  <Text style={styles.capText}>Carbs</Text>
                </View>

                <View style={styles.tile3}>
                  <MiniRing
                    value={f}
                    color="#0058FF"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={`fat-${ringBump}`}
                  />
                  <Text style={styles.amtText}>{f}g</Text>
                  <Text style={styles.capText}>Fat</Text>
                </View>
              </View>
            </View>

            {/* Page 2 — 90% card + THREE little cards with rings */}
            <View style={{ width: screenW }}>
              <View style={styles.bigMetricCard}>
                <View style={{
                  borderRadius: 19,
                  height: "100%",
                  width: "100%",
                  position: 'absolute',
                  overflow: 'hidden'
                }}>
                  <LottieView
                    autoPlay
                    ref={animation}
                    style={{ width: 500, height: 500 }}
                    contentFit="contain"
                    source={require("../../../assets/HealthScoreBackground.json")}
                  />
                </View>

                <Text style={{
                  marginTop: height(3),
                  marginLeft: width(5),
                  fontSize: size(18),
                  fontWeight: "800",
                }}>Health Score</Text>
                <View style={styles.caloriesRow}>
                  <View style={{
                    height: size(40),
                    width: size(40),
                    borderRadius: size(40) / 2,
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <LucideIcons.Heart size={38} strokeWidth={3} color={"#000"} />
                  </View>
                  <Text style={styles.caloriesValue}>{sNum(currentItem?.health_score, 0)}</Text>
                  <Text style={{ fontSize: size(20), fontWeight: "700", marginLeft: width(1) }}>/10</Text>
                </View>
              </View>

              <View style={styles.ringsRow}>
                {littleCards.map((it) => (
                  <View key={it.key} style={styles.tile3}>
                    <MiniRing
                      value={it.value}
                      color={it.color}
                      strokeWidth={5}
                      radius={36}
                      duration={800}
                      maxValue={it.max}
                      active={isS8Open}
                      bumpKey={`little-${it.key}-${ringBump}`}
                    />
                    <Text style={styles.amtText}>{it.amt}</Text>
                    <Text style={styles.capText}>{it.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.ScrollView>

          {/* dots */}
          <View style={{ flexDirection: "row", alignSelf: "center", top: height(3) }}>
            <View style={page === 0 ? styles.activeDot : styles.dot} />
            <View style={[page === 1 ? styles.activeDot : styles.dot, { marginLeft: 8 }]} />
          </View>
        </View>

        {/* ---------- Personalized flags card ---------- */}
        <View style={{ marginTop: height(8) }}>
          <Text style={{
            marginBottom: height(1),
            marginLeft: width(5),
            fontSize: size(18),
            fontWeight: "800"
          }}>
            Personalized health checks
          </Text>
          <FlatList
            horizontal
            data={healthFlags}
            keyExtractor={(it, i) => `${it.key}-${i}`}
            showsHorizontalScrollIndicator={false}
            style={{ height: height(18) }}
            contentContainerStyle={{ paddingLeft: width(5), paddingRight: width(5) }}
            // snapping
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={SNAP}
            bounces={false}
            // haptic when a new card snaps
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SNAP);
              if (i !== lastIndex.current) {
                lastIndex.current = i;
                Haptics.selectionAsync();
              }
            }}
            // spacing between cards
            ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
            renderItem={({ item }) => {
              const Icon = LucideIcons[item.icon] || LucideIcons.Info;
              const { bg, fg } = FLAG_COLORS[item.key] || { bg: "#F3F4F6", fg: "#111" };

              return (
                <View
                  style={{
                    width: CARD_W,
                    marginRight: 0,
                    paddingVertical: 20,
                    height: height(13),
                    alignSelf: "center",
                    backgroundColor: "#fff",
                    borderRadius: 20,
                    paddingHorizontal: width(4),
                    borderWidth: 1,
                    borderColor: "#F1F3F9",
                    ...Platform.select({
                      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10 },
                      android: { elevation: 3, shadowColor: "#00000050" },
                    }),
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View
                      style={{
                        height: 34, width: 34, borderRadius: 17,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: bg, marginRight: width(3),
                      }}
                    >
                      <Icon size={16} color={fg || "#000"} />
                    </View>

                    <Text style={{ flex: 1, fontSize: size(16), lineHeight: height(2.5), color: "#111" }}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>

        {/* Totals */}
        <Text style={styles.totalsHeader}>Total meal calories</Text>

        {/* Ingredients list */}
        <FlatList
          key={`ing-${listKey}`}
          style={{ marginTop: height(4) }}
          data={currentItem?.ingredientCards}
          extraData={`${ringBump}-${refreshVer}-${currentItem?.ingredientCards?.length || 0}`}
          keyExtractor={(_, i) => String(i)}
          removeClippedSubviews
          initialNumToRender={4}
          windowSize={5}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={24}
          scrollEnabled={false}
          contentContainerStyle={{ width: "90%", alignSelf: "center", marginTop: height(1), paddingBottom: height(1) }}
          renderItem={({ item, index }) => {
            const IconComponent = LucideIcons.Utensils;

            const id = String(item?.id ?? index);
            if (exitingIds.includes(id)) return null;

            const x = getVal(animX, id, 0);
            const op = getVal(animOp, id, 1);

            const pan = getPan(id, x, op);

            const trashOpacity = x.interpolate({
              inputRange: [-width(18), -width(6), 0],
              outputRange: [1, 0.6, 0],
              extrapolate: "clamp",
            });
            const trashScale = x.interpolate({
              inputRange: [-width(18), 0],
              outputRange: [1, 0.85],
              extrapolate: "clamp",
            });

            return (
              <View style={{ height: size(90), width: "100%" }}>
                {/* Background trash button (revealed when swiped) */}
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: width(18),
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => slideOut(id)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Animated.View
                      style={{
                        backgroundColor: "#FFECEF",
                        borderRadius: 16,
                        padding: size(10),
                        opacity: trashOpacity,
                        transform: [{ scale: trashScale }],
                      }}
                    >
                      <LucideIcons.Trash2 size={20} color={"#FE1B20"} />
                    </Animated.View>
                  </TouchableOpacity>
                </View>

                {/* Foreground row */}
                <Animated.View
                  {...pan.panHandlers}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: "100%",
                    opacity: op,
                    transform: [{ translateX: x }],
                    backgroundColor: "transparent",
                  }}
                >
                  <IconComponent style={{ marginLeft: width(5) }} size={16} color={"#000"} />

                  <Text style={{ width: "50%", fontSize: size(16), color: "#000", fontWeight: "800", marginLeft: width(5) }}>
                    {item?.label}
                  </Text>

                  <Text
                    onPress={() => slideOut(id)}
                    style={{ color: "#000", right: width(2), position: "absolute", fontWeight: "800", fontSize: size(16) }}
                  >
                    {item?.amt ?? "+0 cal"}
                  </Text>
                </Animated.View>
              </View>
            );
          }}
        />

        {/* Alternatives header */}
        <Text style={[styles.totalsHeader, { marginTop: height(1) }]}>Alternatives</Text>

        <FlatList
          horizontal
          style={{ width: "100%", paddingLeft: width(5), paddingTop: height(4), paddingBottom: height(2) }}
          data={Array.isArray(currentItem?.alternatives?.other_brands) ? currentItem.alternatives.other_brands : []}
          keyExtractor={(item, i) => `alt-${item?.code || item?.name || i}`}
          removeClippedSubviews
          initialNumToRender={4}
          windowSize={5}
          maxToRenderPerBatch={4}
          contentContainerStyle={{ paddingRight: width(5) }}
          updateCellsBatchingPeriod={24}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const altKcal = Number.isFinite(+item?.calories_per_package_kcal) ? Math.round(+item.calories_per_package_kcal) : null;
            const baseKcal = Number.isFinite(+currentItem?.calories_kcal_total) ? Math.round(+currentItem.calories_kcal_total) : null;

            const diff = altKcal != null && baseKcal != null ? altKcal - baseKcal : null;
            const THRESH = 5;
            const bucket = diff == null ? "similar" : diff < -THRESH ? "lower" : diff > THRESH ? "higher" : "similar";

            const color = bucket === "higher" ? MORE_COLOR : bucket === "lower" ? LESS_COLOR : SIMILAR_COLOR;

            const label = [sText(item?.brand, ""), sText(item?.name, ""), sText(item?.flavor_or_variant, "")]
              .filter(Boolean)
              .join(" ");

            const sign = bucket === "higher" ? "+" : bucket === "lower" ? "−" : "";
            const amt = altKcal != null ? `${sign}${altKcal}cal` : "—";

            return (
              <View
                style={{
                  backgroundColor: "#fff",
                  width: size(150),
                  marginRight: width(5),
                  height: height(20),
                  marginBottom: 12,
                  borderRadius: 15,
                  ...Platform.select({
                    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 10 },
                    android: { elevation: 6, shadowColor: "#888" },
                  }),
                }}
              >
                <Text
                  numberOfLines={4}
                  style={{ width: "75%", marginLeft: width(5), marginTop: height(2), fontSize: size(16), fontWeight: "800" }}
                >
                  {label}
                </Text>

                <Text
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    color,
                    fontWeight: "800",
                    fontSize: size(18),
                    width: "95%",
                    position: "absolute",
                    marginLeft: width(5),
                    bottom: height(4),
                  }}
                >
                  {amt}
                </Text>
              </View>
            );
          }}
        />
      </Animated.ScrollView>

      {/* Collapsing header image */}
      <Animated.View
        style={[
          styles.header,
          { transform: [{ translateY: headerTranslateY }] },
          Platform.select({
            ios: { shouldRasterizeIOS: true },
            android: { renderToHardwareTextureAndroid: true },
          }),
        ]}
      >
        <Animated.Image
          style={[styles.headerBackground, { opacity: imageOpacity, transform: [{ translateY: imageTranslateY }] }]}
          source={{ uri: currentItem?.image_cloud_url }}
        />
      </Animated.View>

      {/* Top title over header — hidden at top, slides in after a small scroll */}
      <Animated.View
        style={[
          styles.headerTopTitle,
          { transform: [{ translateY: topBarTranslateY }], opacity: topBarOpacity },
        ]}
      >
        <Text style={{ color: "#000", marginTop: height(1), fontWeight: "700", fontSize: size(15) }}>
          Scanned {formatCreatedAt(currentItem?.created_at)}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringNumber: { fontSize: size(18), fontWeight: "800", color: "#000" },

  helperText: {
    fontSize: size(16),
    marginTop: height(8),
    marginBottom: 0,
    marginLeft: width(5),
    color: "#999",
    fontWeight: "800",
    width: "85%",
    lineHeight: height(2.5),
  },
  titleRow: { flexDirection: "row", marginTop: height(4), marginLeft: width(5) },
  titleText: { fontSize: size(30), width: "65%", fontWeight: "700" },
  editBtn: {
    height: size(40),
    top: 0,
    right: width(5),
    position: "absolute",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: size(25),
    marginRight: width(1),
  },
  editTxt: { marginLeft: width(2), fontWeight: "700", fontSize: size(16) },

  dot: { backgroundColor: "rgba(0,0,0,0.18)", width: 8, height: 8, borderRadius: 4 },
  activeDot: { backgroundColor: "#000", width: 40, height: 8, borderRadius: 4 },

  caloriesCard: {
    width: "90%",
    marginTop: height(4),
    borderRadius: 20,
    alignSelf: "center",
    height: height(16),
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 5, shadowColor: "#00000050" },
    }),
  },
  bigMetricCard: {
    width: "90%",
    marginTop: height(4),
    borderRadius: 20,
    alignSelf: "center",
    height: height(16),
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 5, shadowColor: "#00000050" },
    }),
  },

  caloriesLabel: { fontSize: size(17), fontWeight: "bold", marginLeft: width(5) },
  caloriesRow: { flexDirection: "row", alignItems: "center", marginTop: height(2), marginLeft: width(5) },
  flameWrap: {
    height: size(65),
    width: size(65),
    borderRadius: size(65) / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  bigIconWrap: {
    height: size(65),
    width: size(65),
    borderRadius: size(65) / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  caloriesValue: { fontSize: size(40), marginLeft: width(3), fontWeight: "700" },

  ringsRow: {
    flexDirection: "row",
    width: "90%",
    alignSelf: "center",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: height(1),
  },

  tile3: {
    width: "31%",
    height: height(20),
    marginTop: height(2),
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
      android: { elevation: 2, shadowColor: "#00000050" },
    }),
  },

  amtText: { fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" },
  capText: { fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" },

  /* Personalized flags styles */
  flagsCard: {
    width: "90%",
    alignSelf: "center",
    marginTop: height(3),
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 3, shadowColor: "#00000040" },
    }),
  },
  flagRow: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  flagIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  flagText: { flex: 1, color: "#111", fontSize: size(15), fontWeight: "600", lineHeight: 20 },

  totalsHeader: { fontSize: size(18), marginTop: height(4), fontWeight: "800", marginLeft: width(5) },

  header: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    width: width(100),
    backgroundColor: "#fff",
    height: HEADER_MAX_HEIGHT,
  },
  headerBackground: {
    position: "absolute",
    width: width(100),
    height: HEADER_MAX_HEIGHT,
    resizeMode: "cover",
  },
  headerTopTitle: {
    marginTop: 0,
    width: width(100),
    height: height(6),
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#fff',
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ScanPageHome;
