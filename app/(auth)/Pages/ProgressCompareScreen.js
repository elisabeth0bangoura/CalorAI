// ProgressCompareScreen.js
import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { height, size, width } from "react-native-responsive-sizes";
import Svg, { Path } from "react-native-svg";

/* ----------------------------------
   Helpers
-----------------------------------*/

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Convert a numeric series to points inside a fixed SVG viewBox
function makeSeries(
  values,
  { vbWidth = 100, vbHeight = 60, padX = 6, padY = 8, min, max } = {}
) {
  if (!values?.length) return { pts: [], length: 0 };

  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = hi - lo || 1;

  const innerW = vbWidth - padX * 2;
  const innerH = vbHeight - padY * 2;
  const stepX = innerW / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - lo) / range) * innerH; // flip Y axis
    return [x, y];
  });

  // polyline length (good enough for dash animation)
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    length += Math.hypot(dx, dy);
  }
  return { pts, length };
}

// Catmull–Rom to cubic Bézier for smooth line
function toSmoothPath(pts, tension = 0.5) {
  if (!pts?.length) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const p = pts.map(([x, y]) => ({ x, y }));
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function AnimatedSmoothLine({
  pts,
  approxLength,
  color,
  width = 3,
  delay = 0,
  active = true,
}) {
  const d = useMemo(() => toSmoothPath(pts), [pts]);
  const t = useSharedValue(0);

  // Overdraw dash length a bit to avoid 1px tail from rounding
  const dashLength = useMemo(
    () => Math.max(1, approxLength) + width * 2 + 1, // small epsilon
    [approxLength, width]
  );

  useEffect(() => {
    t.value = 0;
    if (!active) return;
    const start = () =>
      (t.value = withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      }));
    if (delay) {
      const id = setTimeout(start, delay);
      return () => clearTimeout(id);
    }
    start();
  }, [d, delay, active]);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - t.value) * dashLength,
  }));

  return (
    <AnimatedPath
      animatedProps={animatedPathProps}
      d={d}
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeLinecap="butt"     // ⬅️ no rounded end cap (prevents dot)
      strokeLinejoin="round"
      strokeDasharray={`${dashLength} ${dashLength}`}
    />
  );
}

/* ----------------------------------
   Card
-----------------------------------*/

function WeightProgressCompareCard({
  active = true,
  // Bantico compounding up, others peak then fade
  bantico = [0, 1, 2.8, 5.2, 9.5],
  others = [0, 4, 8, 5, 1],
  vbWidth = 100,
  vbHeight = 60,
  banticoColor = "#55C759",
  othersColor = "#6B6F76",
}) {
  // shared Y scale so lines compare fairly
  const min = Math.min(...bantico, ...others);
  const max = Math.max(...bantico, ...others);

  const a = useMemo(
    () => makeSeries(bantico, { vbWidth, vbHeight, min, max }),
    [bantico, min, max]
  );
  const b = useMemo(
    () => makeSeries(others, { vbWidth, vbHeight, min, max }),
    [others, min, max]
  );

  return (
    <View
      style={{
        width: "90%",
        alignSelf: "center",
        backgroundColor: "#151515",
        borderRadius: 22,
        padding: 16,
        height: height(45),
        paddingBottom: 20,
        marginTop: height(5),
      }}
    >
      <Svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        style={{ width: "100%", height: height(22), marginTop: 10 }}
      >
        {/* Other apps (draw first) */}
        <AnimatedSmoothLine
          pts={b.pts}
          approxLength={b.length}
          color={othersColor}
          width={2.5}
          delay={0}
          active={active}
        />

        {/* Bantico on top */}
        <AnimatedSmoothLine
          pts={a.pts}
          approxLength={a.length}
          color={banticoColor}
          width={3.5}
          delay={100}
          active={active}
        />
      </Svg>

      {/* X labels */}
      <View style={{ flexDirection: "row", width: "90%", alignSelf: 'center', justifyContent: "space-between", top: height(3) }}>
        <Text style={{ color: "#9AA0A6", fontSize: size(13), fontWeight: "700" }}>Start</Text>
        <Text style={{ color: "#9AA0A6", fontSize: size(13), fontWeight: "700" }}>1 wk</Text>
        <Text style={{ color: "#9AA0A6", fontSize: size(13), fontWeight: "700" }}>2 wks</Text>
      </View>

      {/* Legend */}
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
              height: size(15),
              width: size(15),
              backgroundColor: banticoColor,
              borderRadius: size(15) / 2,
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
              height: size(15),
              width: size(15),
              backgroundColor: othersColor,
              borderRadius: size(15) / 2,
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
  );
}

/* ----------------------------------
   Screen
-----------------------------------*/

export default function ProgressCompareScreen({ active = true }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Text
        style={{
          fontSize: size(28),
          lineHeight: size(34),
          marginTop: height(14),
          marginLeft: width(5),
          marginRight: width(5),
          fontWeight: "800",
          color: "#111",
        }}
      >
        You’re set up for steady, compounding progress
      </Text>

      <Text
        style={{
          marginLeft: width(5),
          marginTop: height(2),
          fontSize: size(16),
          fontWeight: "600",
          color: "#000",
        }}
      >
        Your progress trend
      </Text>

      <WeightProgressCompareCard active={active} />
    </View>
  );
}
