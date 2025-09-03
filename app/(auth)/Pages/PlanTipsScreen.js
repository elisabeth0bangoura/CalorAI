// PlanTipsScreen.js
import {
    Apple,
    BookOpen,
    Flame,
    FlaskConical,
    GraduationCap,
    Heart,
    Microscope,
    Refrigerator,
    Wheat,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Linking, Platform, Text, View } from "react-native";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useSteps } from "../../Context/StepsContext";

// 🔧 helper: convert HEX → RGBA with opacity
const tint = (hex, alpha = 0.15) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// 🎨 icon → color map (foreground solid, background tinted)
const ICON_COLORS = new Map([
  [Heart,        { fg: "#E23B5C", bg: tint("#E23B5C") }],
  [Apple,        { fg: "#34C759", bg: tint("#34C759") }],
  [Flame,        { fg: "#F59E0B", bg: tint("#F59E0B") }],
  [Wheat,        { fg: "#B45309", bg: tint("#B45309") }],
  [BookOpen,     { fg: "#0A63FF", bg: tint("#0A63FF") }],
  [GraduationCap,{ fg: "#7C3AED", bg: tint("#7C3AED") }],
  [FlaskConical, { fg: "#0891B2", bg: tint("#0891B2") }],
  [Microscope,   { fg: "#16A34A", bg: tint("#16A34A") }],
  [Refrigerator, { fg: "#691AF5", bg: tint("#691AF5") }],
]);

const cardShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  android: { elevation: 2, shadowColor: "#00000044" },
});

export default function PlanTipsScreen({
  isActive,
  active,
  healthScore = 7,
  tips = [
    { icon: Heart, text: "Glance at your daily health score to keep momentum" },
    { icon: Apple, text: "Log meals and drinks so your plan adapts" },
    { icon: Refrigerator, text: "Keep track of what’s in your fridge" },
    { icon: Flame, text: "Aim for today’s calorie budget (a little wiggle room is OK)", showProgress: true },
    { icon: Wheat, text: "Balance carbs, protein, and fats across the day" },
  ],
  sources = [
    { title: "Basal Metabolic Rate (overview)", url: "https://en.wikipedia.org/wiki/Basal_metabolic_rate", icon: BookOpen },
    { title: "Calorie budgeting — Harvard Health", url: "https://www.health.harvard.edu/staying-healthy/calorie-counting-made-easy", icon: GraduationCap },
    { title: "International Society of Sports Nutrition", url: "https://jissn.biomedcentral.com/", icon: FlaskConical },
    { title: "U.S. National Institutes of Health", url: "https://www.nih.gov/", icon: Microscope },
  ],
}) {
  const enabled = (isActive ?? active) === true;
  const { prev, next } = useSteps();

  // animate the health score bar
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pct = Math.max(0, Math.min(10, healthScore)) / 10;
    if (enabled) {
      prog.setValue(0);
      Animated.timing(prog, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
    } else {
      prog.setValue(0);
    }
  }, [enabled, healthScore]);

  const TipRow = ({ icon: Icon, text, showProgress }) => {
    const { fg = "#141518", bg = "#F4F6FA" } = ICON_COLORS.get(Icon) || {};
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          width: "100%",
          borderRadius: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 12,
          ...cardShadow,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            backgroundColor: bg,
          }}
        >
          {showProgress ? (
            <CircularProgressBase
              value={60}
              radius={30}
              activeStrokeWidth={5}
              inActiveStrokeWidth={5}
              inActiveStrokeColor="#E9EDF3"
              activeStrokeColor={fg}
              duration={2000}
            >
              <Flame size={18} color={fg} strokeWidth={2.2} />
            </CircularProgressBase>
          ) : (
            <Icon size={18} color={fg} strokeWidth={2.2} />
          )}
        </View>

        <Text style={{ flex: 1, color: "#1B1D22", fontWeight: "800", fontSize: size(16) }}>
          {text}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ height: "auto", width: "100%" }}>
      {/* Health score card */}
      <View
        style={{
          marginHorizontal: width(5),
          backgroundColor: "#fff",
          borderRadius: 22,
          padding: 14,
          ...cardShadow,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: ICON_COLORS.get(Heart)?.bg || "#FFF",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Heart size={14} color={ICON_COLORS.get(Heart)?.fg || "#E23B5C"} strokeWidth={2.4} />
          </View>
          <Text style={{ fontWeight: "900", fontSize: size(16), color: "#141518", flex: 1 }}>
            Health Score
          </Text>
          <Text style={{ fontWeight: "900", color: "#141518" }}>{healthScore}/10</Text>
        </View>

        <View style={{ height: size(8), borderRadius: 8, overflow: "hidden", backgroundColor: "#E9EDF3" }}>
          <Animated.View
            style={{
              height: "100%",
              width: prog.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              backgroundColor: "#76DB8B",
            }}
          />
        </View>
      </View>

      {/* Tips */}
      <View style={{ marginTop: height(3), marginHorizontal: width(5), borderRadius: 22, padding: 16 }}>
        <Text style={{ fontWeight: "900", color: "#141518", fontSize: size(18), marginBottom: 12 }}>
          Simple ways to stay on track
        </Text>
        {tips.map((t, i) => (
          <TipRow key={`${t.text}-${i}`} icon={t.icon} text={t.text} showProgress={t.showProgress} />
        ))}
      </View>

      {/* Sources */}
      <View style={{ marginTop: height(3), paddingHorizontal: width(5) }}>
        <Text
          style={{
            fontWeight: "900",
            lineHeight: height(2.5),
            fontSize: size(16),
            color: "#141518",
            marginBottom: height(2),
          }}
        >
          This plan is informed by the following references and other peer-reviewed research:
        </Text>
        {sources.map((s, i) => {
          const Icon = s.icon;
          return (
            <View key={s.title + i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Icon size={14} color={"#000"} style={{ marginRight: 6 }} />
              <Text
                onPress={() => s.url && Linking.openURL(s.url)}
                style={{ color: "#000", textDecorationLine: "underline", fontSize: size(16) }}
              >
                {s.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
