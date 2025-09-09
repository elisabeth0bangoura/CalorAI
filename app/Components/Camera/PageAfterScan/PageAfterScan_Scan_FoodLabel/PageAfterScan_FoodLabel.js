// ./Cameras/ScanFood_PageAfterScan.js
import * as LucideIcons from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import LoadingPage from "./LoadingPage";

/* ---------- Collapsing header sizes ---------- */
const HEADER_MAX_HEIGHT = height(45);
const HEADER_MIN_HEIGHT = height(2);
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

/* ---------- Helpers ---------- */
const sText = (v, d = "") => (typeof v === "string" ? v : d);
const sNum  = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

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

/* ---------- Shallow gate for snapshot ---------- */
function changedSubset(a, b) {
  if (!a || !b) return true;
  const keys = [
    "title","brand","image_cloud_url",
    "calories_kcal_total","protein_g","carbs_g","fat_g",
    "fiber_g","sugar_g","sodium_mg","health_score"
  ];
  for (const k of keys) if (a[k] !== b[k]) return true;
  const alA = a?.alternatives?.other_brands?.length ?? 0;
  const alB = b?.alternatives?.other_brands?.length ?? 0;
  if (alA !== alB) return true;
  const ingA = a?.ingredients_full?.length ?? 0;
  const ingB = b?.ingredients_full?.length ?? 0;
  if (ingA !== ingB) return true;
  return false;
}

/* =================== PAGE =================== */
function PageAfterScan_FoodLabel() {
  const { currentItemId, currentItem, setCurrentItem } = useCurrentScannedItemId();
  const { isS3Open, present } = useSheets();
    const {
      scanBusy, // 👈 global flag from context
    } = useScanResults();



      // Show loader when the sheet opens; it will dismiss when scanBusy flips false.
  const [showLoading, setShowLoading] = useState(true);
  useEffect(() => {
    if (isS3Open) setShowLoading(true);
  }, [isS3Open]);


  const { width: screenW } = useWindowDimensions();

  const [ringBump, setRingBump] = useState(0);
  const [page, setPage] = useState(0);
  const pagerX = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (isS3Open) setRingBump((b) => b + 1); }, [isS3Open]);

  const p = currentItem?.protein_g ?? 0;
  const c = currentItem?.carbs_g ?? 0;
  const f = currentItem?.fat_g ?? 0;
  const prevVals = useRef({ p, c, f });
  useEffect(() => {
    const changed = p !== prevVals.current.p || c !== prevVals.current.c || f !== prevVals.current.f;
    if (changed && isS3Open) setRingBump((b) => b + 1);
    prevVals.current = { p, c, f };
  }, [p, c, f, isS3Open]);

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




    const lastSnapRef = useRef(null);
  /* Firestore */
  useEffect(() => {
  if (!isS3Open) return;            // ✅ only listen when the sheet is open

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

      const title = sText(d.title, "Scanned meal");
      const brand = sText(d.brand, "");
      const caloriesTotal = Number.isFinite(sNum(d.calories_kcal_total, NaN))
        ? sNum(d.calories_kcal_total, NaN)
        : null;

      const ingredients = Array.isArray(d.ingredients_full) ? d.ingredients_full : [];
      const ingredientCards = ingredients.map((ing) => {
        const kcal = Number.isFinite(sNum(ing?.estimated_kcal, NaN)) ? sNum(ing?.estimated_kcal, 0) : 0;
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
      const ingredients_kcal_remaining =
        Number.isFinite(caloriesTotal) ? Math.max(0, caloriesTotal - ingredients_kcal_sum) : null;

      let alternativesCards = [];
      if (Array.isArray(d.alternatives_flat)) {
        alternativesCards = d.alternatives_flat.map((p) => ({
          label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")]
            .filter(Boolean).join(" "),
          amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN))
            ? `${sNum(p?.calories_per_package_kcal, 0)}cal`
            : "—",
          moreOrLess: p?.bucket === "lower" ? "less" : p?.bucket === "higher" ? "more" : "similar",
        }));
      } else if (d.alternatives && (Array.isArray(d.alternatives.same_brand) || Array.isArray(d.alternatives.other_brands))) {
        const mix = [
          ...(Array.isArray(d.alternatives.same_brand) ? d.alternatives.same_brand : []),
          ...(Array.isArray(d.alternatives.other_brands) ? d.alternatives.other_brands : []),
        ];
        alternativesCards = mix.map((p) => ({
          label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")]
            .filter(Boolean).join(" "),
          amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN))
            ? `${sNum(p?.calories_per_package_kcal, 0)}cal`
            : "—",
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

      setCurrentItem({
        ...d,
        title,
        brand,
        calories_kcal_total: caloriesTotal,
        ingredientCards,
        alternativesCards,
        items: itemsSafe,
        ingredients_kcal_sum,
        ingredients_kcal_remaining,
      });
    },
    (err) => console.log("[onSnapshot] error:", err?.message || err)
  );

  return () => {
    unsub();
    lastSnapRef.current = null;     // reset cache when closing/unsubscribing
  };
}, [isS3Open, currentItemId, setCurrentItem]);





  /* Bump keys for page 1 rings */
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

  /* Little cards data (now with ring config) */
  const littleCards = useMemo(
    () => [
      { key: "fiber",  label: "Fiber",  amt: `${sNum(currentItem?.fiber_g, 0)}g`,     value: sNum(currentItem?.fiber_g, 0),  max: 30,   color: "#22C55E" },
      { key: "sugar",  label: "Sugar",  amt: `${sNum(currentItem?.sugar_g, 0)}g`,     value: sNum(currentItem?.sugar_g, 0),  max: 50,   color: "#F7931A" },
      { key: "sodium", label: "Sodium", amt: `${sNum(currentItem?.sodium_mg, 0)}g`,   value: sNum(currentItem?.sodium_mg, 0),max: 2300, color: "#0058FF" },
    ],
    [currentItem?.fiber_g, currentItem?.sugar_g, currentItem?.sodium_mg]
  );



  console.log({
    alternativesCards: currentItem?.alternatives?.other_brands
  })



  // ===== put these once (top of the file) =====
const MORE_COLOR = "#EF4444";    // red
const LESS_COLOR = "#22C55E";    // green
const SIMILAR_COLOR = "#000"; // gray

// ===== Alternatives FlatList =====




  return (
  <>

  {showLoading ? (
  // 👇 Loader stays until Camera calls endScan() → scanBusy=false
  <LoadingPage isDone={!scanBusy} onDone={() => setShowLoading(false)} />
  
  ) : (


    <View style={{ height: height(100), backgroundColor: "#fff" }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT - 32, paddingBottom: height(15) }}
        scrollEventThrottle={16}
        onScroll={onVerticalScroll}
        removeClippedSubviews
      >
        {/* Title + Edit */}
        <View style={{ width: "100%" }}>
          <Text style={styles.helperText}>Edit the detected dish or add ingredients — tap Edit.</Text>

          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{currentItem?.title}</Text>

            <TouchableOpacity onPress={() => { present("s6"); }} style={styles.editBtn}>
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
                <Text style={styles.caloriesLabel}>Calories</Text>
                <View style={styles.caloriesRow}>
                  <View style={styles.flameWrap}>
                    <LucideIcons.Flame size={25} strokeWidth={3} color={"#fff"} />
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
                    active={isS3Open}
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
                    active={isS3Open}
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
                    active={isS3Open}
                    bumpKey={`fat-${ringBump}`}
                  />
                  <Text style={styles.amtText}>{f}g</Text>
                  <Text style={styles.capText}>Fat</Text>
                </View>
              </View>
            </View>

            {/* Page 2 — 90% card + THREE little cards with rings */}
            <View style={{ width: screenW }}>
              {/* 90% wide first row */}
              <View style={styles.bigMetricCard}>
                <Text style={styles.caloriesLabel}>Health Score</Text>
                <View style={styles.caloriesRow}>
                  <View style={styles.bigIconWrap}>
                    <LucideIcons.Heart size={25} strokeWidth={3} color={"#fff"} />
                  </View>
                  <Text style={styles.caloriesValue}>{sNum(currentItem?.health_score, 0)}</Text>
                  <Text style={{ fontSize: size(20), fontWeight: "700", marginLeft: width(1) }}>/10</Text>
                </View>
              </View>

              {/* Little cards row (three across) */}
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
                      active={isS3Open}
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

        {/* Totals */}
        <Text style={styles.totalsHeader}>Total meal calories</Text>

        {/* Ingredients list */}
        <FlatList
          style={{ marginTop: height(4) }}
          data={currentItem?.ingredientCards}
          keyExtractor={(_, i) => String(i)}
          removeClippedSubviews
          initialNumToRender={4}
          windowSize={5}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={24}
          scrollEnabled={false}
          contentContainerStyle={{ width: "90%", alignSelf: "center", marginTop: height(1), paddingBottom: height(1) }}
          renderItem={({ item }) => {
            const IconComponent = LucideIcons.Utensils;
            return (
              <View style={{ height: size(90), width: "100%" }}>
                <View style={{ flexDirection: "row", alignItems: 'center' }}>
                
                    <IconComponent style={{
                      marginLeft: width(5)
                    }} size={16} color={"#000"} />
                 
                  <Text style={{
                    width: "50%",  fontSize: size(16), color: "#000", fontWeight: "800", marginLeft: width(5)
                  }}>{item?.label}</Text>
                  <Text style={{
                    color: "#000", right: width(2), position: "absolute", fontWeight: "800", fontSize: size(16)
                  }}>{item?.amt ?? "+0 cal"}</Text>
                </View>
              </View>
            );
          }}
        />

        {/* Alternatives header */}
        <Text style={[styles.totalsHeader, { marginTop: height(1) }]}>Alternatives</Text>



<FlatList horizontal={true}
  style={{ width: "100%", paddingLeft: width(5), paddingTop: height(4), paddingBottom: height(2) }}
  data={
    Array.isArray(currentItem?.alternatives?.other_brands)
      ? currentItem.alternatives.other_brands
      : []
  }
  keyExtractor={(item, i) => `alt-${item?.code || item?.name || i}`}
  removeClippedSubviews
  initialNumToRender={4}
  windowSize={5}
  maxToRenderPerBatch={4}
  contentContainerStyle={{ paddingRight: width(5) }}
  updateCellsBatchingPeriod={24}
  showsHorizontalScrollIndicator={false}
  renderItem={({ item }) => {
    const altKcal = Number.isFinite(+item?.calories_per_package_kcal)
      ? Math.round(+item.calories_per_package_kcal)
      : null;

    const baseKcal = Number.isFinite(+currentItem?.calories_kcal_total)
      ? Math.round(+currentItem.calories_kcal_total)
      : null;

    const diff = altKcal != null && baseKcal != null ? altKcal - baseKcal : null;

    const THRESH = 5;
    const bucket =
      diff == null
        ? "similar"
        : diff < -THRESH
        ? "lower"
        : diff > THRESH
        ? "higher"
        : "similar";

    const color =
      bucket === "higher" ? MORE_COLOR :
      bucket === "lower"  ? LESS_COLOR  :
      SIMILAR_COLOR;

    const label = [
      sText(item?.brand, ""),
      sText(item?.name, ""),
      sText(item?.flavor_or_variant, ""),
    ].filter(Boolean).join(" ");

    // ✅ add + / − in front of calories (no extra text)
    const sign =
      bucket === "higher" ? "+" :
      bucket === "lower"  ? "−" : "";
    const amt = altKcal != null ? `${sign}${altKcal}cal` : "—";

    return (
      <View style={{ 
        backgroundColor: "#fff",
        width: size(150),
        marginRight: width(5),
        height: size(150),
        marginBottom: 12,
        borderRadius: 15,
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
          },
          android: { elevation: 6, shadowColor: '#888' }
        })
      }}>
        <Text numberOfLines={4} 
          style={{
            width: "75%",
            marginLeft: width(5),
            marginTop: height(2),
            fontSize: size(16),
            fontWeight: "800",
          }}>
          {label}
        </Text>

        <Text style={{
          flexDirection: 'row',
          alignItems: 'center',
          color,
          fontWeight: "800",
          fontSize: size(18),
          width: "95%",
          position: 'absolute',
          marginLeft: width(5),
          bottom: height(4),
        }}>
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
          style={[
            styles.headerBackground,
            { opacity: imageOpacity, transform: [{ translateY: imageTranslateY }] },
          ]}
          source={{ uri: currentItem?.image_cloud_url }}
        />
      </Animated.View>

      {/* Top title over header */}
      <Animated.View
        style={[
          styles.headerTopTitle,
          { transform: [{ scale: titleScale }, { translateY: titleTranslateY }] },
        ]}
      >
        <Text style={{ color: "white", fontSize: 20 }}>Management</Text>
      </Animated.View>
    </View>
    )}
    </>

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
  },
  bigMetricCard: {
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
  },

  caloriesLabel: { fontSize: size(17), fontWeight: "bold", marginLeft: width(5) },
  caloriesRow: { flexDirection: "row", alignItems: "center", marginTop: height(2), marginLeft: width(5) },
  flameWrap: {
    height: size(65), width: size(65), borderRadius: size(65) / 2,
    justifyContent: "center", alignItems: "center", backgroundColor: "#222",
  },
  bigIconWrap: {
    height: size(65), width: size(65), borderRadius: size(65) / 2,
    justifyContent: "center", alignItems: "center", backgroundColor: "#222",
  },
  caloriesValue: { fontSize: size(40), marginLeft: width(3), fontWeight: "700" },

  /* Shared row spacing for 3 tiles */
  ringsRow: {
    flexDirection: "row",
    width: "90%",
    alignSelf: "center",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: height(1),
  },

  /* 3-across tile style (used on page 1 AND the little cards on page 2) */
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

  totalsHeader: { fontSize: size(18), marginTop: height(8), fontWeight: "bold", marginLeft: width(5) },

  ingIconWrap: {
    backgroundColor: "#000",
    height: size(35),
    width: size(35),
    borderRadius: size(35) / 2,
    marginLeft: width(4),
    justifyContent: "center",
    alignItems: "center",
  },
  ingLabel: { width: "50%", color: "#000", marginLeft: width(5) },
  ingAmt: { color: "#000", right: width(2), position: "absolute", fontWeight: "800", fontSize: size(18) },

  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    overflow: "hidden",
    height: HEADER_MAX_HEIGHT,
  },
  headerBackground: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: HEADER_MAX_HEIGHT,
    resizeMode: "cover",
  },
  headerTopTitle: {
    marginTop: 40,
    height: 50,
    position: "absolute",
    top: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center",
  },
});

export default PageAfterScan_FoodLabel;
