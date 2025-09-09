// Barcode/LoadingPage.js
import { useSheets } from "@/app/Context/SheetsContext";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, View } from "react-native";
// ⬇️ swap the heavy component for the lightweight base (no internal animation)
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import { height, size } from "react-native-responsive-sizes";

const StageText = memo(function StageText({ label }) {
  return <Text style={styles.stageText}>{label}</Text>;
});

export default function LoadingPage({
  isDone = false,
  onDone,
  introMs = 900,
  cruiseMs = 5000,
  doneMs = 900,
  minShowMs = 600,
}) {
  const { isS3Open } = useSheets();

  const [ringValue, setRingValue] = useState(0);
  const [display, setDisplay] = useState(0);
  const [stageLabel, setStageLabel] = useState("Separating ingredients");
  const [isFinished, setIsFinished] = useState(false);

  const stageRef = useRef(0); // 0,1,2
  const phaseRef = useRef("idle");
  const timersRef = useRef([]);
  const mountedAtRef = useRef(0);
  const currentRef = useRef(0);
  const numAnim = useMemo(() => new RNAnimated.Value(0), []);
  const listenerIdRef = useRef(null);

  const pushT = (t) => {
    timersRef.current.push(t);
    return t;
  };
  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const stopAndClean = useCallback(() => {
    try { numAnim.stopAnimation(); } catch {}
    if (listenerIdRef.current != null) {
      numAnim.removeListener(listenerIdRef.current);
      listenerIdRef.current = null;
    }
    clearAll();
  }, [numAnim, clearAll]);

  // animate number only (ring will snap via value change)
  const animateNumber = useCallback(
    (to, ms, after) => {
      numAnim.stopAnimation((last) => {
        if (typeof last === "number") currentRef.current = last;
        numAnim.setValue(currentRef.current);
        RNAnimated.timing(numAnim, {
          toValue: to,
          duration: ms,
          easing: RNEasing.inOut(RNEasing.cubic),
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished && after) after();
        });
      });
    },
    [numAnim]
  );

  // listener: update number; update label only at 30/60 thresholds
  useEffect(() => {
    if (listenerIdRef.current != null) {
      numAnim.removeListener(listenerIdRef.current);
      listenerIdRef.current = null;
    }
    const id = numAnim.addListener(({ value }) => {
      const v = Math.round(value);
      currentRef.current = v;
      if (isFinished) return;
      setDisplay(v);

      const s = v < 30 ? 0 : v < 60 ? 1 : 2;
      if (s !== stageRef.current) {
        stageRef.current = s;
        if (s === 0) setStageLabel("Separating ingredients");
        else if (s === 1) setStageLabel("Breaking down nutritions");
        else setStageLabel("Calculating nutritions");
      }
    });
    listenerIdRef.current = id;

    return () => {
      if (listenerIdRef.current != null) {
        numAnim.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, [numAnim, isFinished]);

  // phases: one-way only; ring snaps at phase boundaries
  const startPhases = useCallback(() => {
    phaseRef.current = "to20";
    setRingValue(20); // ring snaps (no internal animation)
    animateNumber(20, introMs, () => {
      if (phaseRef.current !== "to20" || isFinished) return;
      phaseRef.current = "to80";
      setRingValue(80); // ring snaps
      animateNumber(80, cruiseMs, () => {
        if (phaseRef.current === "to80" && !isFinished) {
          phaseRef.current = "hold80";
        }
      });
    });
  }, [animateNumber, introMs, cruiseMs, isFinished]);

  const finishNow = useCallback(() => {
    if (phaseRef.current === "done" || phaseRef.current === "to100" || isFinished) return;
    const elapsed = Date.now() - (mountedAtRef.current || 0);
    const wait = Math.max(0, minShowMs - elapsed);

    pushT(
      setTimeout(() => {
        phaseRef.current = "to100";
        setRingValue(100); // ring snaps
        animateNumber(100, doneMs, () => {
          phaseRef.current = "done";
          setIsFinished(true);
          setDisplay(100);
          stopAndClean(); // stop timers + listener
          onDone && onDone();
        });
      }, wait)
    );
  }, [animateNumber, doneMs, minShowMs, onDone, stopAndClean, isFinished]);

  // lifecycle
  useEffect(() => {
    if (!isS3Open) return;
    mountedAtRef.current = Date.now();
    setIsFinished(false);
    clearAll();

    stageRef.current = 0;
    phaseRef.current = "idle";
    currentRef.current = 0;
    setRingValue(0);
    setDisplay(0);
    setStageLabel("Separating ingredients");
    numAnim.setValue(0);

    startPhases();

    return () => {
      phaseRef.current = "idle";
      stopAndClean();
    };
  }, [isS3Open, startPhases, clearAll, numAnim, stopAndClean]);

  // move to 100 when ready
  useEffect(() => {
    if (!isS3Open) return;
    if (isDone) finishNow();
  }, [isDone, isS3Open, finishNow]);

  const RADIUS = 120;

  return (
    <View style={{ height: height(100), width: "100%" }}>
      <View style={styles.container}>
        <View style={{ alignSelf: "center", width: RADIUS * 2, height: RADIUS * 2, position: "relative" }}>
          {/* Lightweight ring: zero-duration (no internal animation) */}
          <CircularProgressBase
            value={ringValue}
            maxValue={100}
            radius={RADIUS}
            duration={0}                // ⬅️ no internal animations
            showProgressValue={false}
            activeStrokeColor={"#000"}
            activeStrokeWidth={10}
            inActiveStrokeColor={"#E6ECF2"}
            inActiveStrokeOpacity={0.35}
            inActiveStrokeWidth={10}
          />
          <View style={styles.centerWrap} pointerEvents="none">
            <Text style={styles.centerNumber}>{String(display)}</Text>
          </View>
        </View>

        <StageText label={stageLabel} />
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
