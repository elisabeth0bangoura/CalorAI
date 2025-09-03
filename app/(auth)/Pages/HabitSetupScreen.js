import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

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
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <View style={{ flexDirection: "row", marginTop: height(2), alignItems: "center" }}>
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
          value={String(value)}
          onChangeText={(t) => {
            const n = parseInt(t.replace(/[^\d]/g, ""), 10);
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

export default function HabitSetupScreen({ goalId }) {
  const { habitSettings, setHabitSettings } = useOnboarding();

  const isCoffee = goalId === "reduceCoffee";
  const isSmoking = goalId === "stopSmoking";

  const title = isCoffee ? "Cut back on caffeine" : "Quit smoking";
  const subtitle = isCoffee
    ? "Set a daily cup limit & reminders."
    : "Set a daily cig limit & a quit plan.";

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 28, marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
        {title}
      </Text>
      <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
        {subtitle}
      </Text>

      <View style={{ width: "90%", alignSelf: "center", marginTop: height(4) }}>
        {isCoffee && (
          <Row label="Daily coffee target" helper="Aim for fewer cups per day over time.">
            <Stepper
              value={habitSettings.coffeePerDayTarget ?? 2}
              onChange={(n) => setHabitSettings((p) => ({ ...p, coffeePerDayTarget: n }))}
              min={0} max={15} step={1} unit="cups"
            />
          </Row>
        )}

        {isSmoking && (
          <Row label="Daily cigarette target" helper="Set a target moving towards zero.">
            <Stepper
              value={habitSettings.cigarettesPerDayTarget ?? 0}
              onChange={(n) => setHabitSettings((p) => ({ ...p, cigarettesPerDayTarget: n }))}
              min={0} max={60} step={1} unit="cigs"
            />
          </Row>
        )}

        <Row label="Reminders">
          <Switch
            value={!!habitSettings.reminders}
            onValueChange={(v) => setHabitSettings((p) => ({ ...p, reminders: v }))}
          />
        </Row>
      </View>
    </View>
  );
}
