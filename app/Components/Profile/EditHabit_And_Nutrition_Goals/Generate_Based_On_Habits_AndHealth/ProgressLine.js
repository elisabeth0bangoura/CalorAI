// ProgressLine.js
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

export default function ProgressLine({ step, total }) {
  const [max, setMax] = useState(0);              // measured width of the track
  const w = useSharedValue(0);                    // animated bar width
  const lastTarget = useRef(-1);                  // guard to avoid repeat anims

  // Animate when step/total/max changes
  useEffect(() => {
    if (!max || !total) return;                   // avoid NaN / 0 division
    const clampedStep = Math.max(0, Math.min(step, total));
    const target = (clampedStep / total) * max;

    // Only animate if target actually changed
    if (Number.isFinite(target) && target !== lastTarget.current) {
      lastTarget.current = target;
      w.value = withTiming(target, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [step, total, max, w]);

  const barStyle = useAnimatedStyle(() => ({
    width: w.value,
  }));

  return (
    <View
      // Measure available width from layout (stable; no global dimension churn)
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        if (width && width !== max) setMax(width);
      }}
      style={{
        marginTop: 12,
        marginHorizontal: 16,
        height: 4,
        backgroundColor: "#eee",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[
          { height: 4, backgroundColor: "#111", borderRadius: 2 },
          barStyle,
        ]}
      />
    </View>
  );
}
