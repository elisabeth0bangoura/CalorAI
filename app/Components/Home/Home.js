// ./Cameras/Home.js
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { collection, doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { useDailyLeft } from "@/app/Context/DailyLeftContext";
import { useDailyTargets } from "@/app/Context/DailyPlanProvider";
import * as Haptics from "expo-haptics";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  InteractionManager,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { height, size, width } from "react-native-responsive-sizes";
import { useSheets } from "../../Context/SheetsContext";
import RollingMetric from "../../RollingMetric";

import { Image } from "expo-image";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import TwoRowMonthlyHeatmap from "./WeeklyCalendar";

import {
  Candy,
  Cigarette,
  Coffee,
  CupSoda,
  Droplet,
  Egg,
  Flame,
  GlassWater,
  Leaf,
  Plus,
  Wheat,
} from "lucide-react-native";

/* ---------- Ring theme & helpers ---------- */
const DEFAULT_COLORS = {
  bg: "#ffffff",
  card: "#F4F5F7",
  text: "#0F0F12",
  sub: "#7B7F87",
  divider: "#ECEEF1",
  cal: "#111111",
  protein: "#632EFF",
  carbs: "#F7931A",
  fat: "#FCDB2A",
  fiber: "#A87DD8",
  sugar: "#FF89A0",
  sodium: "#D7A44A",
  coffee: "#C15217",
  cigarette: "#F7931A",
};

const COLORS = {
  ...DEFAULT_COLORS,
  cal: "#FFCF2D",
  water: "#0057FF",
};

const ringProps = {
  radius: 28,
  activeStrokeWidth: 6,
  inActiveStrokeWidth: 6,
  inActiveStrokeOpacity: 0.15,
  strokeLinecap: "round",
  rotation: -90,
};

// clamp to a 0–100 int
const clampPct = (current = 0, goal = 1) => {
  const g = Math.max(1, Number(goal || 1));
  const c = Math.max(0, Number(current || 0));
  return Math.round(Math.min(100, (c / g) * 100));
};

/* ---------- Tiny progress bar ---------- */
const ProgressBar = memo(function ProgressBar({
  height: h = 8,
  progress = 0,
  duration = 300,
  bg = "#5BC951",
  track = "#2A2A2A",
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(progress, 100)),
      duration,
      useNativeDriver: false,
    }).start();
  }, [progress, duration, anim]);
  return (
    <View style={{ width: "100%" }}>
      <View
        style={{
          width: "100%",
          height: h,
          overflow: "hidden",
          borderRadius: h / 2,
          backgroundColor: track,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            borderRadius: h / 2,
            backgroundColor: bg,
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
});

/* ---------- Header (memoized) ---------- */
const HeaderView = memo(function HeaderView({
  userId,
  vals,
  maxes,
  animateRings,
  sleeping = false,
  colorsMap = COLORS,
  enabledMap = {},
}) {
  const [showSwiper, setShowSwiper] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Pager refs/state
  const pagerRef = useRef(null);
  const [pagerIndex, setPagerIndex] = useState(0);
  const lastHapticTsRef = useRef(0);

  // convert "left" to current% of goal (0–100)
  const pctFromLeft = useCallback((left, goal) => {
    const g = Math.max(1, Number(goal || 1));
    const l = Math.max(0, Number(left || 0));
    const current = Math.max(0, g - l);
    return clampPct(current, g);
  }, []);

  // staggered animation props
  const animProps = useCallback(
    (i = 0) => {
      if (!animateRings) return { duration: 0, delay: 0 };
      const delay = Math.min(400, i * 80);
      const duration = 600;
      return { duration, delay };
    },
    [animateRings]
  );

  const enabledOr = useCallback(
    (key, fallback = true) => {
      const v = enabledMap?.[key];
      return v === undefined ? fallback : !!v;
    },
    [enabledMap]
  );

  const { present } = useSheets();

  // Lazy-mount heavy UI ONLY when not sleeping
  useEffect(() => {
    if (sleeping) {
      setShowSwiper(false);
      setShowHeatmap(false);
      return;
    }
    let t1 = setTimeout(() => setShowSwiper(true), 120);
    let t2;
    InteractionManager.runAfterInteractions(() => {
      t2 = setTimeout(() => setShowHeatmap(true), 300);
    });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sleeping]);

  const onPagerSelected = useCallback(({ nativeEvent }) => {
    setPagerIndex(nativeEvent.position);
    const now = Date.now();
    if (now - lastHapticTsRef.current > 150) {
      lastHapticTsRef.current = now;
      try {
        Haptics.selectionAsync && Haptics.selectionAsync();
      } catch {}
    }
  }, []);

  /* ------------------ CARD RENDERERS ------------------ */
  const widthForCount = useCallback(
    (count) => (count === 1 ? "100%" : count === 2 ? "48%" : "30%"),
    []
  );

  const CoffeeCard = useCallback(
    (w, key, index = 0) => (
      <View
        key={key}
        style={{
          height: height(25),
          width: w,
          borderRadius: 19,
          marginTop: height(1.8),
          alignItems: "center",
          backgroundColor: "#fff",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <View style={{ marginTop: height(2) }}>
          <CircularProgressBase
            {...ringProps}
            radius={50}
            {...animProps(index)}
            value={pctFromLeft(vals.coffeeLeft, maxes.coffeeCups)}
            maxValue={100}
            activeStrokeWidth={9}
            inActiveStrokeWidth={9}
            activeStrokeColor={colorsMap.coffee}
            inActiveStrokeColor={colorsMap.coffee}
          >
            <Coffee size={25} color="#000" />
          </CircularProgressBase>
        </View>

        <View
          style={{
            marginTop: height(2),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RollingMetric
            value={vals.coffeeLeft}
            toFixed={0}
            color="#000"
            numberStyle={{ fontSize: size(30) }}
          />
          <Text
            style={{
              fontSize: size(13),
              color: "#000",
              marginTop: height(1),
              fontWeight: "800",
            }}
          >
            Coffee <Text style={{ fontWeight: "500" }}>left</Text>
          </Text>
        </View>
      </View>
    ),
    [animProps, colorsMap.coffee, maxes.coffeeCups, pctFromLeft, vals.coffeeLeft]
  );

  const CaloriesCard = useCallback(
    (w, key, index = 0) => (
      <View
        key={key}
        style={{
          height: height(25),
          width: w,
          borderRadius: 19,
          marginTop: height(1.8),
          alignItems: "center",
          backgroundColor: "#151515",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <View style={{ marginTop: height(2) }}>
          <CircularProgressBase
            {...ringProps}
            {...animProps(index)}
            radius={50}
            activeStrokeWidth={9}
            inActiveStrokeWidth={9}
            value={pctFromLeft(vals.caloriesLeft, maxes.calories)}
            maxValue={100}
            activeStrokeColor={colorsMap.cal}
            inActiveStrokeColor={colorsMap.cal}
          >
            <Flame size={25} color={"#fff"} />
          </CircularProgressBase>
        </View>

        <View
          style={{
            marginTop: height(2),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RollingMetric
            value={vals.caloriesLeft}
            toFixed={0}
            color="#fff"
            numberStyle={{ fontSize: size(30) }}
          />
          <Text
            style={{
              fontSize: size(13),
              color: "#fff",
              marginTop: height(1),
              fontWeight: "800",
            }}
          >
            Calories <Text style={{ fontWeight: "500" }}>left</Text>
          </Text>
        </View>
      </View>
    ),
    [animProps, colorsMap.cal, maxes.calories, pctFromLeft, vals.caloriesLeft]
  );

  const SmallCard = useCallback(
    ({ kind, label, value, unit, max, colorKey, Icon, index, widthPercent }) => (
      <View
        key={`small-${kind}`}
        style={{
          height: height(20),
          width: widthPercent,
          marginTop: height(2),
          backgroundColor: "#fff",
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <RollingMetric
          label="left"
          value={value}
          unit={unit}
          toFixed={0}
          color="#000"
          numberStyle={{ fontSize: size(20) }}
        />
        <Text
          style={{
            fontSize: size(13),
            marginTop: height(1),
            marginBottom: height(2),
            fontWeight: "800",
          }}
        >
          {label} <Text style={{ fontWeight: "500" }}>left</Text>
        </Text>
        <CircularProgressBase
          {...ringProps}
          {...animProps(index)}
          value={pctFromLeft(value, max)}
          maxValue={100}
          activeStrokeColor={colorsMap[colorKey]}
          inActiveStrokeColor={colorsMap[colorKey]}
        >
          <Icon size={18} color="#000" />
        </CircularProgressBase>
      </View>
    ),
    [animProps, colorsMap, pctFromLeft]
  );

  const HalfCard = useCallback(
    ({ kind, label, value, unit, max, colorKey, Icon, index, widthPercent }) => (
      <View
        key={`half-${kind}`}
        style={{
          height: "100%",
          width: widthPercent,
          backgroundColor: "#fff",
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <RollingMetric
          label="left"
          value={value}
          unit={unit}
          toFixed={0}
          color="#000"
          numberStyle={{ marginTop: height(1), fontSize: size(20) }}
        />
        <Text
          style={{
            fontSize: size(13),
            marginTop: height(1),
            marginBottom: height(2),
            fontWeight: "800",
          }}
        >
          {label} Left
        </Text>
        <CircularProgressBase
          {...ringProps}
          {...animProps(index)}
          value={pctFromLeft(value, max)}
          maxValue={100}
          activeStrokeColor={colorsMap[colorKey]}
          inActiveStrokeColor={colorsMap[colorKey]}
        >
          <Icon size={25} color="#000" />
        </CircularProgressBase>
      </View>
    ),
    [animProps, colorsMap, pctFromLeft]
  );

  const CigarettesWide = useCallback(
    (widthPercent) => (
      <View
        key="cigs"
        style={{
          height: height(20),
          width: widthPercent,
          backgroundColor: "#fff",
          borderRadius: 15,
          justifyContent: "center",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <View
          style={{
            marginLeft: width(15),
            width: 100,
            alignItems: "center",
          }}
        >
          <RollingMetric
            label="right"
            value={vals.cigarettesLeft}
            toFixed={0}
            color="#000"
            numberStyle={{ marginTop: height(5), fontSize: size(25) }}
          />
          <Text
            style={{
              fontSize: size(13),
              marginTop: height(1),
              marginBottom: height(2),
              fontWeight: "800",
            }}
          >
            Cigarettes Left
          </Text>
        </View>

        <View style={{ right: width(15), position: "absolute" }}>
          <CircularProgressBase
            {...ringProps}
            {...animProps(1)}
            value={pctFromLeft(vals.cigarettesLeft, maxes.cigarettes)}
            maxValue={100}
            radius={50}
            activeStrokeWidth={9}
            inActiveStrokeWidth={9}
            activeStrokeColor={colorsMap.cigarette}
            inActiveStrokeColor={colorsMap.cigarette}
          >
            <Cigarette size={25} color="#000" />
          </CircularProgressBase>
        </View>
      </View>
    ),
    [animProps, colorsMap.cigarette, maxes.cigarettes, pctFromLeft, vals.cigarettesLeft]
  );

  /* ----------------- DYNAMIC PACKING ----------------- */

  // half-width widgets (2 per row) in priority order
  const halfPool = useMemo(() => {
    const out = [];
    if (enabledOr("coffee", true)) out.push("coffee");
    if (enabledOr("calories", true)) out.push("calories");
    if (enabledOr("sugar", true)) out.push("sugar");
    if (enabledOr("fat", true)) out.push("fat");
    if (enabledOr("fiber", true)) out.push("fiber");
    if (enabledOr("sodium", true)) out.push("sodium");
    return out;
  }, [enabledOr]);

  // small widgets (3 per row)
  const smallPool = useMemo(() => {
    const out = ["water"]; // water always shown in your UI
    if (enabledOr("protein", true)) out.push("protein");
    if (enabledOr("carbs", true)) out.push("carbs");
    return out;
  }, [enabledOr]);

  const cigsEnabled = enabledOr("cigarette", true);
  const healthEnabled = true;

  // Build slides packed forward
  const slides = useMemo(() => {
    const take = (arr, start, n) => arr.slice(start, start + Math.max(0, n));
    let halfIdx = 0;
    let smallIdx = 0;

    // slide 0
    const slide0 = [];
    const s0Half = take(halfPool, halfIdx, 2);
    halfIdx += s0Half.length;
    if (s0Half.length) slide0.push({ type: "half", items: s0Half });

    const s0Small = take(smallPool, smallIdx, 3);
    smallIdx += s0Small.length;
    if (s0Small.length) slide0.push({ type: "small", items: s0Small });

    // slide 1
    const slide1 = [];
    const s1Half = take(halfPool, halfIdx, 2);
    halfIdx += s1Half.length;
    if (s1Half.length) slide1.push({ type: "half", items: s1Half });
    if (healthEnabled) slide1.push({ type: "wide", items: ["health"] });

    // slide 2
    const slide2 = [];
    const s2Half = take(halfPool, halfIdx, 2);
    halfIdx += s2Half.length;
    if (s2Half.length) slide2.push({ type: "half", items: s2Half });
    if (cigsEnabled) slide2.push({ type: "wide", items: ["cigs"] });

    return [slide0, slide1, slide2];
  }, [halfPool, smallPool, cigsEnabled]);

  // 🔥 REMOVE EMPTY SLIDES
  const filteredSlides = useMemo(
    () => slides.filter((rows) => rows.length > 0),
    [slides]
  );

  // keep pager index in range when slides change
  useEffect(() => {
    if (filteredSlides.length === 0) {
      setPagerIndex(0);
      return;
    }
    if (pagerIndex >= filteredSlides.length) {
      const next = Math.max(0, filteredSlides.length - 1);
      setPagerIndex(next);
      // sync the PagerView
      requestAnimationFrame(() => {
        try {
          pagerRef.current?.setPageWithoutAnimation?.(next);
        } catch {}
      });
    }
  }, [filteredSlides.length, pagerIndex]);

  /* ------------------- RENDER ROWS ------------------- */
  const halfMeta = {
    sugar: {
      label: "Sugar",
      value: vals.sugarLeft,
      unit: "g",
      max: maxes.sugarG,
      colorKey: "sugar",
      Icon: Candy,
    },
    fat: {
      label: "Fat",
      value: vals.satFatLeft,
      unit: "g",
      max: maxes.satFatG,
      colorKey: "fat",
      Icon: Droplet,
    },
    fiber: {
      label: "Fiber",
      value: vals.fiberLeft,
      unit: "g",
      max: maxes.fiberG,
      colorKey: "fiber",
      Icon: Leaf,
    },
    sodium: {
      label: "Sodium",
      value: vals.sodiumLeft,
      unit: "mg",
      max: maxes.sodiumMg,
      colorKey: "sodium",
      Icon: CupSoda,
    },
  };

  const smallMeta = {
    // keep your text for the water card (“Protein left”)
    water: {
      label: "Protein",
      value: vals.waterLeft,
      unit: "g",
      max: maxes.waterMl,
      colorKey: "water",
      Icon: GlassWater,
    },
    protein: {
      label: "Protein",
      value: vals.proteinLeft,
      unit: "g",
      max: maxes.proteinG,
      colorKey: "protein",
      Icon: Egg,
    },
    carbs: {
      label: "Carbs",
      value: vals.carbsLeft,
      unit: "g",
      max: maxes.carbsG,
      colorKey: "carbs",
      Icon: Wheat,
    },
  };

  const renderHalfRow = (items) => {
    const count = items.length;
    const w = widthForCount(count);
    return (
      <View
        style={{
          flexDirection: "row",
          height: height(25),
          alignSelf: "center",
          marginTop: height(1.8),
          width: "90%",
          justifyContent: count === 1 ? "center" : "space-between",
        }}
      >
        {items.map((k, idx) => {
          if (k === "coffee") return CoffeeCard(w, "coffee", idx);
          if (k === "calories") return CaloriesCard(w, "calories", idx);
          const m = halfMeta[k];
          return (
            <HalfCard
              key={k}
              kind={k}
              label={m.label}
              value={m.value}
              unit={m.unit}
              max={m.max}
              colorKey={m.colorKey}
              Icon={m.Icon}
              index={idx}
              widthPercent={w}
            />
          );
        })}
      </View>
    );
  };

  const renderSmallRow = (items) => {
    const count = items.length;
    const w = widthForCount(count);
    return (
      <View
        style={{
          height: height(32),
          flexDirection: "row",
          marginTop: height(2),
          width: "90%",
          alignSelf: "center",
          justifyContent: count === 1 ? "center" : "space-between",
        }}
      >
        {items.map((k, idx) => {
          const m = smallMeta[k];
          return (
            <SmallCard
              key={k}
              kind={k}
              label={m.label}
              value={m.value}
              unit={m.unit}
              max={m.max}
              colorKey={m.colorKey}
              Icon={m.Icon}
              index={idx}
              widthPercent={w}
            />
          );
        })}
      </View>
    );
  };

  const renderWide = (key) => {
    if (key === "health") {
      return (
        <View
          key="health"
          style={{
            marginTop: height(2),
            height: height(20),
            alignSelf: "center",
            width: "90%",
            backgroundColor: "#151515",
            borderRadius: 15,
            marginBottom: height(2),
            ...(Platform.OS === "ios"
              ? {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                }
              : { elevation: 2, shadowColor: "#00000030" }),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              marginLeft: width(5),
              marginTop: height(2),
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: size(20), fontWeight: "800", color: "#fff" }}>
              Health Score
            </Text>
            <Text
              style={{
                position: "absolute",
                right: width(5),
                color: "#fff",
                fontWeight: "700",
              }}
            >
              70/100
            </Text>
          </View>

          <View style={{ marginTop: height(2), width: "90%", alignSelf: "center" }}>
            <ProgressBar progress={60} height={8} bg="#5BC951" />
          </View>

          <Text
            style={{
              fontSize: size(13),
              width: "90%",
              marginLeft: width(5),
              color: "#fff",
              marginTop: height(2),
              lineHeight: height(2.5),
            }}
          >
            You're below your calorie, carb, and fat goals, but need to increase protein for
            effective weight loss. Keep focusing on boosting protein intake!
          </Text>
        </View>
      );
    }
    return (
      <View
        key="cigs-row"
        style={{
          flexDirection: "row",
          height: height(25),
          alignSelf: "center",
          marginTop: height(1.8),
          width: "90%",
          justifyContent: "center",
        }}
      >
        {CigarettesWide("100%")}
      </View>
    );
  };

  const renderRows = (rows, slideKey) => (
    <View key={slideKey} style={{ paddingTop: height(2) }}>
      {rows.map((r) => {
        if (r.type === "half") return renderHalfRow(r.items);
        if (r.type === "small") return renderSmallRow(r.items);
        return renderWide(r.items[0]);
      })}
    </View>
  );

  return (
    <View style={{ paddingTop: height(12), backgroundColor: "#fff" }}>
      {/* Heatmap */}
      <View style={{ minHeight: height(8), justifyContent: "center" }}>
        {!sleeping && showHeatmap ? (
          <TwoRowMonthlyHeatmap
            db={getFirestore()}
            userId={userId}
            monthsAhead={4}
            monthsBack={0}
            gap={4}
          />
        ) : (
          <View
            style={{
              height: height(8),
              width: "90%",
              alignSelf: "center",
              backgroundColor: "#F6F7F9",
              borderRadius: 10,
            }}
          />
        )}
      </View>

      {/* Add widget */}
      <TouchableOpacity
        onPress={() => {
          present("Home_Add_Widget");
        }}
        disabled={sleeping}
        style={{
          marginLeft: width(5),
          marginTop: height(2),
          flexDirection: "row",
          alignItems: "center",
          opacity: sleeping ? 0.5 : 1,
        }}
      >
        <Plus size={16} />
        <Text style={{ marginLeft: width(2), fontSize: size(17), fontWeight: "800" }}>
          Add Widgets
        </Text>
      </TouchableOpacity>

      {/* PagerView */}
      {!sleeping && showSwiper ? (
        filteredSlides.length > 0 ? (
          <>
            <PagerView
              ref={pagerRef}
              style={{ height: height(52), width: "100%" }}
              initialPage={0}
              onPageSelected={onPagerSelected}
              offscreenPageLimit={1}
              pageMargin={12}
              overScrollMode="never"
              scrollEnabled
            >
              {filteredSlides.map((rows, i) => renderRows(rows, `slide-${i}`))}
            </PagerView>

            {/* Dots (hide if single page) */}
            {filteredSlides.length > 1 && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 12,
                  marginBottom: 12,
                }}
              >
                {filteredSlides.map((_, i) =>
                  i === pagerIndex ? (
                    <View
                      key={`dot-${i}`}
                      style={{
                        backgroundColor: "#000",
                        width: size(40),
                        height: 8,
                        borderRadius: 4,
                        marginHorizontal: 3,
                        marginVertical: 3,
                      }}
                    />
                  ) : (
                    <View
                      key={`dot-${i}`}
                      style={{
                        backgroundColor: "#D3DAE0",
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginHorizontal: 3,
                        marginVertical: 3,
                      }}
                    />
                  )
                )}
              </View>
            )}

            {/* Section titles */}
            <Text
              style={{
                fontSize: size(18),
                marginTop: height(4),
                marginLeft: width(5),
                fontWeight: "bold",
              }}
            >
              Recently eaten
            </Text>
          
          </>
        ) : (
          // no slides at all (very unlikely)
          <View
            style={{
              height: height(55),
              width: "90%",
              alignSelf: "center",
              backgroundColor: "#F6F7F9",
              borderRadius: 16,
              marginTop: height(2),
            }}
          />
        )
      ) : (
        <View
          style={{
            height: height(55),
            width: "90%",
            alignSelf: "center",
            backgroundColor: "#F6F7F9",
            borderRadius: 16,
            marginTop: height(2),
          }}
        />
      )}
    </View>
  );
});



// --- helpers ---
const toDateFromAny = (t) => {
  if (!t) return null;
  if (typeof t === "number") return new Date(t > 1e12 ? t : t * 1000);
  if (typeof t === "string") {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  if (t?.toDate) { try { return t.toDate(); } catch {} }
  // Firestore Timestamp-like plain objects
  if (typeof t === "object") {
    const s = t.seconds ?? t._seconds;
    const ns = t.nanoseconds ?? t._nanoseconds;
    if (s != null) return new Date(s * 1000 + Math.floor((ns ?? 0) / 1e6));
  }
  return null;
};

const formatLocalTime = (date) => {
  if (!date) return "";
  try {
    // Device locale + locale-appropriate 12/24h
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    // Fallback if Intl isn't available
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
};







/* =================== HOME =================== */
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [userId, setUserId] = useState(getAuth().currentUser?.uid ?? null);
  const [foods, setFoods] = useState([]);

  // AllNeeds/current (colors, enabled, focus)
  const [needsConfig, setNeedsConfig] = useState({
    colors: null,
    enabled: null,
    focus: null,
  });

  const { setCurrentItemId, setCurrentItem } = useCurrentScannedItemId();
  const { present } = useSheets();

  const { targets } = useDailyTargets();
  const { left, today } = useDailyLeft();

  // Sheets busy flag
  const sheets = useSheets();
  const sheetsBusy =
    sheets.isS2Open ||
    sheets.isS3Open ||
    sheets.isS4Open ||
    sheets.isS5Open ||
    sheets.isS6Open ||
    sheets.isS7Open ||
    sheets.isS8Open ||
    sheets.isS9Open;

  /* ---------- Animation window controls ---------- */
  const [animateRings, setAnimateRings] = useState(false);
  const animateTimer = useRef(null);
  const prevValsRef = useRef(null);

  const openAnimWindow = useCallback(
    (ms = 800) => {
      if (sheetsBusy) return;
      setAnimateRings(true);
      if (animateTimer.current) clearTimeout(animateTimer.current);
      animateTimer.current = setTimeout(() => {
        setAnimateRings(false);
        animateTimer.current = null;
      }, ms);
    },
    [sheetsBusy]
  );

  useEffect(() => {
    if (sheetsBusy && animateTimer.current) {
      clearTimeout(animateTimer.current);
      animateTimer.current = null;
      setAnimateRings(false);
    }
  }, [sheetsBusy]);

  /* ---------- Auth + Firestore (RecentlyEaten) ---------- */
  const foodsIdsRef = useRef([]);
  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    let unsubFoods;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setFoods([]);
        foodsIdsRef.current = [];
        setUserId(null);
        setLoading(false);
        setErr("Not signed in");
        return;
      }
      setUserId(user.uid);

      if (sheetsBusy) {
        setLoading(false);
        return;
      }

      const colRef = collection(db, "users", user.uid, "RecentlyEaten");
      unsubFoods = onSnapshot(
        colRef,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const ids = rows.map((r) => r.id).join("|");
          if (ids !== foodsIdsRef.current.join("|")) {
            foodsIdsRef.current = rows.map((r) => r.id);
            setFoods(rows);
            openAnimWindow(700);
          }
          setErr(null);
          setLoading(false);
        },
        (e) => {
          console.warn("[RecentlyEaten] onSnapshot error:", e);
          setErr(String(e?.message || e));
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubFoods) unsubFoods();
      if (unsubAuth) unsubAuth();
      if (animateTimer.current) {
        clearTimeout(animateTimer.current);
        animateTimer.current = null;
      }
    };
  }, [openAnimWindow, sheetsBusy]);

  /* ---------- AllNeeds/current listener (real-time) ---------- */
  useEffect(() => {
    if (!userId) {
      setNeedsConfig({ colors: null, enabled: null, focus: null });
      return;
    }
    const db = getFirestore();
    const ref = doc(db, "users", userId, "AllNeeds", "current");

    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        const data = snap.data() || {};
        setNeedsConfig({
          colors: data.colors || null,
          enabled: data.enabled || null,
          focus: data.focus || null,
        });
      },
      (e) => console.warn("[AllNeeds/current] onSnapshot error:", e)
    );
    return () => unsub && unsub();
  }, [userId]);

  /* ---------- List item ---------- */
  const onPressFood = useCallback(
    (item) => {
      setCurrentItemId(item.id);
      setCurrentItem(item);
      present("s8");
    },
    [present, setCurrentItem, setCurrentItemId]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPressFood(item)}
        disabled={sheetsBusy}
        style={{
          height: size(80),
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 20,
          width: "90%",
          alignSelf: "center",
          flexDirection: "row",
          marginBottom: height(1),
          opacity: sheetsBusy ? 0.6 : 1,
          backgroundColor: "#fff",
        }}
      >
        <View
          style={{
            alignItems: "center",
            width: size(50),
            borderRadius: size(50) / 2,
            justifyContent: "center",
            height: size(50),
            alignSelf: "center",
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: item.image_cloud_url }}
            style={{ height: "100%", width: "100%" }}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
          />
        </View>

        <View style={{ marginLeft: width(5), width: "90%" }}>
          <Text style={{ fontSize: size(15), fontWeight: "800", width: "70%" }} numberOfLines={1}>
            {item?.items?.[0]?.name ?? "Item"}
          </Text>

          <Text style={{ fontSize: 14, fontWeight: "bold", position: "absolute", right: width(5) }}>
            +{Math.round(Number(item?.items?.[0]?.calories_kcal || 0))} cal
          </Text>

        <Text style={{ color: "#BBC1CB", marginTop: height(0.5) }}>
          {formatLocalTime(
            toDateFromAny(
              item?.created_at ?? item?.timestamp ?? item?.createdAt ?? item?.time ?? item?.date ?? item?.ts
            )
          )}
        </Text>
        </View>
      </TouchableOpacity>
    ),
    [onPressFood, sheetsBusy]
  );

  const keyExtractor = useCallback((item, i) => item?.id ?? String(i), []);

  /* ===== Targets from habitSettings (coffee + cigarettes) ===== */
  const [habitSettings, setHabitSettings] = useState(null);
  useEffect(() => {
    if (!userId) {
      setHabitSettings(null);
      return;
    }
    const db = getFirestore();
    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data();
        setHabitSettings(data?.habitSettings ?? null);
      },
      (e) => console.warn("[habitSettings] onSnapshot error:", e)
    );
    return () => unsub && unsub();
  }, [userId]);

  const coffeeTarget = useMemo(() => {
    const v = habitSettings?.coffeePerDayTarget;
    return Number.isFinite(Number(v)) ? Number(v) : Number(targets?.coffeeCups ?? 0);
  }, [habitSettings, targets]);

  const cigarettesTarget = useMemo(() => {
    const v = habitSettings?.cigarettesPerDayTarget;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [habitSettings]);

  /* ===== Derived numbers for the header ===== */
  const vals = useMemo(() => {
    const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    return {
      caloriesLeft: Math.max(0, n(targets?.calories) - n(today?.caloriesToday)),
      waterLeft: Math.max(0, n(targets?.waterMl) - n(today?.waterToday)),
      coffeeLeft: Math.max(0, n(coffeeTarget) - n(today?.coffeeToday)),
      proteinLeft: Math.max(0, n(targets?.proteinG) - n(today?.proteinToday)),
      carbsLeft: Math.max(0, n(targets?.carbsG) - n(today?.carbsToday)),
      fiberLeft: Math.max(0, n(targets?.fiberG) - n(today?.fiberToday)),
      fatLeft: Math.max(0, n(targets?.fatG) - n(today?.fatToday)),
      satFatLeft: Math.max(0, n(targets?.satFatG) - n(today?.fatToday)),
      sugarLeft: Math.max(0, n(targets?.sugarG) - n(today?.sugarToday)),
      sodiumLeft: Math.max(0, n(targets?.sodiumMg) - n(today?.sodiumToday)),
      cigarettesLeft: Math.max(0, n(cigarettesTarget) - n(today?.cigarettesToday)),
    };
  }, [targets, today, coffeeTarget, cigarettesTarget]);

  // Open animation window when vals change (but not while sleeping)
  useEffect(() => {
    if (sheetsBusy) return;
    if (!prevValsRef.current) {
      prevValsRef.current = vals;
      return;
    }
    const prev = prevValsRef.current;
    const changed = Object.keys(vals).some((k) => vals[k] !== prev[k]);
    if (changed) openAnimWindow(900);
    prevValsRef.current = vals;
  }, [vals, openAnimWindow, sheetsBusy]);

  /* ===== Max values ===== */
  const maxes = useMemo(() => {
    const atLeast1 = (x) => Math.max(1, Number(x ?? 1));
    return {
      calories: atLeast1(targets?.calories),
      waterMl: atLeast1(targets?.waterMl),
      coffeeCups: atLeast1(coffeeTarget),
      proteinG: atLeast1(targets?.proteinG),
      carbsG: atLeast1(targets?.carbsG),
      fiberG: atLeast1(targets?.fiberG),
      fatG: atLeast1(targets?.fatG),
      satFatG: atLeast1(targets?.satFatG),
      sugarG: atLeast1(targets?.sugarG),
      sodiumMg: atLeast1(targets?.sodiumMg),
      cigarettes: atLeast1(cigarettesTarget),
    };
  }, [targets, coffeeTarget, cigarettesTarget]);

  /* ===== Merge Firestore colors ===== */
  const ringColors = useMemo(() => {
    const c = needsConfig.colors || {};
    return {
      ...COLORS,
      protein: c.protein || COLORS.protein,
      carbs: c.carbs || COLORS.carbs,
      fat: c.fat || COLORS.fat,
      fiber: c.fiber || COLORS.fiber,
      sugar: c.sugar || COLORS.sugar,
      sodium: c.sodium || COLORS.sodium,
      coffee: c.coffee || COLORS.coffee,
      cigarette: c.cigarette || COLORS.cigarette,
      cal: c.calories || COLORS.cal,
    };
  }, [needsConfig.colors]);

  const enabledMap = needsConfig.enabled || {};

  return (
    <View style={{ backgroundColor: "#fff", height: "100%", width: "100%" }}>
      <Animated.FlatList
        /* ✅ Sort by time (most recent first) so grouping makes sense */
        data={useMemo(() => {
          const getMs = (it) => {
            const t =
              it?.timestamp ??
              it?.created_at ??
              it?.createdAt ??
              it?.time ??
              it?.date ??
              it?.ts;
            if (!t) return 0;
            if (typeof t === "number") return t > 1e12 ? t : t * 1000;
            if (typeof t === "string") {
              const d = new Date(t);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            }
            if (t?.toDate) {
              try {
                return t.toDate().getTime();
              } catch {}
            }
            if (typeof t === "object" && (t.seconds || t.nanoseconds === 0)) {
              const s = Number(t.seconds || 0) * 1000;
              const ns = Number(t.nanoseconds || 0) / 1e6;
              return s + ns;
            }
            return 0;
          };
          const arr = Array.isArray(foods) ? [...foods] : [];
          arr.sort((a, b) => getMs(b) - getMs(a));
          return arr;
        }, [foods])}
        keyExtractor={keyExtractor}
        /* ✅ Inject relative-date section titles without changing your renderItem */
        renderItem={(props) => {
          const { item, index } = props;

          // Helpers duplicated here to avoid changing anything else
          const getMs = (it) => {
            const t =
              it?.timestamp ??
              it?.created_at ??
              it?.createdAt ??
              it?.time ??
              it?.date ??
              it?.ts;
            if (!t) return 0;
            if (typeof t === "number") return t > 1e12 ? t : t * 1000;
            if (typeof t === "string") {
              const d = new Date(t);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            }
            if (t?.toDate) {
              try {
                return t.toDate().getTime();
              } catch {}
            }
            if (typeof t === "object" && (t.seconds || t.nanoseconds === 0)) {
              const s = Number(t.seconds || 0) * 1000;
              const ns = Number(t.nanoseconds || 0) / 1e6;
              return s + ns;
            }
            return 0;
          };

          const startOfWeekMonday = (d) => {
            const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const day = (dt.getDay() + 6) % 7; // Monday=0
            dt.setDate(dt.getDate() - day);
            dt.setHours(0, 0, 0, 0);
            return dt;
          };

          const labelFor = (ms) => {
            if (!ms) return "Earlier";
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const itemDate = new Date(ms);
            const itemStart = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
            const diffDays = Math.floor((todayStart - itemStart) / 86400000);

            if (diffDays === 0) return "Today";
            if (diffDays === 1) return "Yesterday";

            const thisWeekStart = startOfWeekMonday(now);
            const lastWeekStart = new Date(thisWeekStart);
            lastWeekStart.setDate(thisWeekStart.getDate() - 7);
            const nextWeekStart = new Date(thisWeekStart);
            nextWeekStart.setDate(thisWeekStart.getDate() + 7);

            if (itemDate >= thisWeekStart && itemDate < nextWeekStart) return "This week";
            if (itemDate >= lastWeekStart && itemDate < thisWeekStart) return "Last week";

            const ymNow = now.getFullYear() * 12 + now.getMonth();
            const ymItem = itemDate.getFullYear() * 12 + itemDate.getMonth();
            const mDiff = Math.max(0, ymNow - ymItem);

            if (mDiff === 0) return "Earlier this month";
            if (mDiff === 1) return "1 month ago";
            return `${mDiff} months ago`;
          };

          // Compare to previous item (on the same sorted order)
          const sorted = Array.isArray(foods)
            ? [...foods].sort((a, b) => getMs(b) - getMs(a))
            : [];
          const prev = index > 0 ? sorted[index - 1] : null;
          const label = labelFor(getMs(item));
          const prevLabel = prev ? labelFor(getMs(prev)) : null;

          // 👉 Only show a header when the label changes.
          // Also: if the first group is "Today", do NOT render the "Today" header here
          // (the static "Today" text in the header already covers it).
          // If there are no Today items, the first header will be "Yesterday" / etc.
       const shouldShowHeader =
  index === 0 ? true : label !== prevLabel;


          return (
            <>
              {shouldShowHeader && (
                <Text
                  style={{
                    marginLeft: width(5),
                    fontSize: size(14),
                    marginTop: height(5),
                    marginBottom: height(3),
                    fontWeight: "800",
                  }}
                >
                  {label}
                </Text>
              )}
              {renderItem(props)}
            </>
          );
        }}
        ListHeaderComponent={
          <HeaderView
            userId={userId}
            vals={vals}
            maxes={maxes}
            colorsMap={ringColors}
            enabledMap={enabledMap}
            animateRings={!sheetsBusy && animateRings}
            sleeping={sheetsBusy}
          />
        }
        ListHeaderComponentStyle={{ backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: height(18) }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={4}
        updateCellsBatchingPeriod={80}
        scrollEnabled={!sheetsBusy}
        // 🔑 force re-render when enabled/colors/focus change
        extraData={{
          enabled: needsConfig.enabled,
          colors: needsConfig.colors,
          focus: needsConfig.focus,
        }}
        getItemLayout={(_, index) => {
          const row = size(80) + height(1);
          return { length: row, offset: row * index, index };
        }}
      />
    </View>
  );
}
