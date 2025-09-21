// ./Cameras/PageAfterScan.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
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

















/* ---------------- Mini ring (kept for later use) ---------------- */
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
 
  const {
expirationDate, setExpirationDate
  } = useScanResults()





  



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

/* ========= Wrapper to force a clean remount after Fast Refresh ========= */
const REFRESH_TOKEN = __DEV__ ? String(Date.now()) : "stable";






















function getExpirationColor(expirationDate) {
  if (!expirationDate) return "#00CE39"; // default green if nothing

  const now = new Date();
  const exp = new Date(expirationDate);

  // difference in days
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) {
    return "#FE1B20"; // 🔴 red if 3 days or less
  } else if (diffDays <= 7) {
    return "#FF8C03"; // 🟠 orange if within a week
  } else {
    return "#00CE39"; // 🟢 green otherwise
  }
}


// expiryMeta.js
 function getExpiryMeta(isoDate) {
  const COLORS = {
    green: "#00CE39",
    orange: "#FF8C03",
    red: "#FE1B20",
  };

  if (!isoDate) {
    return {
      color: COLORS.green,
      value: 0,
      maxValue: 100,
      human: "No date",
      daysLeft: null,
      expired: false,
    };
  }

  // normalize to midnight to avoid off-by-one during the day
  const today = new Date();
  const now = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const exp = new Date(isoDate);
  const expUTC = new Date(Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate()));

  const ms = expUTC.getTime() - now.getTime();
  const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;

  // color rules
  let color = COLORS.green;
  if (expired || daysLeft <= 3) color = COLORS.red;
  else if (daysLeft <= 7) color = COLORS.orange;

  // choose a progress window that makes sense
  let maxValue = 730; // default 2 years
  if (daysLeft <= 7) maxValue = 7;
  else if (daysLeft <= 30) maxValue = 30;
  else if (daysLeft <= 365) maxValue = 365;

  const value = Math.max(0, Math.min(daysLeft, maxValue));

  // humanized left (approx months=30d)
  const absDays = Math.abs(daysLeft);
  const years = Math.floor(absDays / 365);
  const months = Math.floor((absDays % 365) / 30);
  const days = absDays % 30;

  const parts = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}mo`);
  if (days || parts.length === 0) parts.push(`${days}d`);

  const human = expired ? `Expired ${parts.join(" ")} ago`
                        : `in ${parts.join(" ")}`;

  return { color, value, maxValue, human, daysLeft, expired };
}




export default function PageAfterScan_Add_To_Inventory(props) {
  return <InnerPageAfterScan key={REFRESH_TOKEN} {...props} />;
}



/* ===================== Actual screen component ===================== */
function InnerPageAfterScan() {
  const {
    imageUrl,
    cloudUrl,
    result,
    list,
    title,
    calories,
    protein,
    carbs,
    fat,
    sugar,
    fiber,
    sodium,
    scannedAt,
    formatScannedAt,
    healthScore,
    // from context (may be "")
    expirationDate,
    setExpirationDate,
    expirationDateNote,
  } = useScanResults();

  const insets = useSafeAreaInsets();
  const { isS3Open, present, dismiss } = useSheets();
  const { color, value, maxValue, human } = getExpiryMeta(expirationDate);
  const {currentItemId, setCurrentItemId} = useCurrentScannedItemId()


  const [expiryColor, setExpiryColor] = useState("#00CE39");


  /* ---------------- readiness flags ---------------- */
  // model signals "ready" explicitly
  const isReady = !!(result && result._ready === true);
  // keep loader visible until it animates to 100% and calls onDone
  const [showLoader, setShowLoader] = useState(true);

  // when the sheet opens, always show the loader first
  useEffect(() => {
    if (isS3Open) setShowLoader(true);
  }, [isS3Open]);

  // when result becomes ready, do NOT hide immediately; let LoadingPage finish to 100 then call onDone -> we hide
  const handleLoaderDone = useCallback(() => {
    setShowLoader(false);
  }, []);

  /* -------- Parallax bits (Reanimated) -------- */
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

// anywhere



 useEffect(() => {
    if (expirationDate) {
      setExpiryColor(getExpirationColor(expirationDate));
    }
  }, [expirationDate]);







  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  const topBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, IMG_HEIGHT * 0.6], [0, 1]),
    };
  });

  const scannedPretty =
    typeof formatScannedAt === "function" ? formatScannedAt(scannedAt) : "";

  /* ---------- prefer refined numbers from result when present ---------- */
  const pickNumber = (...vals) => {
    for (const v of vals) if (typeof v === "number" && Number.isFinite(v) && v !== 0) return v;
    for (const v of vals) if (typeof v === "number" && Number.isFinite(v)) return v;
    return 0;
  };

  const kcalSafe    = Math.max(0, Math.round(pickNumber(result?.calories_kcal_total, calories)));
  const proteinSafe = Math.max(0, Math.round(pickNumber(result?.protein_g,           protein)));
  const carbsSafe   = Math.max(0, Math.round(pickNumber(result?.carbs_g,            carbs)));
  const fatSafe     = Math.max(0, Math.round(pickNumber(result?.fat_g,              fat)));

  // ---------- Expiration note (model fallbacks) ----------
  const expiryNote = useMemo(() => {
    const n1 = typeof expirationDateNote === "string" ? expirationDateNote.trim() : "";
    const n2 = typeof result?.expiration_hint === "string" ? result.expiration_hint.trim() : "";
    const n3 = typeof result?.experationDateNote === "string" ? result.experationDateNote.trim() : "";
    return n1 || n2 || n3 || "";
  }, [expirationDateNote, result]);

  const expiryISO = useMemo(() => {
    return (
      (typeof expirationDate === "string" && expirationDate) ||
      (typeof result?.expiration_iso === "string" && result.expiration_iso) ||
      (typeof result?.expirationDate === "string" && result.expirationDate) ||
      (typeof result?.experationDate === "string" && result.experationDate) ||
      ""
    );
  }, [expirationDate, result]);

  /* ---------- items to render ---------- */
  const items = useMemo(() => {
    if (Array.isArray(list) && list.length) return list;
    if (Array.isArray(result?.items))
      return result.items.map((it) => ({
        name: it?.name || "Item",
        subtitle: it?.subtitle || "",
        calories_kcal: Number.isFinite(it?.calories_kcal) ? it.calories_kcal : 0,
        icon: it?.icon || "Utensils",
      }));
    return [];
  }, [list, result]);

  // Prefer list from context; if empty, show model items
  const alts = Array.isArray(result?.alternatives) ? result.alternatives : [];

  /* ---------- LOADING GATE ---------- */
  // Keep showing the LoadingPage while `showLoader` is true.
  // When `isReady` flips true, we pass it to LoadingPage; it finishes 90→100 and calls onDone -> we hide.
  if (showLoader) {
    return (
      <LoadingPage
        messages={[
          "Taking snapshot",
          "Analyzing nutrition",
          "Saving to Inventory",
        ]}
        isDone={isReady}
        onDone={handleLoaderDone}
      />
    );
  }






  




  /* ---------- MAIN UI ---------- */
  return (
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
        {!!scannedPretty && (
          <Text style={{ fontSize: size(16), marginTop: height(1), fontWeight: "700" }}>
            Scanned at {scannedPretty}
          </Text>
        )}
      </Animated.View>

      {/* MAIN SCROLL with Parallax header */}
      <Animated.ScrollView
        onScroll={onScroll}
        ref={scrollRef}
        style={{ height: "100%" }}
        contentContainerStyle={{
          backgroundColor: "#fff",
          paddingBottom: (insets?.bottom ?? 0) + size(58) + height(10),
        }}
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
          source={{ uri: imageUrl || cloudUrl }}
          style={[
            {
              width: SCREEN_WIDTH,
              height: IMG_HEIGHT,
            },
            imageAnimatedStyle,
          ]}
          resizeMode="cover"
        />

        {/* Page content */}
        <View style={{ backgroundColor: "#fff" }}>
          <View style={{ width: "100%" }}>
            {/* Saved pill */}
            <View
              style={{
                alignSelf: "flex-start",
                marginLeft: width(5),
                marginTop: height(2),
                backgroundColor: "#fff",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#F1F3F9",
                   ...Platform.select({
                ios: {
                shadowColor: "#444",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.02,
                shadowRadius: 10,
                }}
              )
              }}
            >
              <LucideIcons.CheckCircle2 size={16} color="#0057FF" />
              <Text style={{ marginLeft: 8, fontWeight: "800", color: "#0057FF" }}>
                Saved to inventory
              </Text>
            </View>

            {/* -------- EXPIRATION NOTE BANNER (TOP) -------- */}
            {!!expiryNote && (
              <View style={styles.expiryBanner}>
                <LucideIcons.Info size={16} color="#A6B0B8" />
                <Text style={styles.expiryBannerText}>
                 Tip for finding the expiration date: {expiryNote}
                 
                </Text>
              </View>
            )}

            {/* Title + timestamp */}
            <Text
              style={{
                fontSize: size(28),
                fontWeight: "800",
                color: "#111",
                marginTop: height(1),
                marginLeft: width(5),
                marginRight: width(5),
              }}
              numberOfLines={2}
            >
              {title}
            </Text>
            {!!scannedPretty && (
              <Text
                style={{
                  marginTop: 6,
                  marginLeft: width(5),
                  color: "#98A2B3",
                  fontWeight: "600",
                }}
              >
                Added {scannedPretty}
              </Text>
            )}


       

            {
              expirationDate == null  ||  expirationDate == ""

              ?

      
            <TouchableOpacity 
             onPress={() => present("s5")}
            style={{
              width: "90%",
              height: size(50),
              borderWidth: 1,
              borderStyle: "dashed",
             borderColor: "#000",
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              marginTop: height(4),
              marginBottom: height(2),
            }}>
              <Text style={{
                color: '#000',
                fontSize: size(16),
                fontWeight: "bold",
                alignSelf: 'center',
              }}>
               + Add Expiration Date
              </Text>
            </TouchableOpacity>

            :


          <View style={{
            width: "90%",
            marginLeft: width(5),
            marginTop: height(2),
            flexDirection: 'row',
            marginBottom: height(1),
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: "#f2f2f2",
            borderRadius: 20,
            height: height(10),
              ...Platform.select({
            ios: {
            shadowColor: "#444",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.02,
            shadowRadius: 10,
      },
          })
          }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: expiryColor }}>
          Expiring in {human.replace(/^in /, "")}
        </Text>

        <View style={{
         marginLeft: width(4)
        }}>

          <CircularProgress
          value={value}
          maxValue={maxValue}
          radius={15}
          duration={1200}
          showProgressValue={false}
         // progressValueColor={"#000"}
          activeStrokeColor={color}
          activeStrokeWidth={5}
          inActiveStrokeWidth={5}
          inActiveStrokeOpacity={0.2}
          titleColor={"#9aa3af"}
          titleStyle={{ fontWeight: "700" }}
        />
        </View>

        </View>

        

}






            {/* Macro strip */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: width(5),
                marginTop: height(2),
              }}
            >
              {/* Big kcal card */}
              <View style={[styles.metricCardBig, styles.cardShadowDark]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.metricIconCircleDark}>
                    <Flame size={18} color="#111" />
                  </View>
                  <Text style={{ fontWeight: "800", color: "#fff" }}>Calories</Text>
                </View>
                <Text style={{ fontSize: size(22), fontWeight: "800", color: "#fff" }}>
                  {kcalSafe}
                  <Text style={{ fontSize: size(14), fontWeight: "700", color: "#D1D5DB" }}>
                    {" "}
                    kcal
                  </Text>
                </Text>
              </View>

              {/* Protein */}
              <View style={[styles.metricCard, styles.cardShadow]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.metricIconCircleLight}>
                    <LucideIcons.Dumbbell size={16} color="#111" />
                  </View>
                  <Text style={{ fontWeight: "800", color: "#111" }}>Protein</Text>
                </View>
                <Text style={styles.metricValueText}>
                  {proteinSafe}
                  <Text style={styles.metricUnitText}> g</Text>
                </Text>
              </View>

              {/* Carbs */}
              <View style={[styles.metricCard, styles.cardShadow]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.metricIconCircleLight}>
                    <LucideIcons.Wheat size={16} color="#111" />
                  </View>
                  <Text style={{ fontWeight: "800", color: "#111" }}>Carbs</Text>
                </View>
                <Text style={styles.metricValueText}>
                  {carbsSafe}
                  <Text style={styles.metricUnitText}> g</Text>
                </Text>
              </View>
            </View>

            {/* Single metric row */}
            <View style={[styles.singleMetricRow, styles.cardShadow]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.metricIconCircleLight}>
                  <LucideIcons.Droplets size={16} color="#111" />
                </View>
                <Text style={{ fontWeight: "800", color: "#111" }}>Fat</Text>
              </View>
              <Text style={{ fontSize: size(22), fontWeight: "800", color: "#111" }}>
                {fatSafe}
                <Text style={styles.metricUnitText}> g</Text>
              </Text>
            </View>

            {/* ============== Items detected ============== */}
            {items.length > 0 && (
              <View style={[styles.section, styles.cardShadow]}>
                <Text style={styles.sectionTitle}>Detected items</Text>
                {items.map((it, ix) => (
                  <View key={`it-${ix}`} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{it?.name || "Item"}</Text>
                      {!!it?.subtitle && (
                        <Text style={styles.itemMeta}>{it.subtitle}</Text>
                      )}
                    </View>
                    <Text style={styles.itemKcal}>
                      {Math.max(0, Math.round(it?.calories_kcal || 0))} kcal
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* ============== Alternatives ============== */}
            {alts.length > 0 && (
              <View style={[styles.section, styles.cardShadow]}>
                <Text style={styles.sectionTitle}>Alternatives</Text>
                {alts.map((a, ix) => (
                  <View key={`alt-${ix}`} style={styles.row}>
                    <Text style={[styles.itemName, { flex: 1 }]}>{a?.name}</Text>
                    <Text style={[styles.itemKcal, { color: a?.calories_diff < 0 ? "#0A7F2E" : "#8A0914" }]}>
                      {a?.calories_diff > 0 ? `+${a.calories_diff}` : a?.calories_diff} kcal
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Package/health */}
            <View style={[styles.packageCard, styles.cardShadow]}>
              <Text style={{ fontWeight: "800", fontSize: size(16), marginBottom: 10 }}>
                Package
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                {Number.isFinite(healthScore) && (
                  <View style={styles.chip}>
                    <LucideIcons.Heart size={14} color="#111" />
                    <Text style={{ marginLeft: 6, fontWeight: "700", color: "#111" }}>
                      Health {Math.max(0, Math.min(10, Math.round(healthScore)))} / 10
                    </Text>
                  </View>
                )}
                {!!expiryISO && (
                  <View style={styles.chip}>
                    <LucideIcons.Calendar size={14} color="#111" />
                    <Text style={{ marginLeft: 6, fontWeight: "700", color: "#111" }}>
                      Best before {expiryISO}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Actions */}
            <View style={{ paddingHorizontal: width(5), marginTop: height(3), marginBottom: height(2) }}>
             {/* <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={() => present("s6")}
              >
                <LucideIcons.Pencil size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: size(16) }}>
                  Edit item
                </Text>
              </TouchableOpacity>*/}
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* FLOATING BACK PILL */}
      <TouchableOpacity
        onPress={() => {
          dismiss?.("s3");
        }}
        style={styles.backPill}
      >
        <ArrowLeft size={20} color={"#fff"} style={{ marginRight: width(2) }} />
        <Text style={{ color: "#fff", fontSize: size(17), fontWeight: "bold" }}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: Platform.select({
    ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
    android: { elevation: 2, shadowColor: "#00000050" },
  }),
  cardShadowDark: Platform.select({
    ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
    android: { elevation: 2, shadowColor: "#00000050" },
  }),

  metricCardBig: {
    width: "38%",
    height: height(12),
    borderRadius: 18,
    backgroundColor: "#111",
    padding: 16,
    marginRight: 8,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#F1F3F9",
  },
  metricCard: {
    width: "32%",
    height: height(12),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    padding: 14,
    justifyContent: "space-between",
  },
  metricIconCircleDark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  metricIconCircleLight: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2F4F8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  metricValueText: { fontSize: size(20), fontWeight: "800", color: "#111" },
  metricUnitText: { fontSize: size(14), fontWeight: "700", color: "#98A2B3" },

  singleMetricRow: {
    width: "90%",
    alignSelf: "center",
    marginTop: height(2),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  /* New sections */
  section: {
    width: "90%",
    alignSelf: "center",
    marginTop: height(2.5),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    padding: 16,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: size(16),
    marginBottom: 10,
    color: "#111",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFEFEF",
  },
  itemName: { fontWeight: "800", color: "#111" },
  itemMeta: { color: "#8E99A8", fontWeight: "700", marginTop: 2 },
  itemKcal: { fontWeight: "800", color: "#111" },

  packageCard: {
    width: "90%",
    alignSelf: "center",
    marginTop: height(2.5),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    padding: 16,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F7F9FC",
    marginRight: 8,
    marginBottom: 8,
  },

  ctaPrimary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  // NEW: Expiration tip banner styling
  expiryBanner: {
    marginTop: height(1.5),
     marginBottom: height(1.5),
    marginLeft: width(5),
    marginRight: width(5),
    paddingHorizontal: 12,
     borderWidth: 1,
    borderColor: "#F1F3F9",
    paddingVertical: 10,
    borderRadius: 12,
   // backgroundColor: "#F1F3F9",
    flexDirection: "row",
    alignItems: "center",
  },
  expiryBannerText: {
    marginLeft: 8,
    color: "#222",
    fontWeight: "700",
    flex: 1,
  },

  backPill: {
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
  },
});
