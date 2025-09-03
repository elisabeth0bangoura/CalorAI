import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { RulerPicker } from "react-native-ruler-picker";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

/* --- conversions --- */
const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => Math.round(lb * KG_PER_LB);
const kgToLb = (kg) => Math.round(kg / KG_PER_LB);
const toNum = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

function DesiredWeight() {
  const {
    // current body weight (for smart defaults)
    kg, lb,

    // global unit (optional but we keep it in sync)
    unitSystem, setUnitSystem, // "metric" | "imperial"

    // goal weight state (THIS PAGE OWNS THESE)
    goalWeightKg, setGoalWeightKg,
    goalWeightLb, setGoalWeightLb,
    goalWeightUnit, setGoalWeightUnit, // "kg" | "lb"
  } = useOnboarding();

  /* ---------- one-time init in context ---------- */
  useEffect(() => {
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

  /* ---------- derive unit + context value ---------- */
  const unit = goalWeightUnit || (unitSystem === "metric" ? "kg" : "lb");
  const isMetric = unit === "kg";

  const gKgNum = toNum(goalWeightKg);
  const gLbNum = toNum(goalWeightLb);

  // value in the CURRENT unit (from context)
  const contextValue = isMetric
    ? (gKgNum ?? (gLbNum ? lbToKg(gLbNum) : 70))
    : (gLbNum ?? (gKgNum ? kgToLb(gKgNum) : 154));

  /* ---------- local preview while dragging ---------- */
  const [previewValue, setPreviewValue] = useState(contextValue);
  const draggingRef = useRef(false);

  // keep preview synced to context when not dragging
  useEffect(() => {
    if (!draggingRef.current) setPreviewValue(contextValue);
  }, [contextValue, unit]);

  /* ---------- ruler layout + haptics throttle ---------- */
  const [rulerWidth, setRulerWidth] = useState(0);
  const rulerRef = useRef(null);
  const lastTickRef = useRef(Math.round(contextValue));
  const lastTsRef = useRef(0);

  // align ruler when width/unit/preview changes
  useEffect(() => {
    if (rulerWidth && rulerRef.current?.scrollToValue && Number.isFinite(previewValue)) {
      rulerRef.current.scrollToValue(previewValue, false);
      lastTickRef.current = Math.round(previewValue);
    }
  }, [rulerWidth, previewValue, unit]);

  /* ---------- handlers ---------- */
  const toggleUnits = useCallback(() => {
    const nextUnit = isMetric ? "lb" : "kg";
    setGoalWeightUnit(nextUnit);
    setUnitSystem?.(nextUnit === "kg" ? "metric" : "imperial");

    // keep both sides populated + update preview to converted value
    if (nextUnit === "kg") {
      const kgVal = gKgNum ?? (gLbNum ? lbToKg(gLbNum) : 70);
      setGoalWeightKg(kgVal);
      setGoalWeightLb(kgToLb(kgVal));
      setPreviewValue(kgVal);
    } else {
      const lbVal = gLbNum ?? (gKgNum ? kgToLb(gKgNum) : 154);
      setGoalWeightLb(lbVal);
      setGoalWeightKg(lbToKg(lbVal));
      setPreviewValue(lbVal);
    }
    Haptics.selectionAsync();
  }, [isMetric, gKgNum, gLbNum, setGoalWeightKg, setGoalWeightLb, setGoalWeightUnit, setUnitSystem]);

  // only update local preview while dragging (no context writes)
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

  // commit once on release
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
  const min = isMetric ? 30 : kgToLb(30);   // 30 kg -> ~66 lb
  const max = isMetric ? 200 : kgToLb(200); // 200 kg -> ~441 lb

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <AppBlurHeader />

      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          Set your goal weight
        </Text>
        <Text
          style={{
            fontSize: size(14),
            marginTop: height(1),
            marginLeft: width(5),
            fontWeight: "700",
            color: "#BCC1CA",
          }}
        >
          We’ll tune your plan around this target.
        </Text>

        <View
          onLayout={(e) => setRulerWidth(Math.round(e.nativeEvent.layout.width))}
          style={{
            paddingHorizontal: 16,
            justifyContent: "center",
            alignItems: "center",
            height: height(60),
            width: "100%",
          }}
        >
          {/* Unit switch (context-backed) */}
          <View style={{ flexDirection: "row", top: height(-5), alignSelf: "center", alignItems: "center" }}>
            <Text
              style={{
                fontWeight: "700",
                color: isMetric ? "#A6B0B8" : "#111",
                fontSize: size(15),
                marginRight: width(10),
              }}
            >
              Imperial
            </Text>

            <Switch
              trackColor={{ false: "#D3DAE0", true: "#0057FF" }}
              thumbColor={"#fff"}
              ios_backgroundColor="#D3DAE0"
              onValueChange={toggleUnits}
              value={isMetric} // ON = Metric
            />

            <Text
              style={{
                fontWeight: "700",
                marginLeft: width(10),
                fontSize: size(15),
                color: isMetric ? "#111" : "#A6B0B8",
              }}
            >
              Metric
            </Text>
          </View>

          {/* Big value label uses LOCAL preview to avoid context churn */}
          <View style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ fontSize: 48, fontWeight: "800" }}>{String(previewValue)}</Text>
            <Text style={{ fontSize: 28, marginLeft: 6 }}>{unitLabel}</Text>
          </View>

          {/* Ruler (remounts on unit change for clean range) */}
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
