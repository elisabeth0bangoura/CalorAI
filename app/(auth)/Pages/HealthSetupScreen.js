import { useMemo } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

/* show the goal-weight picker only for these */
const WEIGHT_GOALS = new Set(["lose", "maintain", "gain"]);

/* ---------- UI bits (keeps your styling) ---------- */
function Row({ label, children, helper }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: size(14), fontWeight: "800", color: "#111", marginBottom: 6 }}>
        {label}
      </Text>
      {children}
      {!!helper && (
        <Text style={{ fontSize: size(11), color: "#98A2B3", marginTop: 6 }}>
          {helper}
        </Text>
      )}
    </View>
  );
}

function Stepper({ value, onChange, min = 0, max = 9999, step = 1, unit }) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const dec = () => onChange(Math.max(min, safe - step));
  const inc = () => onChange(Math.min(max, safe + step));

  return (
    <View style={{ flexDirection: "row", marginBottom: height(3), marginTop: height(3), alignItems: "center" }}>
      <Pressable
        onPress={dec}
        style={{
          width: 44, height: 40, borderRadius: 10, backgroundColor: "#F1F3F9",
          alignItems: "center", justifyContent: "center", marginRight: 10,
        }}
      >
        <Text style={{ fontSize: size(18), fontWeight: "800" }}>−</Text>
      </Pressable>

      <View style={{
        flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 40,
        borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff"
      }}>
        <TextInput
          value={String(value ?? "")}
          onChangeText={(t) => {
            const digits = t.replace(/[^\d]/g, "");
            if (digits === "") { onChange(min); return; }
            const n = parseInt(digits, 10);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          keyboardType="number-pad"
          style={{ minWidth: 40, fontSize: size(14), fontWeight: "700", color: "#111", paddingVertical: 0 }}
        />
        {unit ? <Text style={{ marginLeft: 6, color: "#6B7280" }}>{unit}</Text> : null}
      </View>

      <Pressable
        onPress={inc}
        style={{
          width: 44, height: 40, borderRadius: 10, backgroundColor: "#F1F3F9",
          alignItems: "center", justifyContent: "center", marginLeft: 10,
        }}
      >
        <Text style={{ fontSize: size(18), fontWeight: "800" }}>+</Text>
      </Pressable>
    </View>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: "#F1F3F9",
      borderRadius: 12,
      padding: 4,
      alignSelf: "flex-start"
    }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
              backgroundColor: selected ? "#151515" : "transparent",
              marginRight: 4,
            }}
          >
            <Text style={{ color: selected ? "#fff" : "#111", fontWeight: "700", fontSize: size(12) }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Screen (multi-select aware) ---------- */
export default function HealthSetupScreen({active, goalId, goalIds }) {
  const {
    diabetesSettings, setDiabetesSettings,
    kidneySettings, setKidneySettings,
    heartSettings, setHeartSettings,
    habitSettings, setHabitSettings,
    selectedConditions,
    goal, // ⬅️ read selected weight goal
  } = useOnboarding();

  // Normalize ids to an array (fallback to context)
  const ids = useMemo(() => {
    if (Array.isArray(goalIds) && goalIds.length) return goalIds;
    if (goalId) return [goalId];
    return selectedConditions ?? [];
  }, [goalId, goalIds, selectedConditions]);

  // "Manage my health" → show everything
  const showAll      = ids.includes("trackhealth");
  const showDiabetes = showAll || ids.includes("diabetesPlan");
  const showKidney   = showAll || ids.includes("kidneyPlan");
  const showHeart    = showAll || ids.includes("heartPlan");
  const showCoffee   = showAll || ids.includes("reduceCoffee");
  const showSmoking  = showAll || ids.includes("stopSmoking");

  const multiple = [showDiabetes, showKidney, showHeart, showCoffee, showSmoking]
    .filter(Boolean).length > 1;

  // Clear, constraint-focused copy (includes habits)
  const title = useMemo(() => {
    if (multiple)        return "Set your health & habit targets";
    if (showDiabetes)    return "Set diabetes targets & limits";
    if (showKidney)      return "Set kidney-friendly targets & limits";
    if (showHeart)       return "Set heart-healthy targets & limits";
    if (showCoffee)      return "Set caffeine targets & reminders";
    if (showSmoking)     return "Set smoking reduction targets";
    return "Set health targets & limits";
  }, [multiple, showDiabetes, showKidney, showHeart, showCoffee, showSmoking]);

  const subtitle = useMemo(() => {
    if (multiple || showAll)
      return "These are caps, minimums, and tracking toggles we’ll follow when building your plan.";
    if (showDiabetes)
      return "Per-meal carb targets and blood sugar reminders.";
    if (showKidney)
      return "Daily sodium caps, hydration minimums, and protein guidance.";
    if (showHeart)
      return "Sodium caps, BP tracking, and saturated-fat guidance.";
    if (showCoffee)
      return "Set a daily caffeine limit and optional reminders.";
    if (showSmoking)
      return "Set a daily cigarette target and check-in reminders.";
    return "Set caps, minimums, and tracking your plan should follow.";
  }, [multiple, showAll, showDiabetes, showKidney, showHeart, showCoffee, showSmoking]);

  const Divider = () => (
    <View
      style={{
        height: 1,
        marginBottom: height(3),
        marginTop: height(2),
        backgroundColor: "#EEE",
        marginVertical: 16,
      }}
    />
  );

  return (
    <>
      <AppBlurHeader />

      <ScrollView
        style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: height(20) }}
      >
        <Text style={{ fontSize: 28, width: "85%", marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          {title}
        </Text>
        <Text style={{ fontSize: size(14), width: "85%", marginTop: height(1), marginBottom: height(2), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
          {subtitle}
        </Text>

        <View style={{ width: "90%", alignSelf: "center", marginTop: height(4) }}>
          {/* Diabetes */}
          {showDiabetes && (
            <>
              <Row label="Carbohydrate tracking" helper="Enable tracking to help balance blood sugar.">
                <Switch
                  trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#E6E6E8"
                  value={!!diabetesSettings.trackCarbs}
                  onValueChange={(v) => setDiabetesSettings((p) => ({ ...p, trackCarbs: v }))}
                />
              </Row>

              <Row label="Carb target per meal" helper="Common targets are 30–60g per meal.">
                <Stepper
                  value={diabetesSettings.carbTargetPerMeal}
                  onChange={(n) => setDiabetesSettings((p) => ({ ...p, carbTargetPerMeal: n }))}
                  min={0} max={200} step={5} unit="g"
                />
              </Row>

              <Row label="Blood sugar reminders">
                <Switch
                  trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#E6E6E8"
                  value={!!diabetesSettings.glucoseReminders}
                  onValueChange={(v) => setDiabetesSettings((p) => ({ ...p, glucoseReminders: v }))}
                />
              </Row>

              {(showKidney || showHeart || showCoffee || showSmoking) && <Divider />}
            </>
          )}

          {/* Kidney */}
          {showKidney && (
            <>
              <Row label="Daily sodium limit" helper="Talk to your clinician for a target that fits you.">
                <Stepper
                  value={kidneySettings.sodiumLimitMg}
                  onChange={(n) => setKidneySettings((p) => ({ ...p, sodiumLimitMg: n }))}
                  min={500} max={4000} step={100} unit="mg"
                />
              </Row>

              <Row label="Hydration goal" helper="Cups of water per day.">
                <Stepper
                  value={kidneySettings.hydrationGoalCups}
                  onChange={(n) => setKidneySettings((p) => ({ ...p, hydrationGoalCups: n }))}
                  min={4} max={20} step={1} unit="cups"
                />
              </Row>

              <Row label="Protein level">
                <Segmented
                  options={[
                    { label: "Low", value: "low" },
                    { label: "Moderate", value: "moderate" },
                    { label: "High", value: "high" },
                  ]}
                  value={kidneySettings.proteinLevel}
                  onChange={(val) => setKidneySettings((p) => ({ ...p, proteinLevel: val }))}
                />
              </Row>

              {(showHeart || showCoffee || showSmoking) && <Divider />}
            </>
          )}

          {/* Heart */}
          {showHeart && (
            <>
              <Row label="Daily sodium limit" helper="Lower sodium helps blood pressure.">
                <Stepper
                  value={heartSettings.sodiumLimitMg}
                  onChange={(n) => setHeartSettings((p) => ({ ...p, sodiumLimitMg: n }))}
                  min={500} max={4000} step={100} unit="mg"
                />
              </Row>

              <Row label="Track blood pressure">
                <Switch
                  trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#E6E6E8"
                  value={!!heartSettings.trackBP}
                  onValueChange={(v) => setHeartSettings((p) => ({ ...p, trackBP: v }))}
                />
              </Row>

              <Row label="Saturated fat limit">
                <Segmented
                  options={[
                    { label: "Low", value: "low" },
                    { label: "Moderate", value: "moderate" },
                    { label: "High", value: "high" },
                  ]}
                  value={heartSettings.satFatLimit}
                  onChange={(val) => setHeartSettings((p) => ({ ...p, satFatLimit: val }))}
                />
              </Row>

              {(showCoffee || showSmoking) && <Divider />}
            </>
          )}

          {/* Coffee (caffeine) */}
          {showCoffee && (
            <>
              <Row label="Daily caffeine limit" helper="Set a daily coffee target. You’ll get gentle nudges if you go over.">
                <Stepper
                  value={habitSettings.coffeePerDayTarget ?? 2}
                  onChange={(n) => setHabitSettings((p) => ({ ...p, coffeePerDayTarget: n }))}
                  min={0} max={15} step={1} unit="cups"
                />
              </Row>

              <Row label="Caffeine reminders">
                <Switch
                  trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#E6E6E8"
                  value={!!habitSettings.reminders}
                  onValueChange={(v) => setHabitSettings((p) => ({ ...p, reminders: v }))}
                />
              </Row>

              {showSmoking && <Divider />}
            </>
          )}

          {/* Smoking */}
          {showSmoking && (
            <>
              <Row label="Cigarettes per day target" helper="We’ll track against this and suggest reductions over time.">
                <Stepper
                  value={habitSettings.cigarettesPerDayTarget ?? 0}
                  onChange={(n) => setHabitSettings((p) => ({ ...p, cigarettesPerDayTarget: n }))}
                  min={0} max={60} step={1} unit="cigs"
                />
              </Row>

              <Row label="Check-in reminders">
                <Switch
                  trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#E6E6E8"
                  value={!!habitSettings.reminders}
                  onValueChange={(v) => setHabitSettings((p) => ({ ...p, reminders: v }))}
                />
              </Row>
            </>
          )}

          {/* Goal weight — render for any weight goal */}
         
        </View>
      </ScrollView>
    </>
  );
}
