// PageAfterScan_Scan_Food/LoadingPage.js
import { useSheets } from "@/app/Context/SheetsContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, View } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size } from "react-native-responsive-sizes";

const DEFAULT_MESSAGES = [
  "Separating ingredients",
  "Breaking down nutritions",
  "Searching nutrition database",
];

/**
 * One-way, no-loop loader with 3 phases:
 * 0 → 20 (intro) → 80 (cruise & hold) → 100 (finish when isDone=true)
 * - No reAnimate() calls (avoids resets).
 * - We change `value` prop and the library animates between values.
 * - Center number is tweened in JS to match the ring.
 */
export default function LoadingPage_ExpirationDate({
  messages = DEFAULT_MESSAGES,
  isDone = false,   // flip true when data is ready
  onDone,
  introMs = 900,    // 0 → 20
  cruiseMs = 5000,  // 20 → 80
  doneMs = 900,     // → 100
  msgStepMs = 1200,
  minShowMs = 600,
}) {
  const { isS3Open } = useSheets();

  // what the ring animates to
  const [ringValue, setRingValue] = useState(0);
  // what we show in the center (synced with ring phases)
  const [display, setDisplay] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);

  // phase machine: 'idle' | 'to20' | 'to80' | 'hold80' | 'to100' | 'done'
  const phaseRef = useRef("idle");
  const timersRef = useRef([]);
  const mountedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const currentRef = useRef(0);

  const slideAnim = useRef(new RNAnimated.Value(0)).current;

  const pushT = (t) => {
    timersRef.current.push(t);
    return t;
  };
  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runIn = useCallback(() => {
    slideAnim.setValue(0);
    RNAnimated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // message rotator (independent, no loops once unmounted)
  const startMsgLoop = useCallback(() => {
    setMsgIndex(0);
    runIn();
    const tick = () => {
      if (cancelledRef.current || phaseRef.current === "done") return;
      setMsgIndex((i) => (i + 1) % Math.max(1, messages.length));
      runIn();
      pushT(setTimeout(tick, msgStepMs));
    };
    pushT(setTimeout(tick, msgStepMs));
  }, [messages.length, msgStepMs, runIn]);

  // tween center number (we control timing; ring animates via prop changes)
  const animateNumber = useCallback((to, ms, after) => {
    const from = currentRef.current;
    const start = Date.now();
    const step = () => {
      if (cancelledRef.current || phaseRef.current === "done") return;
      const r = Math.min(1, (Date.now() - start) / ms);
      const val = Math.round(from + (to - from) * r);
      currentRef.current = val;
      setDisplay(val);
      if (r < 1) {
        pushT(setTimeout(step, 16));
      } else if (after) {
        after();
      }
    };
    pushT(setTimeout(step, 16));
  }, []);

  // kick off phases (no repetition; only forward)
  const startPhases = useCallback(() => {
    phaseRef.current = "to20";
    setRingValue(20);
    animateNumber(20, introMs, () => {
      if (phaseRef.current !== "to20") return;
      phaseRef.current = "to80";
      setRingValue(80);
      animateNumber(80, cruiseMs, () => {
        if (phaseRef.current === "to80") {
          phaseRef.current = "hold80"; // wait here for isDone
        }
      });
    });
  }, [animateNumber, introMs, cruiseMs]);

  // finish (called once)
  const finishNow = useCallback(() => {
    if (phaseRef.current === "done" || phaseRef.current === "to100") return;

    const elapsed = Date.now() - (mountedAtRef.current || 0);
    const wait = Math.max(0, minShowMs - elapsed);

    pushT(
      setTimeout(() => {
        phaseRef.current = "to100";
        setRingValue(100);
        // start from whatever we currently show (0..80)
        const startFrom = currentRef.current;
        animateNumber(100, doneMs, () => {
          phaseRef.current = "done";
          onDone && onDone();
        });
      }, wait)
    );
  }, [animateNumber, doneMs, minShowMs, onDone]);

  // lifecycle
  useEffect(() => {
    if (!isS3Open) return;
    mountedAtRef.current = Date.now();
    cancelledRef.current = false;
    clearAll();

    // init
    currentRef.current = 0;
    setRingValue(0);
    setDisplay(0);

    startMsgLoop();
    startPhases();

    return () => {
      cancelledRef.current = true;
      clearAll();
      phaseRef.current = "idle";
    };
  }, [isS3Open, startMsgLoop, startPhases, clearAll]);

  // advance to 100 when data is ready
  useEffect(() => {
    if (!isS3Open) return;
    if (isDone) finishNow();
  }, [isDone, isS3Open, finishNow]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const opacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const RADIUS = 120;

  return (
    <View style={{ height: height(100), width: "100%" }}>
      <View style={styles.container}>
        <View style={{ alignSelf: "center", width: RADIUS * 2, height: RADIUS * 2, position: "relative" }}>
          {/* IMPORTANT: we only change `value` forward; no reAnimate() calls */}
          <CircularProgress
            value={ringValue}
            maxValue={100}
            radius={RADIUS}
            duration={
              phaseRef.current === "to20" ? introMs :
              phaseRef.current === "to80" ? cruiseMs :
              phaseRef.current === "to100" ? doneMs : 200
            }
            showProgressValue={false}
          />
          <View style={styles.centerWrap} pointerEvents="none">
            <Text style={styles.centerNumber}>{String(display)}</Text>
          </View>
        </View>

        <RNAnimated.Text style={[styles.stageText, { opacity, transform: [{ translateY }] }]}>
          {messages[msgIndex] ?? ""}
        </RNAnimated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center" },
  centerWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  centerNumber: { fontSize: size(30), fontWeight: "800", color: "#000" },
  stageText: { marginTop: 24, textAlign: "center", fontSize: size(16), fontWeight: "700", color: "#111" },
});
