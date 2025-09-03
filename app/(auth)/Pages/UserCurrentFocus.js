// UserCurrentFocus.js
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

// Lucide icons
import {
  Activity,
  Cigarette,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  HeartPulse,
  Minus,
} from "lucide-react-native";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

// ── Goal sets with icons (single icon each) ───────────────────────────
export const GOAL_SETS = {
  healthFirst: [
    {
      id: "trackhealth",
      label: "Manage my health",
      helper: "Blood sugar, hydration & organ support",
      icons: [Heart],
    },
    {
      id: "diabetesPlan",
      label: "Diabetes support",
      helper: "Track carbs & balance blood sugar",
      icons: [Activity],
    },
    {
      id: "kidneyPlan",
      label: "Kidney support",
      helper: "Lower sodium & hydration balance",
      icons: [Droplets],
    },
    {
      id: "heartPlan",
      label: "Heart health",
      helper: "Support blood pressure & cholesterol",
      icons: [HeartPulse],
    },
    {
      id: "reduceCoffee",
      label: "Cut back on caffeine",
      helper: "Better sleep & steady energy",
      icons: [Coffee],
    },
    {
      id: "stopSmoking",
      label: "Quit smoking",
      helper: "Improve health & recovery",
      icons: [Cigarette],
    },
    {
      id: "lose",
      label: "Lose body fat",
      helper: "Health & leanness",
      icons: [Flame],
    },
    {
      id: "maintain",
      label: "Hold current weight",
      helper: "Consistency",
      icons: [Minus],
    },
    {
      id: "gain",
      label: "Increase muscle & weight",
      helper: "Healthy gain",
      icons: [Dumbbell],
    },
  ],
};

// 👉 Multi-select group (health conditions **and** habits)
const MULTI_SELECT_IDS = new Set([
  "trackhealth",
  "diabetesPlan",
  "kidneyPlan",
  "heartPlan",
  "reduceCoffee",
  "stopSmoking",
]);

// 👉 Weight goals remain single-select via `goal`
const WEIGHT_GOALS = new Set(["lose", "maintain", "gain"]);

export default function UserCurrentFocus() {
  const GOALS = GOAL_SETS.healthFirst;

  const {
    // single-select for weight goals
    goal,
    setGoal,

    // multi-select for health + habits
    selectedConditions,
    toggleCondition,

    // defaults per selection
    setDiabetesSettings,
    setKidneySettings,
    setHeartSettings,
    setHabitSettings,
  } = useOnboarding();

  const handleSelect = (id) => {
    if (MULTI_SELECT_IDS.has(id)) {
      // Toggle in the multi-select list
      toggleCondition(id);

      // Seed sensible defaults per selection
      if (id === "diabetesPlan") {
        setDiabetesSettings?.((prev) => ({
          ...prev,
          trackCarbs: true,
          carbTargetPerMeal: 45,
          glucoseReminders: false,
        }));
      } else if (id === "kidneyPlan") {
        setKidneySettings?.((prev) => ({
          ...prev,
          sodiumLimitMg: 2000,
          hydrationGoalCups: 8,
          proteinLevel: "moderate",
        }));
      } else if (id === "heartPlan") {
        setHeartSettings?.((prev) => ({
          ...prev,
          sodiumLimitMg: 1500,
          trackBP: false,
          satFatLimit: "moderate",
        }));
      } else if (id === "reduceCoffee") {
        setHabitSettings?.((prev) => ({
          ...prev,
          coffeePerDayTarget: 2,
          reminders: true,
        }));
      } else if (id === "stopSmoking") {
        setHabitSettings?.((prev) => ({
          ...prev,
          cigarettesPerDayTarget: 0,
          reminders: true,
        }));
      }
      return;
    }

    // Single-select for weight goals
    if (WEIGHT_GOALS.has(id)) {
      setGoal(id);
    }
  };

  const isSelected = (id) =>
    MULTI_SELECT_IDS.has(id) ? selectedConditions?.includes(id) : goal === id;

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <AppBlurHeader />

      <ScrollView
        style={{ height: "100%", width: "100%" }}
        contentContainerStyle={{ paddingTop: height(14), paddingBottom: height(20) }}
      >
        <Text style={{ fontSize: 28, marginLeft: width(5), fontWeight: "700" }}>
          What's your current Goal?
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
          This helps us tailor your plan to match your routine.
        </Text>

        <FlatList
          style={{ marginTop: height(4) }}
          data={GOALS}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const selected = isSelected(item.id);
            return (
              <Pressable
                onPress={() => handleSelect(item.id)}
                style={({ pressed }) => [
                  {
                    width: "90%",
                    alignSelf: "center",
                    marginVertical: 8,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    backgroundColor: selected ? "#151515" : "#F1F3F9",
                  },
                  pressed && !selected ? { opacity: 0.9 } : null,
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", marginRight: width(5) }}>
                    {(item.icons || []).map((IconCmp, idx) => (
                      <IconCmp
                        key={idx}
                        size={size(18)}
                        color={selected ? "#fff" : "#111"}
                        style={{
                          marginRight: idx < (item.icons?.length ?? 0) - 1 ? 6 : 0,
                        }}
                      />
                    ))}
                  </View>

                  <Text
                    style={{
                      fontSize: size(16),
                      fontWeight: "800",
                      color: selected ? "#fff" : "#111",
                    }}
                  >
                    {item.label}
                  </Text>
                </View>

                {!!item.helper && (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: size(12),
                      marginLeft: width(10),
                      fontWeight: "600",
                      color: selected ? "rgba(255,255,255,0.7)" : "#BCC1CA",
                    }}
                  >
                    {item.helper}
                  </Text>
                )}

                {/* Hint for multi-select items (health + habits) */}
                {MULTI_SELECT_IDS.has(item.id) && selected && (
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: size(11),
                      marginLeft: width(10),
                      fontWeight: "600",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    You can select multiple options here.
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      </ScrollView>
    </View>
  );
}
