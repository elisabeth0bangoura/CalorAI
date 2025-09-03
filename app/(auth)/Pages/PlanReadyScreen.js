// app/(auth)/Pages/PlanReadyScreen.js
import {
  Beef,
  Check,
  Cigarette,
  Coffee,
  Droplet,
  Droplets,
  Flame,
  HeartPulse,
  Wheat,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";
import { useSteps } from "../../Context/StepsContext";
import PlanTipsScreen from "./PlanTipsScreen";

/* ---------- helpers ---------- */
const tint = (hex, a = 0.15) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return hex || "#000000";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${a})`;
};

const KG_PER_LB = 0.45359237;
const IN_PER_FT = 12;
const CM_PER_IN = 2.54;
const ML_PER_CUP = 240;

const toNum = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};
const kgFromLb = (lb) => Math.round(lb * KG_PER_LB);
const cmFromFtIn = (ft, inch) => {
  const f = toNum(ft) ?? 0;
  const i = toNum(inch) ?? 0;
  const totalIn = f * IN_PER_FT + i;
  return Math.round(totalIn * CM_PER_IN);
};

const pickCurrentKg = ({ kg, lb, unitSystem, weightUnit }) => {
  const kgNum = toNum(kg);
  const lbNum = toNum(lb);
  if (weightUnit === "kg") return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
  if (weightUnit === "lb") return lbNum ? kgFromLb(lbNum) : (kgNum ?? null);
  if (unitSystem === "metric") return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
  if (unitSystem === "imperial") return lbNum ? kgFromLb(lbNum) : (kgNum ?? null);
  return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
};

const pickGoalKg = ({ goalWeightKg, goalWeightLb, goalWeightUnit }) => {
  const gKg = toNum(goalWeightKg);
  const gLb = toNum(goalWeightLb);
  if (goalWeightUnit === "kg") return gKg ?? (gLb ? kgFromLb(gLb) : null);
  if (goalWeightUnit === "lb") return gLb ? kgFromLb(gLb) : (gKg ?? null);
  return gKg ?? (gLb ? kgFromLb(gLb) : null);
};

const ageFromYMD = (y, m, d) => {
  const yy = toNum(y) ?? 1995;
  const mm = (toNum(m) ?? 1) - 1;
  const dd = toNum(d) ?? 1;
  const today = new Date();
  let age = today.getFullYear() - yy;
  const beforeBirthday =
    today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < dd);
  if (beforeBirthday) age -= 1;
  return Math.max(13, Math.min(90, age));
};

const activityFactorFromWorkouts = (workouts) => {
  const w = Number(workouts) || 0;
  if (w <= 0) return 1.2;
  if (w <= 2) return 1.375;
  if (w <= 4) return 1.55;
  if (w <= 6) return 1.725;
  return 1.9;
};

const round = (n) => Math.round(Number(n) || 0);
const SAT_FAT_GRAMS = { low: 13, moderate: 22, high: 30 };

const inferCigsFromFrequency = (val) => {
  if (Number.isFinite(Number(val))) return Math.max(0, Number(val));
  const s = String(val || "").toLowerCase();
  if (!s || s === "none" || s === "no") return 0;
  if (s.includes("occas")) return 1;
  if (s.includes("light")) return 5;
  if (s.includes("moderate") || s.includes("medium")) return 10;
  if (s.includes("heavy")) return 20;
  return 6;
};

/* ---------- ring sizing (bigger icon inside) ---------- */
const RING_RADIUS = 46;                // was ~36
const RING_STROKE = 6;
const ICON_BOX_SIZE = 40;              // space for icon inside ring
const ICON_SIZE_IN_RING = size(20);    // lucide icon size inside ring

export default function PlanReadyScreen({
  isActive,
  active,
  headline = "Congratulations\nyour custom plan is ready!",
  loseLabel,
  chipText,
  calories: caloriesOverride,
  carbs: carbsOverride,
  protein: proteinOverride,
  fats: fatsOverride,
}) {
  const enabled = (isActive ?? active) === true;
  const { prev, next } = useSteps();

  /* ----- context ----- */
  const {
    kg, lb, cm, ft, inch,
    gender,
    year, month, day,
    workouts,
    unitSystem, weightUnit,
    goal,
    HowFast,
    goalWeightKg, goalWeightLb, goalWeightUnit,
    selectedConditions,
    diabetesSettings,
    kidneySettings,
    heartSettings,
    habitSettings,
    SmokingFrequency,
  } = useOnboarding();

  /* ----- derived inputs ----- */
  const currentKg = pickCurrentKg({ kg, lb, unitSystem, weightUnit }) ?? 70;
  const targetKg  = pickGoalKg({ goalWeightKg, goalWeightLb, goalWeightUnit }) ?? currentKg;
  const cmVal     = toNum(cm) ?? cmFromFtIn(ft, inch) ?? 170;
  const age       = ageFromYMD(year, month, day);
  const sex       = (String(gender || "").toLowerCase().startsWith("f")) ? "female" : "male";

  /* ----- BMR / TDEE ----- */
  const BMR = useMemo(() => {
    const base = 10 * currentKg + 6.25 * cmVal - 5 * age;
    return round(base + (sex === "male" ? 5 : -161));
  }, [currentKg, cmVal, age, sex]);

  const TDEE = round(BMR * activityFactorFromWorkouts(workouts));

  /* ----- timeline chip ----- */
  const delta = round(targetKg - currentKg);
  const absKg = Math.abs(delta);
  const speed = Math.min(1.75, Math.max(0.4, Number(HowFast) || 1.0));
  const baseRate = delta < 0 ? 0.6 : delta > 0 ? 0.3 : 0; // kg/week
  const minRate  = delta < 0 ? 0.3 : 0.15;
  const maxRate  = delta < 0 ? 1.0 : 0.6;
  const weeklyRate = delta === 0 ? 0 : Math.min(maxRate, Math.max(minRate, baseRate * speed));

  const dailyGap = weeklyRate * 7700 / 7; // kcal/day
  const calorieTargetCalc =
    delta < 0 ? round(TDEE - dailyGap) :
    delta > 0 ? round(TDEE + dailyGap) :
    TDEE;

  const dynamicChip = useMemo(() => {
    if (!Number.isFinite(currentKg) || !Number.isFinite(targetKg)) {
      return { label: "You should:", text: "Set your goal to see a timeline" };
    }
    const d = round(targetKg - currentKg);
    if (Math.abs(d) === 0) {
      return { label: "You're set:", text: "Stay within ±1 kg over the next month" };
    }
    const weeks = Math.max(1, Math.ceil(Math.abs(d) / weeklyRate));
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    const monthName = date.toLocaleString("en-US", { month: "long" });
    const dayNum    = date.getDate();
    const verb = d < 0 ? "Lose" : "Gain";
    return { label: d < 0 ? "You should lose:" : "You should gain:", text: `${verb} ${Math.abs(d)} kg by ${monthName} ${dayNum}` };
  }, [currentKg, targetKg, weeklyRate]);

  const finalChipText  = chipText  ?? dynamicChip.text;
  const finalLoseLabel = loseLabel ?? dynamicChip.label;

  /* ----- flags for visibility ----- */
  const ids = selectedConditions || [];
  const hasDiabetes = ids.includes("diabetesPlan") || goal === "diabetesPlan" || (ids.includes("trackhealth") && diabetesSettings?.trackCarbs);
  const hasKidney   = ids.includes("kidneyPlan")   || goal === "kidneyPlan";
  const hasHeart    = ids.includes("heartPlan")    || goal === "heartPlan";
  const hasCoffee   = ids.includes("reduceCoffee") || goal === "reduceCoffee";
  const hasSmoking  = ids.includes("stopSmoking")  || goal === "stopSmoking";

  /* ----- macro rules ----- */
  let proteinPerKg;
  if (hasKidney) {
    const level = kidneySettings?.proteinLevel || "moderate";
    proteinPerKg = level === "low" ? 0.8 : level === "high" ? 1.6 : 1.2;
  } else {
    proteinPerKg = delta === 0 ? 1.6 : 1.8;
  }
  const proteinBase = round(proteinPerKg * currentKg);

  let fatPctBase = 0.30;
  if (hasHeart) fatPctBase = Math.max(0.25, fatPctBase - 0.05);
  const fatCaloriesBase = Math.round(calorieTargetCalc * fatPctBase);
  const fatBase = round(fatCaloriesBase / 9);

  const caloriesUsedByPF = proteinBase * 4 + fatBase * 9;
  const carbsFromRemainder = Math.max(0, round((calorieTargetCalc - caloriesUsedByPF) / 4));

  const perMeal = Math.max(15, Math.min(100, Number(diabetesSettings?.carbTargetPerMeal) || 45));
  const dailyCarbCap = hasDiabetes ? round(perMeal * 3.5) : Infinity;

  let protein = proteinBase;
  let fats    = fatBase;
  let carbs   = Math.min(carbsFromRemainder, dailyCarbCap);

  if (carbs < carbsFromRemainder) {
    const kcalMissing = Math.max(0, calorieTargetCalc - (protein * 4 + fats * 9 + carbs * 4));
    const fatUpperPct = hasHeart ? 0.30 : 0.35;
    const fatUpperKcal = Math.round(calorieTargetCalc * fatUpperPct);
    const fatRoomKcal = Math.max(0, fatUpperKcal - fats * 9);
    const addFatKcal = Math.min(kcalMissing, fatRoomKcal);
    fats += round(addFatKcal / 9);

    const newKcalMissing = Math.max(0, calorieTargetCalc - (protein * 4 + fats * 9 + carbs * 4));
    if (newKcalMissing > 0) protein += round(newKcalMissing / 4);
  }

  const calories     = Number.isFinite(caloriesOverride) ? caloriesOverride : calorieTargetCalc;
  const finalProtein = Number.isFinite(proteinOverride)  ? proteinOverride  : protein;
  const finalFats    = Number.isFinite(fatsOverride)     ? fatsOverride     : fats;
  const finalCarbs   = Number.isFinite(carbsOverride)    ? carbsOverride    : carbs;

  /* ----- health & habit tile values ----- */
  const sodiumVal = hasKidney ? (kidneySettings?.sodiumLimitMg ?? 2000)
                 : hasHeart  ? (heartSettings?.sodiumLimitMg  ?? 1500)
                 : 1500;

  const waterCups   = hasKidney ? (kidneySettings?.hydrationGoalCups ?? 8) : 8;
  const waterMl     = Math.round(waterCups * ML_PER_CUP);   // show in mL
  const waterMaxMl  = 20 * ML_PER_CUP;                      // visual range

  const satFatVal = hasHeart ? (SAT_FAT_GRAMS[heartSettings?.satFatLimit] ?? 22) : 22;

  const coffeeCups = habitSettings?.coffeePerDayTarget ?? 2;
  const coffeeMax  = 8;

  const cigsTarget = habitSettings?.cigarettesPerDayTarget ?? inferCigsFromFrequency(SmokingFrequency);
  const cigarettesPerDay = Math.max(0, cigsTarget);
  const smokingMax = 20;

  /* ----- animations ----- */
  const fadeTop  = useRef(new Animated.Value(0)).current;
  const fadeChip = useRef(new Animated.Value(0)).current;

  const grid1  = useRef(new Animated.Value(0)).current;
  const grid2  = useRef(new Animated.Value(0)).current;
  const grid3  = useRef(new Animated.Value(0)).current;
  const grid4  = useRef(new Animated.Value(0)).current;
  const grid5  = useRef(new Animated.Value(0)).current; // Sodium
  const grid6  = useRef(new Animated.Value(0)).current; // Water (mL)
  const grid7  = useRef(new Animated.Value(0)).current; // Sat fat
  const grid8  = useRef(new Animated.Value(0)).current; // BP
  const grid9  = useRef(new Animated.Value(0)).current; // Coffee
  const grid10 = useRef(new Animated.Value(0)).current; // Smoking

  useEffect(() => {
    if (!enabled) {
      fadeTop.setValue(0);
      fadeChip.setValue(0);
      [grid1,grid2,grid3,grid4,grid5,grid6,grid7,grid8,grid9,grid10].forEach((g)=>g.setValue(0));
      return;
    }
    Animated.sequence([
      Animated.timing(fadeTop,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(fadeChip, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.stagger(120, [
        Animated.timing(grid1,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid2,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid3,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid4,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid5,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid6,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid7,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid8,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid9,  { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(grid10, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, [enabled]);

  const cardShadow = Platform.select({
    ios:     { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 2, shadowColor: "#00000044" },
  });

  /* ========= ring shows ONLY the ICON; number is outside ========= */
  const ringWithIcon = ({ value, max, color, icon }) => (
    <CircularProgressBase
      value={enabled ? value : 0}
      maxValue={Math.max(1, max || value)}
      radius={RING_RADIUS}
      rotation={0}
      activeStrokeWidth={RING_STROKE}
      inActiveStrokeWidth={RING_STROKE}
      activeStrokeColor={color}
      activeStrokeSecondaryColor={color}
      inActiveStrokeColor="#EEF1F6"
      inActiveStrokeOpacity={1}
      startInPausedState={!enabled}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          height: ICON_BOX_SIZE,
          width: ICON_BOX_SIZE,
        }}
      >
        {React.isValidElement(icon)
          ? React.cloneElement(icon, { color: "#000", size: ICON_SIZE_IN_RING })
          : <Text style={{ fontSize: ICON_SIZE_IN_RING, color: "#000" }}>{icon}</Text>}
      </View>
    </CircularProgressBase>
  );

  /* ---- layout ---- */
  const GRID_HPAD = width(5);
  const GRID_INNER_PAD = 8;
  const COL_GAP = 12;
  const ROW_GAP = 12;
  const GRID_TOTAL_W = width(100) - GRID_HPAD * 2;
  const CARD_WIDTH = (GRID_TOTAL_W - GRID_INNER_PAD * 2 - COL_GAP) / 2;

  const Card = ({ title, icon, value, color, suffix, anim, max }) => (
    <Animated.View
      style={{
        width: CARD_WIDTH,
        height: size(240),
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale:      anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
        borderWidth: 1,
        borderColor: "#F1F3F7",
        backgroundColor: "#fff",
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 14,
        ...cardShadow,
      }}
    >
      {/* small dismiss button */}
      <TouchableOpacity
        style={{
          height: size(30),
          backgroundColor: "#F1F3F7",
          borderRadius: size(30) / 2,
          width: size(30),
          justifyContent: "center",
          alignItems: "center",
        }}
        activeOpacity={0.7}
      >
        <X size={18} color={"#888"} strokeWidth={3} />
      </TouchableOpacity>

      {/* ring WITH ICON */}
      <View style={{ alignItems: "center", marginTop: height(0.8), justifyContent: "center" }}>
        {ringWithIcon({ value, max, color, icon })}
      </View>

      {/* number OUTSIDE the ring */}
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: size(18), fontWeight: "900", color: "#141518" }}>
          {String(value)}
          {suffix ? (
            <Text style={{ fontSize: size(11), fontWeight: "700", color: "#141518" }}>
              {suffix}
            </Text>
          ) : null}
        </Text>
      </View>

      {/* title + tiny icon in tinted box (kept for your styling) */}
      <View
        style={{
          flexDirection: "row",
          marginTop: height(1.4),
          alignSelf: "center",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            backgroundColor: tint(color, 0.18),
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            height: size(30),
            width: size(30),
            marginRight: width(2),
          }}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon, { color: "#000", size: size(14) })
            : <Text style={{ fontSize: 12, color: "#000" }}>{icon}</Text>}
        </View>
        <Text style={{ fontWeight: "800", fontSize: size(14), color: "#1B1D22" }}>
          {title}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <>
      <AppBlurHeader />
      <View style={{ height: "100%", width: "100%" }}>
        <ScrollView
          style={{ height: "100%", width: "100%" }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: height(18) }}
        >
          {/* header/check */}
          <Animated.View
            style={{
              alignItems: "center",
              marginTop: height(14),
              opacity: fadeTop,
              transform: [{ translateY: fadeTop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: "#111",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Check size={22} color="#fff" />
            </View>
            <Text
              style={{
                fontSize: 28,
                lineHeight: 32,
                fontWeight: "900",
                color: "#141518",
                textAlign: "center",
                paddingHorizontal: width(6),
              }}
            >
              {headline}
            </Text>
          </Animated.View>

          {/* chip */}
          <Animated.View
            style={{
              alignSelf: "center",
              marginTop: height(2),
              opacity: fadeChip,
              transform: [{ translateY: fadeChip.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <Text style={{ textAlign: "center", color: "#6A7078", fontWeight: "800", marginBottom: 8 }}>
              {finalLoseLabel}
            </Text>
            <View style={{ backgroundColor: "#F1F3F7", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20 }}>
              <Text style={{ fontWeight: "900", fontSize: size(13), color: "#141518" }}>
                {finalChipText}
              </Text>
            </View>
          </Animated.View>

          {/* cards */}
          <View
            style={{
              marginTop: height(3),
              marginHorizontal: width(5),
              borderRadius: 22,
              paddingVertical: 16,
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#171A1F", marginLeft: 4, marginBottom: 2 }}>
              Daily recommendation
            </Text>
            <Text style={{ color: "#8C9097", marginLeft: 4, marginBottom: 10 }}>
              You can edit this anytime
            </Text>

            <View
              style={{
                marginTop: height(2),
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                rowGap: 12,
                columnGap: 12,
              }}
            >
              {/* Macros */}
              <Card title="Calories" icon={<Flame />}   value={calories}     color="#111111" suffix=""   anim={grid1}  max={calories} />
              <Card title="Carbs"    icon={<Wheat />}   value={finalCarbs}    color="#F59E0B" suffix="g" anim={grid2}  max={finalCarbs} />
              <Card title="Protein"  icon={<Beef />}    value={finalProtein}  color="#EF4444" suffix="g" anim={grid3}  max={finalProtein} />
              <Card title="Fats"     icon={<Droplet />} value={finalFats}     color="#2563EB" suffix="g" anim={grid4}  max={finalFats} />

              {/* Kidney */}
              {hasKidney && (
                <>
                  <Card
                    title="Sodium"
                    icon={"Na⁺"}
                    value={sodiumVal}
                    color="#06B6D4"
                    suffix="mg"
                    anim={grid5}
                    max={4000}
                  />
                  <Card
                    title="Water"
                    icon={<Droplets />}
                    value={waterMl}
                    color="#0EA5E9"
                    suffix="ml"
                    anim={grid6}
                    max={waterMaxMl}
                  />
                </>
              )}

              {/* Heart */}
              {hasHeart && (
                <>
                  <Card
                    title="Sat fat"
                    icon={"SF"}
                    value={satFatVal}
                    color="#9333EA"
                    suffix="g"
                    anim={grid7}
                    max={40}
                  />
                  <Card
                    title="Blood pressure"
                    icon={<HeartPulse />}
                    value={120}
                    color="#10B981"
                    suffix=" mmHg"
                    anim={grid8}
                    max={200}
                  />
                </>
              )}

              {/* Habits */}
              {hasCoffee && (
                <Card
                  title="Coffee"
                  icon={<Coffee />}
                  value={coffeeCups}
                  color="#8B5E3C"
                  suffix="cup"
                  anim={grid9}
                  max={8}
                />
              )}
              {hasSmoking && (
                <Card
                  title="Smoking"
                  icon={<Cigarette />}
                  value={cigarettesPerDay}
                  color="#F97316"
                  suffix="/day"
                  anim={grid10}
                  max={20}
                />
              )}
            </View>

            <Text style={{ fontSize: size(18), marginTop: height(5), fontWeight: "800" }}>
              How to archiev your set goals:
            </Text>
          </View>

          <PlanTipsScreen active={active} />
        </ScrollView>
      </View>
    </>
  );
}
