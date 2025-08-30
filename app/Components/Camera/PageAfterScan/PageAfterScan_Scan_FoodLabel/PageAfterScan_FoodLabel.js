// ./Cameras/PageAfterScan_FoodLabel.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";

import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import * as LucideIcons from "lucide-react-native";
import { ArrowLeft, Flame } from "lucide-react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import Animated, {
  interpolate,
  Easing as REAEasing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import LoadingPage from "./LoadingPage";

/* ---------------- utils ---------------- */
const toNum = (n, d = 0) => (Number.isFinite(+n) ? +n : d);
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

/** tolerant read of label nutrients (array or object) */
function readLabel(partial) {
  const root =
    partial?.scan_summary?.nutrition_label ??
    partial?.scan_summary?.nutrition ??
    {};

  // normalize array like [{key:'fat_g', value: 12, unit:'g', per: 'serving'}]
  const kv = {};
  const arr = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : null;
  if (arr) {
    arr.forEach((x) => {
      const k = String(x?.key || x?.name || "").toLowerCase().replace(/\s+/g, "_");
      if (!k) return;
      kv[k] = x?.value ?? x?.amount ?? x?.val ?? null;
      if (k === "salt_g" && !kv.sodium_mg && Number.isFinite(+kv[k])) kv.sodium_mg = +kv[k] * 400; // NaCl→Na
    });
  } else if (root && typeof root === "object") {
    Object.entries(root).forEach(([k, v]) => {
      kv[String(k).toLowerCase()] = typeof v === "object" && v
        ? (v.value ?? v.amount ?? v.val ?? v)
        : v;
    });
  }

  // map common keys
  const perServing = {
    calories_kcal: toNum(kv.energy_kcal ?? kv["energy-kcal"] ?? kv.calories ?? kv.kcal, NaN),
    fat_g: toNum(kv.fat_g ?? kv.fat ?? kv.total_fat_g, NaN),
    carbs_g: toNum(kv.carbs_g ?? kv.carbohydrates_g ?? kv.carbohydrate_g ?? kv.carbohydrates, NaN),
    protein_g: toNum(kv.protein_g ?? kv.protein, NaN),
    sugar_g: toNum(kv.sugar_g ?? kv.sugars_g ?? kv.sugar, NaN),
    fiber_g: toNum(kv.fiber_g ?? kv.fibre_g ?? kv.dietary_fiber_g ?? kv.fiber, NaN),
    sodium_mg: toNum(kv.sodium_mg ?? (kv.salt_g ? kv.salt_g * 400 : NaN), NaN),
  };

  const servings = toNum(
    partial?.scan_summary?.servings_per_container ??
      partial?.scan_summary?.servings ??
      kv.servings_per_container,
    1
  ) || 1;

  const ingredientsText =
    partial?.scan_summary?.ingredients_text ??
    partial?.scan_summary?.ingredients?.join(", ") ??
    "";

  return { perServing, servings, ingredientsText };
}

/* very light allergen detector */
const detectAllergens = (text = "") => {
  const t = String(text).toLowerCase();
  const found = new Set();
  const add = (x) => found.add(x);
  if (/(milk|lactose|whey|casein)/.test(t)) add("milk");
  if (/(wheat|gluten|barley|rye|spelt)/.test(t)) add("gluten");
  if (/(egg)/.test(t)) add("egg");
  if (/(soy|soya)/.test(t)) add("soy");
  if (/(peanut)/.test(t)) add("peanut");
  if (/(almond|hazelnut|walnut|pistachio|cashew|pecan)/.test(t)) add("tree nuts");
  if (/(fish|salmon|tuna|cod)/.test(t)) add("fish");
  if (/(shrimp|prawn|crab|lobster|shellfish|mollusc)/.test(t)) add("shellfish");
  if (/(sesame)/.test(t)) add("sesame");
  if (/(mustard)/.test(t)) add("mustard");
  return Array.from(found);
};

/* %DV helpers */
const DV = {
  fat_g: 78,
  carbs_g: 275,
  sugar_g: 50,      // added sugars
  sodium_mg: 2300,
  fiber_g: 28,
};
const pctDV = (val, dv) => (dv ? Math.round((toNum(val) / dv) * 100) : 0);
const tlColor = (p) => (p >= 20 ? "#FE1B20" : p >= 10 ? "#F7931A" : "#00E040");

/* ---------------- Mini ring ---------------- */
function MiniRing({
  value,
  color,
  radius = 40,
  duration = 2000,
  maxValue = 200,
  isS3Open,
  strokeWidth = 16,
}) {
  const progressRef = useRef(null);
  const sv = useSharedValue(0);
  const [display, setDisplay] = useState("0");

  useDerivedValue(() => {
    runOnJS(setDisplay)(String(Math.round(sv.value)));
  }, [sv]);

  const start = useCallback(() => {
    try {
      progressRef.current?.reAnimate?.(0, value, duration);
    } catch {
      progressRef.current?.reAnimate?.();
      progressRef.current?.play?.();
    }
    sv.value = 0;
    sv.value = withTiming(value, { duration, easing: REAEasing.linear });
  }, [value, duration, sv]);

  useEffect(() => {
    start();
  }, [start, isS3Open]);

  const DIAMETER = radius * 2;

  return (
    <View style={{ alignSelf: "center", width: DIAMETER, height: DIAMETER, position: "relative" }}>
      <CircularProgress
        ref={progressRef}
        value={value}
        initialValue={0}
        maxValue={maxValue}
        radius={radius}
        duration={duration}
        activeStrokeColor={color}
        activeStrokeWidth={strokeWidth}
        inActiveStrokeColor="#EFF3F7"
        inActiveStrokeWidth={strokeWidth}
        showProgressValue={false}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: size(18), fontWeight: "800", color: "#000" }}>{display}</Text>
      </View>
    </View>
  );
}

/* -------------- Parallax header sizes -------------- */
const { width: SCREEN_WIDTH, height: SCREEN_H } = Dimensions.get("window");
const IMG_HEIGHT = Math.round(SCREEN_H * 0.35);

/* -------------- %DV bar -------------- */
function DVBar({ label, amtText, percent }) {
  const p = clamp(percent, 0, 100);
  return (
    <View style={{ width: "100%", marginBottom: height(1.6) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: height(0.8) }}>
        <Text style={{ fontWeight: "700" }}>{label}</Text>
        <Text style={{ fontWeight: "700" }}>{p}%</Text>
      </View>
      <View style={{ height: 10, borderRadius: 6, backgroundColor: "#EFF3F7", overflow: "hidden" }}>
        <View style={{ width: `${p}%`, height: "100%", backgroundColor: tlColor(p) }} />
      </View>
      {!!amtText && <Text style={{ color: "#98A1AC", marginTop: height(0.5), fontSize: size(12) }}>{amtText}</Text>}
    </View>
  );
}

export default function PageAfterScan_FoodLabel() {
  const {
    imageUrl, result, list, partial, title,
    calories, protein, carbs, fat, sugar, fiber, sodium,
    scannedAt, formatScannedAt, healthScore,
    alternatives, ingredientsBreakdown,
    scanBusy, // 👈 global flag from context
  } = useScanResults();

  const insets = useSafeAreaInsets();
  const { isS3Open, present, dismiss } = useSheets();

  // Show loader when the sheet opens; it will dismiss when scanBusy flips false.
  const [showLoading, setShowLoading] = useState(true);
  useEffect(() => {
    if (isS3Open) setShowLoading(true);
  }, [isS3Open]);

  // pull from label
  const labelInfo = useMemo(() => readLabel(partial), [partial]);
  const { perServing: labelPer, servings, ingredientsText } = labelInfo;

  // Per-serving ⇄ per-package toggle
  const [portionMode, setPortionMode] = useState("serving");
  const multiplier = portionMode === "package" ? Math.max(1, servings) : 1;

  useEffect(() => {
    console.log("[UI ctx]", { calories, protein, carbs, fat, sugar, fiber, sodium });
    console.log("[UI label]", partial?.scan_summary?.nutrition_label || partial?.scan_summary?.nutrition);
  }, [partial, calories, protein, carbs, fat, sugar, fiber, sodium]);

  // Display numbers prefer label, fallback to context totals
  const dispCalories = Math.round((Number.isFinite(labelPer.calories_kcal) ? labelPer.calories_kcal : toNum(calories)) * multiplier);
  const dispProtein = Math.round(((Number.isFinite(labelPer.protein_g) ? labelPer.protein_g : toNum(protein)) * multiplier) * 10) / 10;
  const dispCarbs  = Math.round(((Number.isFinite(labelPer.carbs_g) ? labelPer.carbs_g : toNum(carbs)) * multiplier) * 10) / 10;
  const dispFat    = Math.round(((Number.isFinite(labelPer.fat_g) ? labelPer.fat_g : toNum(fat)) * multiplier) * 10) / 10;
  const dispSugarG = Math.round(((Number.isFinite(labelPer.sugar_g) ? labelPer.sugar_g : toNum(sugar)) * multiplier) * 10) / 10;
  const dispFiberG = Math.round(((Number.isFinite(labelPer.fiber_g) ? labelPer.fiber_g : toNum(fiber)) * multiplier) * 10) / 10;
  const dispSodiumMg = Math.round(((Number.isFinite(labelPer.sodium_mg) ? labelPer.sodium_mg : toNum(sodium)) * multiplier));

  // Prefer ingredientsBreakdown; fallback to list
  const ingredients = useMemo(() => {
    if (Array.isArray(ingredientsBreakdown) && ingredientsBreakdown.length) {
      return ingredientsBreakdown.map((it) => ({
        name: it?.name,
        subtitle: it?.subtitle || "",
        calories_kcal: Number(it?.calories_kcal || 0) * multiplier,
        icon: it?.icon || "Utensils",
      }));
    }
    return Array.isArray(list)
      ? list.filter(Boolean).map((it) => ({ ...it, calories_kcal: Number(it?.calories_kcal || 0) * multiplier }))
      : [];
  }, [ingredientsBreakdown, list, multiplier]);

  // Allergens
  const allergens = useMemo(() => detectAllergens(ingredientsText), [ingredientsText]);

  const FAB_H = size(58);
  const bottomPad = (insets?.bottom ?? 0) + FAB_H + height(10);

  /* -------- Parallax bits (Reanimated) -------- */
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]) },
      { scale: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [2, 1, 1]) },
    ],
  }));

  const topBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, IMG_HEIGHT * 0.6], [0, 1]),
  }));

  const { width: SCREEN_W } = Dimensions.get("window");

  // right-hand small cards (keep your style)
  const macros = [
    { value: 60, color: "#222", icon: "Heart", iconColorBg: "#fff", IconCOlor: "#000", label: "Health Score", amt: healthScore + "/10" },
    { value: 80, color: "#fff", icon: "Sprout", iconColorBg: "#222", IconCOlor: "#fff", label: "Fiber", amt: dispFiberG + "g" },
    { value: 120, color: "#fff", icon: "Wheat", iconColorBg: "#222", IconCOlor: "#fff", label: "Sugar", amt: dispSugarG + "g" },
    { value: 90, color: "#fff", icon: "Droplet", iconColorBg: "#222", IconCOlor: "#fff", label: "Sodium", amt: (dispSodiumMg / 1000).toFixed(1) + "g" },
  ];

  return (
    <>
      {showLoading ? (
        // 👇 Loader stays until Camera calls endScan() → scanBusy=false
        <LoadingPage isDone={!scanBusy} onDone={() => setShowLoading(false)} />
      ) : (
        <View style={{ height: height(100), backgroundColor: "#fff" }}>
          {/* Fading top bar */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: height(8),
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: "#E9EEF5",
                zIndex: 20,
              },
              topBarAnimatedStyle,
            ]}
            pointerEvents="none"
          >
            <Text style={{ fontSize: size(16), marginTop: height(1), fontWeight: "700" }}>
              Scanned at {formatScannedAt(scannedAt)}
            </Text>
          </Animated.View>

          {/* MAIN SCROLL with Parallax header */}
          <Animated.ScrollView
            onScroll={onScroll}
            ref={scrollRef}
            style={{ height: "100%"}}
            contentContainerStyle={{ backgroundColor: "#fff", paddingBottom: bottomPad }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            overScrollMode="always"
            bounces
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            scrollEventThrottle={16}
          >
            {/* Parallax header image */}
            <Animated.Image
              source={{ uri: imageUrl }}
              style={[{ width: SCREEN_W, height: IMG_HEIGHT }, imageAnimatedStyle]}
              resizeMode="cover"
            />

            {/* Page content */}
            <View style={{ backgroundColor: "#fff" }}>
              <View style={{ width: "100%" }}>
                <Text
                  style={{
                    fontSize: size(16),
                    marginTop: height(4),
                    marginBottom: height(0),
                    marginLeft: width(5),
                    color: "#B4BBC1",
                    fontWeight: "800",
                    width: "85%",
                    lineHeight: height(2.5)
                  }}
                >
                  Edit the detected dish or add ingredients — tap Edit.
                </Text>

                <View style={{ flexDirection: 'row', marginTop: height(4), marginLeft: width(5) }}>
                  <Text style={{ fontSize: size(30), width: "65%", fontWeight: "700" }}>
                    {title}
                  </Text>

                  <TouchableOpacity
                    onPress={() => { present("s6"); }}
                    style={{
                      height: size(40),
                      top: 0,
                      right: width(5),
                      position: 'absolute',
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: size(25),
                      marginRight: width(1)
                    }}>
                    <View style={{flexDirection: 'row'}}>
                      <LucideIcons.Pencil size={18} color={"#000"} strokeWidth={4} />
                      <Text style={{marginLeft: width(2), fontWeight: "700", fontSize: size(16)}}>Edit</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Calories + mini rings + SERVING/PKG TOGGLE */}
                <View style={{ height: height(55) }} pointerEvents="box-none">
                  <Swiper
                    loop={false}
                    showsButtons={false}
                    removeClippedSubviews={false}
                    horizontal
                    index={0}
                    autoplay={false}
                    paginationStyle={{ bottom: height(2) }}
                    dot={<View style={{ backgroundColor: "rgba(0,0,0,0.18)", width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 }}/>}
                    activeDot={<View style={{ backgroundColor: "#000", width: 40, height: 8, borderRadius: 4, marginHorizontal: 4 }}/>}
                  >
                    {/* Slide 1 */}
                    <View>
                      <View
                        style={{
                          width: "90%",
                          marginTop: height(4),
                          borderRadius: 20,
                          alignSelf: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 20,
                          height: height(16),
                          borderWidth: 1,
                          borderColor: "#F1F3F9",
                          backgroundColor: "#fff",
                          ...Platform.select({
                            ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
                            android: { elevation: 5, shadowColor: "#00000050" },
                          }),
                        }}
                      >
                        <Text style={{ fontSize: size(17), fontWeight: "bold", marginLeft: width(5) }}>Calories</Text>

                        {/* toggle */}
                        <View style={{ position: "absolute", right: 14, top: 14, flexDirection: "row", backgroundColor: "#F1F3F9", borderRadius: 12, padding: 4 }}>
                          <TouchableOpacity
                            onPress={() => setPortionMode("serving")}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: portionMode === "serving" ? "#111" : "transparent" }}>
                            <Text style={{ color: portionMode === "serving" ? "#fff" : "#111", fontWeight: "700" }}>Per serving</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => servings > 1 && setPortionMode("package")}
                            disabled={servings <= 1}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, opacity: servings > 1 ? 1 : 0.5, backgroundColor: portionMode === "package" ? "#111" : "transparent" }}>
                            <Text style={{ color: portionMode === "package" ? "#fff" : "#111", fontWeight: "700" }}>
                              Package{servings > 1 ? ` ×${servings}` : ""}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: height(2), marginLeft: width(5) }}>
                          <View style={{ height: size(65), width: size(65), borderRadius: size(65) / 2, justifyContent: "center", alignItems: "center", backgroundColor: "#222" }}>
                            <Flame size={25} strokeWidth={3} color={"#fff"} />
                          </View>
                          <Text style={{ fontSize: size(40), marginLeft: width(3), fontWeight: "700" }}>{dispCalories}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", width: "90%", marginTop: height(-1), alignSelf: "center", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={tileStyle}>
                          <MiniRing value={dispProtein} color="#632EFF" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                          <Text style={tileAmt}>{dispProtein}g</Text>
                          <Text style={tileLabel}>Protein</Text>
                        </View>

                        <View style={tileStyle}>
                          <MiniRing value={dispCarbs} color="#F7931A" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                          <Text style={tileAmt}>{dispCarbs}g</Text>
                          <Text style={tileLabel}>Carbs</Text>
                        </View>

                        <View style={tileStyle}>
                          <MiniRing value={dispFat} color="#0058FF" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                          <Text style={tileAmt}>{dispFat}g</Text>
                          <Text style={tileLabel}>Fat</Text>
                        </View>
                      </View>
                    </View>

                    {/* Slide 2 – %DV quick facts from label */}
                    <View>
                      <View style={cardBig}>
                        <Text style={{ fontSize: size(17), fontWeight: "bold", marginBottom: height(1.5) }}>
                          % Daily Values ({portionMode === "package" ? "per package" : "per serving"})
                        </Text>

                        <DVBar label="Total Fat"       percent={pctDV(dispFat, DV.fat_g)}       amtText={`${dispFat}g of ${DV.fat_g}g`} />
                        <DVBar label="Carbohydrates"   percent={pctDV(dispCarbs, DV.carbs_g)}   amtText={`${dispCarbs}g of ${DV.carbs_g}g`} />
                        <DVBar label="Sugar"           percent={pctDV(dispSugarG, DV.sugar_g)}  amtText={`${dispSugarG}g of ${DV.sugar_g}g`} />
                        <DVBar label="Sodium"          percent={pctDV(dispSodiumMg, DV.sodium_mg)} amtText={`${(dispSodiumMg/1000).toFixed(1)}g of ${(DV.sodium_mg/1000).toFixed(1)}g`} />
                        <DVBar label="Fiber"           percent={pctDV(dispFiberG, DV.fiber_g)}  amtText={`${dispFiberG}g of ${DV.fiber_g}g`} />
                      </View>
                    </View>
                  </Swiper>
                </View>

                {/* Allergens from label */}
                {allergens.length > 0 && (
                  <>
                    <Text style={{ marginTop: height(3), fontSize: size(18), fontWeight: "bold", marginLeft: width(5) }}>Allergens</Text>
                    <FlatList
                      data={allergens}
                      keyExtractor={(it, i) => `${it}-${i}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: width(5), paddingTop: height(1) }}
                      renderItem={({ item }) => {
                        const Icon =
                          item === "milk" ? LucideIcons.Milk :
                          item === "gluten" ? LucideIcons.Wheat :
                          item === "egg" ? LucideIcons.Egg :
                          item === "soy" ? LucideIcons.Sprout :
                          item.includes("nut") ? LucideIcons.Nut :
                          item === "fish" ? LucideIcons.Fish :
                          LucideIcons.AlertTriangle;
                        return (
                          <View style={chipStyle}>
                            <Icon size={16} color={"#000"} style={{ marginRight: 6 }} />
                            <Text style={{ fontWeight: "700" }}>{item}</Text>
                          </View>
                        );
                      }}
                    />
                  </>
                )}

                {/* Totals */}
                <Text style={{ marginTop: height(2), fontSize: size(18), fontWeight: "bold", marginLeft: width(5) }}>
                  Total meal calories
                </Text>

                {/* Ingredients / components list */}
                <FlatList
                  data={ingredients}
                  keyExtractor={(item, i) => `${item?.name || "item"}-${i}`}
                  scrollEnabled={false}
                  contentContainerStyle={{ paddingBottom: height(1) }}
                  renderItem={({ item }) => {
                    const IconComp = (item?.icon && LucideIcons[item.icon]) || LucideIcons.Utensils;
                    return (
                      <View style={{ width: "90%", marginLeft: width(5), marginTop: height(5), alignSelf: "center", alignItems: "center", flexDirection: "row" }}>
                        <View style={{ width: size(35), height: size(35), borderRadius: size(35) / 2, justifyContent: "center", alignItems: "center", backgroundColor: "#000", marginRight: width(5) }}>
                          <IconComp size={16} color={"#fff"} strokeWidth={3} />
                        </View>
                        <View>
                          <Text style={{ fontSize: size(16), fontWeight: "bold" }}>{item?.name || "Item"}</Text>
                          {!!item?.subtitle && (
                            <Text style={{ fontSize: size(13), marginTop: height(0.5), fontWeight: "bold", color: "#BCC1CA" }}>
                              {item.subtitle}
                            </Text>
                          )}
                        </View>
                        <Text style={{ position: "absolute", right: width(5), color: "#FE1B20", fontSize: size(16), fontWeight: "700" }}>
                          +{Math.round(Number(item?.calories_kcal || 0))} cal
                        </Text>
                      </View>
                    );
                  }}
                />

                {/* Alternatives */}
                <Text style={{ marginTop: height(7), fontSize: size(18), fontWeight: "bold", marginLeft: width(5) }}>
                  Alternatives
                </Text>

                <FlatList
                  data={alternatives}
                  keyExtractor={(item, i) => String(i)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: width(5), paddingTop: height(2), paddingBottom: height(2) }}
                  renderItem={({ item }) => (
                    <View style={{ width: 150, marginRight: width(4), alignItems: "center" }}>
                      <View style={altCard}>
                        <Text numberOfLines={2} style={{ fontSize: size(15), textAlign: "center", fontWeight: "bold", marginTop: height(1) }}>
                          {item.name}
                        </Text>
                        <Text style={{ position: 'absolute', bottom: height(8), fontSize: size(20), fontWeight: "bold", color: item.calories_diff < 0 ? "#00E040" : "#FE1B20" }}>
                          {item.calories_diff}cal
                        </Text>
                        <Text style={{ fontSize: size(14), position: 'absolute', bottom: height(2), fontWeight: "bold" }}>
                          {item.calories_diff < 0 ? "less" : "more"}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            </View>
          </Animated.ScrollView>

          {/* FLOATING BACK PILL */}
          <TouchableOpacity
            onPress={() => {
              dismiss?.('s3');
              setTimeout(() => dismiss?.('s2'), 1);
            }}
            style={{
              alignSelf: "flex-end",
              height: size(58),
              position: "absolute",
              borderRadius: 18,
              backgroundColor: "#151515",
              paddingHorizontal: size(40),
              bottom: height(13),
              justifyContent: "center",
              flexDirection: "row",
              alignItems: "center",
              marginRight: width(5),
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6.65,
              elevation: 12,
              zIndex: 1000,
            }}
          >
            <ArrowLeft size={20} color={"#fff"} style={{ marginRight: width(2) }} />
            <Text style={{ color: "#fff", fontSize: size(17), fontWeight: "bold" }}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

/* ---- local styles reused to keep your look ---- */
const cardBig = {
  width: "90%",
  marginTop: height(4),
  borderRadius: 20,
  alignSelf: "center",
  paddingHorizontal: 20,
  paddingVertical: 20,
  borderWidth: 1,
  borderColor: "#F1F3F9",
  backgroundColor: "#fff",
  ...Platform.select({
    ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
    android: { elevation: 2, shadowColor: "#00000050" },
  }),
};

const tileStyle = {
  width: "31%",
  height: height(20),
  marginTop: height(4),
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
};
const tileAmt = { fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" };
const tileLabel = { fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" };

const chipStyle = {
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "#F1F3F9",
  backgroundColor: "#fff",
  marginRight: 10,
  flexDirection: "row",
  alignItems: "center",
  ...Platform.select({
    ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 6 },
    android: { elevation: 1, shadowColor: "#00000030" },
  }),
};

const altCard = {
  width: "100%",
  height: height(20),
  marginTop: height(4),
  borderRadius: 20,
  paddingHorizontal: 20,
  paddingVertical: 20,
  borderWidth: 1,
  borderColor: "#F1F3F9",
  backgroundColor: "#fff",
  alignItems: "center",
  ...Platform.select({
    ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
    android: { elevation: 2, shadowColor: "#00000050" },
  }),
};

const styles = StyleSheet.create({});
