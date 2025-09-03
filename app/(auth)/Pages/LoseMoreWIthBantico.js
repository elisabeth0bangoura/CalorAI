// BanticoVsSoloCard.js
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { height, size, width } from "react-native-responsive-sizes";

/**
 * Animated comparison card:
 * - Left column = "On your own" (control)
 * - Right column = "With Bantico"
 * - Bars grow from 0 to target when `active` becomes true
 *
 * Props
 *  - title: headline above the card
 *  - leftTitle: label for control column
 *  - rightTitle: label for Bantico column
 *  - controlPercent: number 0..100 (height of left bar)
 *  - multiplier: number (right bar height = controlPercent * multiplier, capped at 100)
 *  - active: boolean – trigger animation when true; resets when false
 *  - style: optional wrapper style
 */
export default function LoseMoreWIthBantico({
  title = "See up to 5× more progress with Bantico vs other apps",
  leftTitle = "With other apps",
  rightTitle = "With Bantico",
  controlPercent = 15,
  multiplier = 5,
  active = true,
  style,
}) {
  // Clamp & derive heights
  const leftTarget = Math.max(0, Math.min(100, Number(controlPercent) || 0));
  const rightTarget = Math.max(
    0,
    Math.min(100, Number(controlPercent) * Number(multiplier))
  );

  // Animation driver
  const progress = useSharedValue(0);

  useEffect(() => {
    // Reset when deactivated, play when active
    progress.value = active ? 0 : 0;
    if (active) {
      progress.value = withTiming(1, { duration: 900 });
    }
  }, [active]);

  const BAR_TRACK_H = height(24); // visual track height
  const BAR_TRACK_W = width(30);

  // Animated heights (grow from 0 to target%)
  const leftBarStyle = useAnimatedStyle(() => {
    const h = interpolate(
      progress.value,
      [0, 1],
      [0, (leftTarget / 100) * BAR_TRACK_H],
      Extrapolate.CLAMP
    );
    return { height: h };
  });

  const rightBarStyle = useAnimatedStyle(() => {
    const h = interpolate(
      progress.value,
      [0, 1],
      [0, (rightTarget / 100) * BAR_TRACK_H],
      Extrapolate.CLAMP
    );
    return { height: h };
  });

  // Fade/slide for the “2×” chip
  const kpiStyle = useAnimatedStyle(() => {
    const o = interpolate(progress.value, [0, 0.7, 1], [0, 0.3, 1]);
    const t = interpolate(progress.value, [0, 1], [8, 0]);
    return { opacity: o, transform: [{ translateY: t }] };
  });

  return (
    <View style={{ width: "100%" }}>
      {/* Headline */}
           <Text style={{ 
            fontSize: 28, marginLeft: width(5), width: "85%", marginTop: height(14), fontWeight: "700" }}>

        {title}
      </Text>

      {/* Card */}
      <View
        style={{
          width: "90%",
          alignSelf: "center",
          marginTop: height(8),
          backgroundColor: "#151515",
          borderRadius: 24,
          paddingVertical: height(4),
          paddingHorizontal: width(5),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {/* LEFT COLUMN — control */}
          <View style={{ width: "48%", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#151515",
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: 12,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: size(14),
                  fontWeight: "800",
                  color: "#5F5F5F",
                  textAlign: "center",
                }}
              >
                {leftTitle}
              </Text>
            </View>

            {/* Track */}
            <View
              style={{
                height: BAR_TRACK_H,
                width: BAR_TRACK_W,
                backgroundColor: "#3E3E3E",
                borderRadius: 18,
                overflow: "hidden",
                justifyContent: "flex-end",
              }}
            >
              <Animated.View
                style={[
                  {
                    width: "100%",
                    backgroundColor: "#5F5F5F",
                    borderRadius: 18,
                  },
                  leftBarStyle,
                ]}
              />
            </View>

            {/* Chip */}
            <View
              style={{
                marginTop: 12,
                backgroundColor: "#151515",
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 14,
              }}
            >
              <Text style={{ fontWeight: "800", color: "#5F5F5F" }}>
                {Math.round(leftTarget)}%
              </Text>
            </View>
          </View>

          {/* RIGHT COLUMN — Bantico */}
          <View style={{ width: "48%", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#151515",
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: 12,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: size(14),
                  fontWeight: "800",
                  color: "#5BC951",
                  textAlign: "center",
                }}
              >
                {rightTitle}
              </Text>
            </View>


            {/* Track */}
            <View
              style={{
                height: BAR_TRACK_H,
                width: BAR_TRACK_W,
                backgroundColor: "#3E3E3E",
                borderRadius: 18,
                overflow: "hidden",
                justifyContent: "flex-end",
              }}
            >
              <Animated.View
                style={[
                  {
                    width: "100%",
                    backgroundColor: "#5BC951",
                    borderRadius: 18,
                  },
                  rightBarStyle,
                ]}
              />
            </View>

            {/* KPI chip */}
            <Animated.View
              style={[
                {
                  marginTop: 12,
                  backgroundColor: "#151515",
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                },
                kpiStyle,
              ]}
            >
              <Text style={{ fontWeight: "800", color: "#5BC951" }}>
                {`${multiplier}×`}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}
