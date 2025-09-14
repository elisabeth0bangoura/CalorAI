// DesiredWeight.js (Firestore-driven unit, no Switch)
import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { height, width } from "react-native-responsive-sizes";
import { RulerPicker } from "react-native-ruler-picker";

/* RNFB v22 modular */
import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

/* conversions */
const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => Math.round(lb * KG_PER_LB);
const kgToLb = (kg) => Math.round(kg / KG_PER_LB);
const toNum = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

function DesiredWeight() {
  const {
    kg, lb,
    unitSystem, setUnitSystem,        // "metric" | "imperial"
    goalWeightKg, setGoalWeightKg,
    goalWeightLb, setGoalWeightLb,
    goalWeightUnit, setGoalWeightUnit, // "kg" | "lb"
  } = useEditNutrition();

  const auth = getAuth();

  /* Apply a unit coming from Firestore/local and keep values synced */
  const applyUnit = useCallback(
    (wu /* "kg" | "lb" */) => {
      const gKgNum = toNum(goalWeightKg);
      const gLbNum = toNum(goalWeightLb);

      if (wu === "kg") {
        const kgVal = gKgNum ?? (gLbNum ? lbToKg(gLbNum) : 70);
        setGoalWeightKg(kgVal);
        setGoalWeightLb(kgToLb(kgVal));
        setGoalWeightUnit("kg");
        setUnitSystem?.("metric");
        setPreviewValue(kgVal);
      } else if (wu === "lb") {
        const lbVal = gLbNum ?? (gKgNum ? kgToLb(gKgNum) : 154);
        setGoalWeightLb(lbVal);
        setGoalWeightKg(lbToKg(lbVal));
        setGoalWeightUnit("lb");
        setUnitSystem?.("imperial");
        setPreviewValue(lbVal);
      }
    },
    [goalWeightKg, goalWeightLb, setGoalWeightKg, setGoalWeightLb, setGoalWeightUnit, setUnitSystem]
  );

  /* Listen to users/$uid.weightUnit (Firestore is the source of truth) */
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ref = doc(getFirestore(), "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const wu = snap.get("weightUnit"); // expected "kg" | "lb"
      if ((wu === "kg" || wu === "lb") && wu !== goalWeightUnit) {
        applyUnit(wu);
      }
    });

    return () => unsub();
  }, [auth, applyUnit, goalWeightUnit]);

  /* One-time local fallback init (used if Firestore has no value yet) */
  useEffect(() => {
    if (goalWeightUnit) return;

    const gKg = toNum(goalWeightKg);
    const gLb = toNum(goalWeightLb);
    if (gKg || gLb) {
      if (!goalWeightUnit) setGoalWeightUnit(gKg ? "kg" : "lb");
      return;
    }

    const curKg = toNum(kg);
    const curLb = toNum(lb);
    if (curKg) {
      setGoalWeightKg(curKg);
      setGoalWeightLb(kgToLb(curKg));
      setGoalWeightUnit("kg");
      setUnitSystem?.("metric");
      return;
    }
    if (curLb) {
      setGoalWeightLb(curLb);
      setGoalWeightKg(lbToKg(curLb));
      setGoalWeightUnit("lb");
      setUnitSystem?.("imperial");
      return;
    }

    const fallbackKg = 70;
    setGoalWeightKg(fallbackKg);
    setGoalWeightLb(kgToLb(fallbackKg));
    setGoalWeightUnit("kg");
    setUnitSystem?.("metric");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Derive current unit + value */
  const unit = goalWeightUnit || (unitSystem === "metric" ? "kg" : "lb");
  const isMetric = unit === "kg";
  const gKgNum = toNum(goalWeightKg);
  const gLbNum = toNum(goalWeightLb);

  const contextValue = isMetric
    ? (gKgNum ?? (gLbNum ? lbToKg(gLbNum) : 70))
    : (gLbNum ?? (gKgNum ? kgToLb(gKgNum) : 154));

  /* Local preview during drag */
  const [previewValue, setPreviewValue] = useState(contextValue);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setPreviewValue(contextValue);
  }, [contextValue, unit]);

  /* Ruler + haptics */
  const [rulerWidth, setRulerWidth] = useState(0);
  const rulerRef = useRef(null);
  const lastTickRef = useRef(Math.round(contextValue));
  const lastTsRef = useRef(0);

  useEffect(() => {
    if (rulerWidth && rulerRef.current?.scrollToValue && Number.isFinite(previewValue)) {
      rulerRef.current.scrollToValue(previewValue, false);
      lastTickRef.current = Math.round(previewValue);
    }
  }, [rulerWidth, previewValue, unit]);

  const handleRulerChange = useCallback((v) => {
    const now = Date.now();
    if (now - lastTsRef.current < 33) return; // ~30fps throttle
    lastTsRef.current = now;

    draggingRef.current = true;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return;

    setPreviewValue(n);

    if (n !== lastTickRef.current) {
      (n % 5 === 0)
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync();
      lastTickRef.current = n;
    }
  }, []);

  const handleRulerEnd = useCallback((v) => {
    const n = Math.round(Number(v));
    draggingRef.current = false;
    if (!Number.isFinite(n)) return;

    if (isMetric) {
      setGoalWeightKg(n);
      setGoalWeightLb(kgToLb(n));
    } else {
      setGoalWeightLb(n);
      setGoalWeightKg(lbToKg(n));
    }
    setPreviewValue(n);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isMetric, setGoalWeightKg, setGoalWeightLb]);

  const unitLabel = isMetric ? "kg" : "lb";
  const min = isMetric ? 30 : kgToLb(30);
  const max = isMetric ? 200 : kgToLb(200);

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, marginTop: height(5), width: "90%", marginLeft: width(5), fontWeight: "700" }}>
          What is your desired weight?
        </Text>

     

        <View
          onLayout={(e) => setRulerWidth(Math.round(e.nativeEvent.layout.width))}
          style={{ paddingHorizontal: 16, justifyContent: "center", alignItems: "center", height: height(50), width: "100%" }}
        >
          {/* Big value label (local preview) */}
          <View style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ fontSize: 48, fontWeight: "800" }}>{String(previewValue)}</Text>
            <Text style={{ fontSize: 28, marginLeft: 6 }}>{unitLabel}</Text>
          </View>



             {/* Small helper label to show where unit comes from */}
        <Text style={{ marginLeft: width(5), marginTop: 6, color: "#9aa2a9" }}>
          Lose weight 
        </Text>

          {/* Ruler */}
          {rulerWidth > 0 && Number.isFinite(previewValue) && (
            <RulerPicker
              key={`${rulerWidth}-${unit}`}
              ref={rulerRef}
              min={min}
              max={max}
              step={1}
              shortStep={1}
              longStep={5}
              gapBetweenSteps={10}
              height={140}
              initialValue={previewValue}
              fractionDigits={0}
              decelerationRate="fast"
              onValueChange={handleRulerChange}
              onValueChangeEnd={handleRulerEnd}
              indicatorColor="#000"
              indicatorHeight={60}
              shortStepColor="#BDBDBD"
              longStepColor="#BDBDBD"
              valueTextStyle={{ fontSize: 1, color: "transparent" }}
              unitTextStyle={{ fontSize: 1, color: "transparent" }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default memo(DesiredWeight);