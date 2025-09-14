// app/(auth)/Pages/HealthSetupScreen.js
import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import { Picker } from "@react-native-picker/picker";
import { memo, useMemo } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader2 from "./AppBlurHeader2";
import DesiredWeight from "./DesiredWeight";

/* show the goal-weight picker only for these */
const WEIGHT_GOALS = new Set(["lose", "maintain", "gain"]);

/* ---------- small helpers ---------- */
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

/* ---------- Divider ---------- */
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

/* ---------- Height & Weight wheels (inline) ---------- */
const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

const safeSelected = (value, items) => {
  if (!items || items.length === 0) return undefined;
  const vals = items.map((it) => it.value);
  if (value == null) return vals[0];
  return vals.includes(value) ? value : vals[0];
};

const PickerCol = ({
  header,
  items,
  value,
  onChange,
  widthPct = "48%",
  itemFontSize = size(20),
  headerFontSize = size(15),
  itemColor = "#111",
}) => (
  <View style={{ width: widthPct }}>
    {!!header && (
      <Text
        style={{
          fontSize: headerFontSize,
          fontWeight: "800",
          alignSelf: "center",
          color: "#111",
          marginBottom: 8,
        }}
      >
        {header}
      </Text>
    )}

    <Picker
      selectedValue={safeSelected(value, items)}
      onValueChange={(v) => {
        const n = typeof v === "string" ? parseInt(v, 10) : v;
        if (!Number.isNaN(n)) onChange(n);
      }}
      style={[
        { height: 180, width: "100%" },
        Platform.OS === "android" && { fontSize: itemFontSize, color: itemColor },
      ]}
      itemStyle={{
        fontSize: itemFontSize,
        fontWeight: "700",
        color: itemColor,
      }}
      dropdownIconColor={itemColor}
    >
      {(items || []).map((it) => (
        <Picker.Item
          key={String(it.value)}
          label={String(it.label)}
          value={it.value}
          color={itemColor}
        />
      ))}
    </Picker>
  </View>
);

const HeightWeightComponent = memo(function HeightWeightComponent() {
  const {
    ft, setFt, inch, setInch, lb, setLb, cm, setCm, kg, setKg,
    unitSystem, setUnitSystem,
    weightUnit, setWeightUnit,
  } = useEditNutrition();

  const isMetric = unitSystem === "metric";

  const feetItems  = useMemo(() => range(4, 7).map((v) => ({ label: `${v} ft`, value: v })), []);
  const inchItems  = useMemo(() => range(0, 11).map((v) => ({ label: `${v} in`, value: v })), []);
  const poundItems = useMemo(() => range(80, 300).map((v) => ({ label: `${v} lb`, value: v })), []);
  const cmItems    = useMemo(() => range(140, 210).map((v) => ({ label: `${v} cm`, value: v })), []);
  const kgItems    = useMemo(() => range(40, 200).map((v) => ({ label: `${v} kg`, value: v })), []);

  const wheelFontSize = size(22);
  const headerFontSize = size(15);

  const toggleUnits = () => {
    const next = isMetric ? "imperial" : "metric";
    setUnitSystem(next);
    setWeightUnit(next === "metric" ? "kg" : "lb");
  };

  return (
   <View style={{ height: "100%", width: "100%" }}>
      <Text
        style={{
          fontSize: size(28),
         marginTop: height(3),
          lineHeight: height(4),
          marginLeft: width(0),
          fontWeight: "700",
        }}
      >
        Height & weight
      </Text>
      <Text style={{ fontSize: size(14), marginTop: height(0),   marginLeft: width(0), fontWeight: "700", color: "#BCC1CA" }}>
        This will be used to calibrate your custom plan.
      </Text>

      {/* Unit switch */}
      <View style={{ width: "100%", alignItems: "center", marginTop: height(8) }}>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
          <Text style={{ fontSize: size(14), fontWeight: "800", color: isMetric ? "#D0D3DA" : "#111" }}>
            Imperial
          </Text>
          <Switch
            trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
            thumbColor="#fff"
            ios_backgroundColor="#E6E6E8"
            onValueChange={toggleUnits}
            value={isMetric}
            style={{ transform: [{ scale: 0.9 }] }}
          />
          <Text style={{ fontSize: size(14), fontWeight: "800", color: isMetric ? "#111" : "#D0D3DA" }}>
            Metric
          </Text>
        </View>
      </View>

      {/* Wheels */}
      {isMetric ? (
        <View style={{ width: "100%", alignSelf: "center", top: height(8) }}>
          <View style={{ height: height(5), zIndex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text style={{ fontSize: size(15), fontWeight: "800", color: "#111" }}>Height</Text>
            </View>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text style={{ fontSize: size(15), fontWeight: "800", color: "#111" }}>Weight</Text>
            </View>
            <AppBlurHeader2 />
          </View>

          <View style={{ flexDirection: "row", marginTop: height(-5), justifyContent: "space-between" }}>
            <View style={{ width: "48%" }}>
              <PickerCol
                items={cmItems}
                value={cm}
                onChange={(n) => setCm(n)}
                widthPct="100%"
                itemFontSize={wheelFontSize}
                headerFontSize={headerFontSize}
              />
            </View>
            <View style={{ width: "48%" }}>
              <PickerCol
                items={kgItems}
                value={kg}
                onChange={(n) => {
                  setKg(n);
                  setWeightUnit("kg");
                }}
                widthPct="100%"
                itemFontSize={wheelFontSize}
                headerFontSize={headerFontSize}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ width: "100%", alignSelf: "center", top: height(8) }}>
          <View style={{ height: height(5), zIndex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text style={{ fontSize: size(15), fontWeight: "800", color: "#111" }}>Height</Text>
            </View>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text style={{ fontSize: size(15), fontWeight: "800", color: "#111" }}>Weight</Text>
            </View>
            <AppBlurHeader2 />
          </View>

          <View style={{ flexDirection: "row", marginTop: height(-5), justifyContent: "space-between" }}>
            {/* Height: ft + in */}
            <View style={{ width: "48%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PickerCol
                  items={feetItems}
                  value={ft}
                  onChange={(n) => setFt(n)}
                  widthPct="55%"
                  itemFontSize={wheelFontSize}
                  headerFontSize={headerFontSize}
                />
                <PickerCol
                  items={inchItems}
                  value={inch}
                  onChange={(n) => setInch(n)}
                  widthPct="60%"
                  itemFontSize={wheelFontSize}
                  headerFontSize={headerFontSize}
                />
              </View>
            </View>

            {/* Weight: lb */}
            <View style={{ width: "45%" }}>
              <PickerCol
                items={poundItems}
                value={lb}
                onChange={(n) => {
                  setLb(n);
                  setWeightUnit("lb");
                }}
                widthPct="100%"
                itemFontSize={wheelFontSize}
                headerFontSize={headerFontSize}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
});




/* ---------- Screen (multi-select aware) ---------- */
export default function HeightWeightPage({ goalId, goalIds }) {
  const {
    diabetesSettings, setDiabetesSettings,
    kidneySettings, setKidneySettings,
    heartSettings, setHeartSettings,
    habitSettings, setHabitSettings,
    selectedConditions,
    goal,
  } = useEditNutrition();

  const ids = useMemo(() => {
    if (Array.isArray(goalIds) && goalIds.length) return goalIds;
    if (goalId) return [goalId];
    return selectedConditions ?? [];
  }, [goalId, goalIds, selectedConditions]);

  const showAll      = ids.includes("trackhealth");
  const showDiabetes = showAll || ids.includes("diabetesPlan");
  const showKidney   = showAll || ids.includes("kidneyPlan");
  const showHeart    = showAll || ids.includes("heartPlan");
  const showCoffee   = showAll || ids.includes("reduceCoffee");
  const showSmoking  = showAll || ids.includes("stopSmoking");

 
  
  return (
    <>


      <ScrollView
        style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: height(20) }}
      >
      

        {/* Inline Height & Weight wheels */}
        <View style={{ width: "90%", alignSelf: "center", marginTop: height(2), marginBottom: height(2) }}>
          <HeightWeightComponent />
        </View>

        <View style={{ width: "90%", alignSelf: "center", marginTop: height(5) }}>
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
          {WEIGHT_GOALS.has(goal) && (
            <>
              <Divider />
              <DesiredWeight embedded />
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
