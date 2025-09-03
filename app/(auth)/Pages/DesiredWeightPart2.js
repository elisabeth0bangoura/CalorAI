// app/(auth)/Pages/DesiredWeight.js
import { Text, View } from "react-native";
import { height, size } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

// Buckets
const WEIGHT_GOALS = new Set(["lose", "gain", "maintain"]);
const HEALTH_GOALS = new Set(["diabetesPlan", "kidneyPlan", "heartPlan", "trackhealth"]);
const HABIT_GOALS  = new Set(["reduceCoffee", "stopSmoking"]);

// Short labels for the summary line
const LABELS = {
  diabetesPlan: "blood sugar & carbs",
  kidneyPlan:   "sodium & hydration",
  heartPlan:    "BP & cholesterol",
  trackhealth:  "overall health",
  reduceCoffee: "caffeine",
  stopSmoking:  "smoking",
};

const toNum = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};
const kgFromLb = (lb) => Math.round(lb * 0.45359237);

// ---- pick CURRENT weight (kg) from context ----
function pickCurrentKg({ kg, lb, unitSystem, weightUnit }) {
  const kgNum = toNum(kg);
  const lbNum = toNum(lb);

  if (weightUnit === "kg") return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
  if (weightUnit === "lb") return lbNum ? kgFromLb(lbNum) : (kgNum ?? null);

  if (unitSystem === "metric")  return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
  if (unitSystem === "imperial") return lbNum ? kgFromLb(lbNum) : (kgNum ?? null);

  return kgNum ?? (lbNum ? kgFromLb(lbNum) : null);
}

// ---- pick GOAL weight (kg) from context ----
function pickGoalKg({ goalWeightKg, goalWeightLb, goalWeightUnit }) {
  const gKg = toNum(goalWeightKg);
  const gLb = toNum(goalWeightLb);

  if (goalWeightUnit === "kg") return gKg ?? (gLb ? kgFromLb(gLb) : null);
  if (goalWeightUnit === "lb") return gLb ? kgFromLb(gLb) : (gKg ?? null);

  return gKg ?? (gLb ? kgFromLb(gLb) : null);
}

function joinWithAnd(items) {
  if (!items?.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default function DesiredWeight() {
  const {
    // selection
    goal,
    selectedConditions,

    // current weight + flags
    kg, lb,
    unitSystem,    // "metric" | "imperial"
    weightUnit,    // "kg" | "lb"  (last edited)

    // goal weight + which unit the ruler saved
    goalWeightKg,
    goalWeightLb,
    goalWeightUnit, // "kg" | "lb"
  } = useOnboarding();

  // -------- weights from context --------
  const currentKg = pickCurrentKg({ kg, lb, unitSystem, weightUnit });
  const goalKg    = pickGoalKg({ goalWeightKg, goalWeightLb, goalWeightUnit });

  // -------- primary number: goal - current (kg) --------
  // Positive => need to gain; Negative => need to lose
  const diffRaw = (Number.isFinite(goalKg) && Number.isFinite(currentKg))
    ? Math.round(goalKg - currentKg)
    : null;
  const absDiff = Number.isFinite(diffRaw) ? Math.abs(diffRaw) : null;

  // -------- fallback estimate (only when no goal weight yet) --------
  let fallbackDelta = null;
  if (!Number.isFinite(absDiff) && WEIGHT_GOALS.has(goal) && Number.isFinite(currentKg)) {
    if (goal === "lose") {
      fallbackDelta = Math.round(Math.min(12, Math.max(3, currentKg * 0.08)));
    } else if (goal === "gain") {
      fallbackDelta = Math.round(Math.min(8, Math.max(2, currentKg * 0.05)));
    }
  }

  // -------- health/habit selection summary --------
  const chosen = new Set();
  (selectedConditions || []).forEach((id) => HEALTH_GOALS.has(id) && chosen.add(id));
  if (HEALTH_GOALS.has(goal) && chosen.size === 0) chosen.add(goal);
  if (HABIT_GOALS.has(goal)) chosen.add(goal);

  const chosenLabels = Array.from(chosen).map((id) => LABELS[id]).filter(Boolean);
  const pickedCount = chosenLabels.length;

  // -------- which mode to show --------
  const isWeightFlow = WEIGHT_GOALS.has(goal);
  const isHealthOrHabitFlow = pickedCount > 0 && !isWeightFlow;

  // -------- copy (nutrition-only wording) --------
  const weightHeadline = (() => {
    if (goal === "maintain") {
      if (Number.isFinite(absDiff) && absDiff > 0) {
        return (
          <>
            Aim to stay within{" "}
            <Text style={{ color: "#0057FF" }}>{absDiff} kg</Text> of your target.
          </>
        );
      }
      return "Staying steady at your current weight is absolutely doable.";
    }

    if (Number.isFinite(absDiff)) {
      return (
        <>
          <Text style={{ color: "#0057FF" }}>{absDiff} kg</Text>{" "}
          {diffRaw < 0 ? "to lose" : "to gain"} is achievable with steady habits.
        </>
      );
    }

    // fallback if no goal set yet
    if (Number.isFinite(fallbackDelta)) {
      return (
        <>
          <Text style={{ color: "#0057FF" }}>{fallbackDelta} kg</Text> is a realistic first milestone.
        </>
      );
    }

    // last resort
    if (goal === "lose") return "A steady fat-loss plan is achievable.";
    if (goal === "gain") return "Healthy, sustainable weight gain is achievable.";
    return "Your goal is achievable with steady habits.";
  })();

  const weightSubline = (() => {
    if (goal === "maintain") {
      return "We’ll help you keep intake balanced, prevent drift, and stay consistent.";
    }
    if (goal === "lose") {
      return "We’ll tune meals, portions, and daily targets to reach this safely.";
    }
    if (goal === "gain") {
      return "We’ll guide calories, protein, and meal timing so progress sticks.";
    }
    return "We’ll guide your plan and keep you accountable along the way.";
  })();

  const hhHeadline = (
    <>
      <Text style={{ color: "#0057FF" }}>{pickedCount}</Text>{" "}
      {pickedCount === 1 ? "focus area" : "focus areas"} selected.
    </>
  );

  const hhSubline = (() => {
    const list = joinWithAnd(chosenLabels);
    if (!list) return "We’ll help you track your nutrition with targets and gentle reminders.";
    return `We’ll help you track ${list} with targets and gentle reminders.`;
  })();

  // -------- render --------
  return (
    <View
      style={{
        height: "100%",
        justifyContent: "center",
        alignContent: "center",
        width: "100%",
        backgroundColor: "#fff",
      }}
    >
      <Text
        style={{
          fontSize: size(30),
          textAlign: "center",
          alignSelf: "center",
          width: "90%",
          fontWeight: "700",
        }}
      >
        {isWeightFlow ? weightHeadline : isHealthOrHabitFlow ? hhHeadline : "We’ll help you reach your goals."}
      </Text>

      <Text
        style={{
          fontSize: size(14),
          marginTop: height(2),
          alignSelf: "center",
          textAlign: "center",
          width: "85%",
          fontWeight: "700",
          color: "#999",
        }}
      >
        {isWeightFlow
          ? weightSubline
          : isHealthOrHabitFlow
          ? hhSubline
          : "We’ll guide your plan and keep you accountable along the way."}
      </Text>
    </View>
  );
}
