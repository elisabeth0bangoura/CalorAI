import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { height, size, width } from "react-native-responsive-sizes";
import Svg, { Defs, LinearGradient, Polyline, Stop } from "react-native-svg";

// Animated Polyline for stroke-dash animation
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

/** Utility: map numbers to a polyline in a fixed viewBox (responsive via SVG scaling) */
function makePolylinePoints(
  values,
  {
    vbWidth = 100,
    vbHeight = 60,
    padX = 6,
    padY = 6,
    valueMin,
    valueMax,
  } = {}
) {
  const n = values.length;
  if (n < 2) return { points: "", length: 0 };

  const max = valueMax ?? Math.max(...values);
  const min = valueMin ?? Math.min(...values);
  const range = max - min || 1;

  const innerW = vbWidth - padX * 2;
  const innerH = vbHeight - padY * 2;
  const stepX = innerW / (n - 1);

  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = padX + i * stepX;
    const norm = (values[i] - min) / range;
    const y = padY + (1 - norm) * innerH; // flip Y
    pts.push([x, y]);
  }

  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    length += Math.hypot(dx, dy);
  }

  return { points: pts.map(([x, y]) => `${x},${y}`).join(" "), length };
}

/** Line that reveals via strokeDashoffset. Re-triggers when `active` flips true. */
function AnimatedLine({
  points,
  totalLength,
  stroke = "#151515",
  strokeWidth = 2.5,
  animate = true,
  delay = 0,
  active = true,
}) {
  // If not animating at all, render static line (no dash) to avoid clipping
  if (!animate) {
    return (
      <Polyline
        points={points}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  const progress = useSharedValue(0);

  useEffect(() => {
    // Only run when this line is "active" (e.g., page is visible)
    if (!active) {
      progress.value = 0; // reset so it can replay next time
      return;
    }

    progress.value = 0;
    const start = () => {
      progress.value = withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
    };

    if (delay > 0) {
      const id = setTimeout(start, delay);
      return () => clearTimeout(id);
    }
    start();
  }, [points, delay, active]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - progress.value) * totalLength,
  }));

  return (
    <AnimatedPolyline
      animatedProps={animatedProps}
      points={points}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeDasharray={`${totalLength}, ${totalLength}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Accuracy block: headline + sub + animated chart (Bantico vs Others) */
export default function BanticoAcurateChart({
  style,
  // demo data (0–100 “accuracy” over 7 points)
  bantico = [58, 60, 65, 75, 85, 95, 105],
  others = [58, 60, 55, 45, 35, 25, 10],
  // colors
  banticoColor = "#5BC951",
  othersColor = "#5F5F5F",
  // NEW: parent passes isActive -> `active`
  active = true,
}) {
  const vbWidth = 100;
  const vbHeight = 60;

  // shared Y-scale so both lines are comparable
  const vMin = Math.min(...bantico, ...others);
  const vMax = Math.max(...bantico, ...others);

  const banticoLine = makePolylinePoints(bantico, {
    vbWidth,
    vbHeight,
    valueMin: vMin,
    valueMax: vMax,
  });
  const othersLine = makePolylinePoints(others, {
    vbWidth,
    vbHeight,
    valueMin: vMin,
    valueMax: vMax,
  });

  return (
    <View style={[{ width: "90%", alignSelf: "center" }, style]}>
      {/* Headline + subcopy */}
      <Text style={{ fontSize: 28, width: "90%", marginTop: height(14), fontWeight: "700" }}>
        Bantico stays accurate and has more benefits.
      </Text>
      <Text style={{ fontSize: 14, color: "#60646C", marginBottom: 14, lineHeight: 20 }}>
        We fuse verified nutrition data, on-device models, and your daily 
        signals to keep estimates tight—no guessy shortcuts.
      </Text>

      {/* Chart */}
      <View style={{ marginTop: height(5), backgroundColor: "#151515", borderRadius: 15, padding: 12 }}>
        <Svg viewBox={`0 0 ${vbWidth} ${vbHeight}`} style={{ width: "100%", height: 160 }}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={banticoColor} stopOpacity="0.18" />
              <Stop offset="1" stopColor={banticoColor} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Others (static) */}
          <AnimatedLine
            points={othersLine.points}
            totalLength={othersLine.length}
            stroke={othersColor}
            strokeWidth={2}
            animate={false}
          />

          {/* Bantico (animated; replays when `active` becomes true) */}
          <AnimatedLine
            points={banticoLine.points}
            totalLength={banticoLine.length}
            stroke={banticoColor}
            strokeWidth={3}
            animate
            active={active}
          />
        </Svg>

        <View
          style={{
            width: "90%",
            marginTop: height(5),
            alignSelf: "center",
            height: 100,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: width(12),
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                height: size(25),
                width: size(25),
                backgroundColor: banticoColor,
                borderRadius: size(25) / 2,
              }}
            />
            <Text
              style={{
                fontSize: size(13),
                marginTop: height(1),
                color: banticoColor,
              }}
            >
              Bantico
            </Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <View
              style={{
                height: size(25),
                width: size(25),
                backgroundColor: othersColor,
                borderRadius: size(25) / 2,
              }}
            />
            <Text
              style={{
                fontSize: size(13),
                color: othersColor,
                marginTop: height(1),
              }}
            >
              Other Apps
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
