import { Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useSteps } from "../../Context/StepsContext";

/**
 * Animated loading screen:
 * - Smooth ring sweep (0→100) using the library
 * - Our own centered % text (always correct)
 * - Subtitle changes by stages
 * - Checklist items reveal progressively
 */
export default function PlanGeneratingScreen({ isActive, active }) {
  const enabled = (isActive ?? active) === true;
  const { prev } = useSteps();

  const [pct, setPct] = useState(0);
  const [stageText, setStageText] = useState("Customizing health plan...");

  const stages = useMemo(
    () => [
      { at: 0,   text: "Customizing health plan..." },
      { at: 25,  text: "Calculating daily targets..." },
      { at: 50,  text: "Balancing macros..." },
      { at: 75,  text: "Tuning for your goals..." },
      { at: 90,  text: "Finalizing results..." },
      { at: 100, text: "Done!" },
    ],
    []
  );

  // Smooth % with requestAnimationFrame (matches ring duration)
  useEffect(() => {
    if (!enabled) {
      setPct(0);
      setStageText(stages[0].text);
      return;
    }

    const DURATION = 2200; // ms — also used for ring duration
    const start = (global.performance?.now?.() ?? Date.now());
    let raf;

    const tick = () => {
      const now = (global.performance?.now?.() ?? Date.now());
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const value = 100 * eased;

      setPct(value);

      for (let i = stages.length - 1; i >= 0; i--) {
        if (value >= stages[i].at) {
          setStageText(stages[i].text);
          break;
        }
      }

      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, stages]);

  const checks = [
    { label: "Calories", threshold: 20 },
    { label: "Carbs", threshold: 40 },
    { label: "Protein", threshold: 60 },
    { label: "Fats", threshold: 80 },
    { label: "Health Score", threshold: 95 },
  ];

  const cardShadow = Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 6, shadowColor: "#00000044" },
  });

  const RADIUS = 100;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Ring + headline */}
      <View style={{ alignItems: "center", marginTop: height(14) }}>
        <View
          style={{
            width: RADIUS * 2,
            height: RADIUS * 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress
            value={enabled ? 100 : 0}  // ring sweep 0→100
            radius={RADIUS}
            duration={2200}
            maxValue={100}
            showProgressValue={false}  // we render our own number
            inActiveStrokeColor="#D1D5DB"
            inActiveStrokeWidth={10}
            activeStrokeWidth={10}
            activeStrokeColor="#22c55e"
            activeStrokeSecondaryColor="#22c55e"
            rotation={0}
            reAnimateOnValueChange
          />

          {/* Centered percent text */}
          <Text
            style={{
              position: "absolute",
              fontSize: 48,
              fontWeight: "900",
              color: "#141518",
            }}
          >
            {Math.round(pct)}%
          </Text>
        </View>

        <Text
          style={{
            marginTop: height(2),
            fontSize: 28,
            lineHeight: 34,
            fontWeight: "900",
            color: "#141518",
            textAlign: "center",
            paddingHorizontal: width(6),
          }}
        >
          We’re setting everything{"\n"}up for you
        </Text>

        {/* Changing subtitle */}
        <Text style={{ marginTop: height(2), color: "#6A7078", fontWeight: "700" }}>
          {stageText}
        </Text>
      </View>

      {/* Info card with appearing checks */}
      <View
        style={{
          marginTop: height(2),
          marginHorizontal: width(5),
        //  backgroundColor: "#F7F8FE",
          paddingVertical: 16,
          paddingHorizontal: 18,
      
        }}
      >
        <Text style={{ fontWeight: "900", color: "#171A1F", marginBottom: 10 }}>
          Daily recommendation for
        </Text>

        {checks.map((row) => {
          const show = pct >= row.threshold;
          return (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: "#23262B", fontSize: size(16) }}>• {row.label}</Text>
              <Text
                style={{
                  width: 26,
                  textAlign: "center",
                  fontSize: size(16),
                  opacity: show ? 1 : 0.15,
                }}
              >
               <Check />
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
