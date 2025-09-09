// GoalProgressWithRange.tsx / .js
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from "@react-native-firebase/firestore";

import { useDailyTargets } from "@/app/Context/DailyPlanProvider";

/* ----------------- utils ----------------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (have, goal) => (goal > 0 ? clamp01(have / goal) : 0);

function toDateSafe(v) {
  return (
    v?.toDate?.() ??
    (v instanceof Date
      ? v
      : typeof v === "number"
      ? new Date(v)
      : typeof v === "string"
      ? new Date(v)
      : v?.seconds
      ? new Date(v.seconds * 1000)
      : null)
  );
}

/* ----------------- UI bits ----------------- */
const RANGES = [
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "All", label: "All", days: null }, // from updatedAt (if set) or first scan
];

const SegBtn = ({ active, label, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <Text
      style={{
        fontSize: size(16),
        fontWeight: "700",
        color: active ? "#000" : "#A6B0B8",
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const Bar = ({ color, label, p }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      marginBottom: height(2),
    }}
  >
    <View
      style={{
        height: height(4),
        width: width(60),
        marginLeft: width(5),
        borderRadius: 10,
        backgroundColor: "#E9EEF3",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: "100%",
          width: `${Math.round(p * 100)}%`,
          backgroundColor: color,
        }}
      />
    </View>
    <Text style={{ marginLeft: width(5) }}>{label}</Text>
  </View>
);

/* =========================================================
   Component
   ========================================================= */
export default function GoalProgressWithRange({range,  paused = false }) {
  const { targets } = useDailyTargets() || {};



  useEffect(() => {

    console.log("range ", range)
  }, [])

  const [sel, setSel] = useState("90d"); // default tab
  const [flags, setFlags] = useState({
    hasDiabetes: false,
    hasKidney: false,
    hasHeart: false,
  });
  const [updatedAt, setUpdatedAt] = useState(null);

  const [totals, setTotals] = useState({
    calories: 0,
    carbsG: 0,
    sugarG: 0,
    fatG: 0,
    proteinG: 0,
    fiberG: 0,
    sodiumMg: 0,
  });
  const [daysInWindow, setDaysInWindow] = useState(1);

  // Refs for incremental aggregation + throttled state flush
  const userUnsubRef = useRef(null);
  const scansUnsubRef = useRef(null);
  const docTotalsRef = useRef(new Map()); // id -> totals for that doc
  const totalsRef = useRef({
    calories: 0,
    carbsG: 0,
    sugarG: 0,
    fatG: 0,
    proteinG: 0,
    fiberG: 0,
    sodiumMg: 0,
  });
  const earliestDateRef = useRef(null);
  const flushScheduledRef = useRef(false);

  const scheduleFlush = () => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    requestAnimationFrame(() => {
      flushScheduledRef.current = false;
      setTotals({ ...totalsRef.current });
      const today0 = sod(new Date());
      const startUsed =
        earliestDateRef.current ? sod(earliestDateRef.current) : today0;
      const days = Math.max(
        1,
        Math.floor((today0 - startUsed) / MS_DAY) + 1
      );
      setDaysInWindow(days);
    });
  };

  const addToTotals = (delta) => {
    const t = totalsRef.current;
    t.calories += delta.calories || 0;
    t.carbsG += delta.carbsG || 0;
    t.proteinG += delta.proteinG || 0;
    t.fatG += delta.fatG || 0;
    t.sugarG += delta.sugarG || 0;
    t.fiberG += delta.fiberG || 0;
    t.sodiumMg += delta.sodiumMg || 0;
  };

  // Convert a Firestore row to "totals" contribution
  const extractDocTotals = (row) => {
    const out = {
      calories: 0,
      carbsG: 0,
      sugarG: 0,
      fatG: 0,
      proteinG: 0,
      fiberG: 0,
      sodiumMg: 0,
    };

    const hasTop =
      row.calories_kcal_total != null ||
      row.carbs_g != null ||
      row.protein_g != null ||
      row.fat_g != null ||
      row.sugar_g != null ||
      row.fiber_g != null ||
      row.sodium_mg != null;

    if (hasTop) {
      out.calories += n(row.calories_kcal_total ?? row.calories_kcal);
      out.carbsG += n(row.carbs_g);
      out.proteinG += n(row.protein_g);
      out.fatG += n(row.fat_g);
      out.sugarG += n(row.sugar_g);
      out.fiberG += n(row.fiber_g);
      out.sodiumMg += n(row.sodium_mg);
    } else if (Array.isArray(row.items)) {
      row.items.forEach((it) => {
        out.calories += n(it.calories_kcal);
        out.carbsG += n(it.carbs_g);
        out.proteinG += n(it.protein_g);
        out.fatG += n(it.fat_g);
        out.sugarG += n(it.sugar_g);
        out.fiberG += n(it.fiber_g);
        out.sodiumMg += n(it.sodium_mg);
      });
    }
    return out;
  };

  const resetAgg = () => {
    docTotalsRef.current.clear();
    totalsRef.current = {
      calories: 0,
      carbsG: 0,
      sugarG: 0,
      fatG: 0,
      proteinG: 0,
      fiberG: 0,
      sodiumMg: 0,
    };
    earliestDateRef.current = null;
  };

  /* ---------- user doc (conditions + updatedAt) ---------- */
  useEffect(() => {
    if (paused) return;

    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    if (userUnsubRef.current) {
      userUnsubRef.current();
      userUnsubRef.current = null;
    }
    const ref = doc(getFirestore(), "users", uid);
    userUnsubRef.current = onSnapshot(ref, (snap) => {
      const d = snap.data() || {};
      const conds = Array.isArray(d.selectedConditions)
        ? d.selectedConditions.map(String)
        : [];
      const hasDiabetes = !!d.diabetesSettings || conds.includes("diabetesPlan");
      const hasKidney = !!d.kidneySettings || conds.includes("kidneyPlan");
      const hasHeart =
        !!d.heartSettings || conds.includes("heartPlan") || conds.includes("heart");
      setFlags({ hasDiabetes, hasKidney, hasHeart });
      setUpdatedAt(toDateSafe(d.updatedAt) || null);
    });

    return () => {
      if (userUnsubRef.current) {
        userUnsubRef.current();
        userUnsubRef.current = null;
      }
    };
  }, [paused]);

  /* ---------- AllTimeLineScan (selected range; incremental) ---------- */
  useEffect(() => {
    if (paused) {
      // tear down if pausing
      if (scansUnsubRef.current) {
        scansUnsubRef.current();
        scansUnsubRef.current = null;
      }
      return;
    }

    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();
    const colRef = collection(db, "users", uid, "AllTimeLineScan");

    const now = new Date();
    const today0 = sod(now);
    const cfg = RANGES.find((r) => r.key === sel) || RANGES[1];

    // Window start (for "All", prefer updatedAt; fallback to earliest doc we see)
    let rangeStart = cfg.days
      ? new Date(today0.getTime() - (cfg.days - 1) * MS_DAY)
      : null;
    if (!cfg.days && updatedAt) rangeStart = sod(updatedAt);

    // Build query
    let qRef;
    if (rangeStart) {
      qRef = query(
        colRef,
        where("created_at", ">=", rangeStart),
        orderBy("created_at", "asc")
      );
    } else {
      qRef = query(colRef, orderBy("created_at", "asc"));
    }

    // Reset accumulators for new range
    resetAgg();
    setTotals({ ...totalsRef.current });
    setDaysInWindow(1);

    // Subscribe
    if (scansUnsubRef.current) {
      scansUnsubRef.current();
      scansUnsubRef.current = null;
    }
    scansUnsubRef.current = onSnapshot(
      qRef,
      (snap) => {
        // First snapshot arrives as "added" changes; later only deltas.
        snap.docChanges().forEach((chg) => {
          const id = chg.doc.id;
          const row = chg.doc.data() || {};
          const createdAt = toDateSafe(row.created_at);

          if (createdAt) {
            if (
              !earliestDateRef.current ||
              createdAt < earliestDateRef.current
            ) {
              earliestDateRef.current = createdAt;
            }
          }

          if (chg.type === "added") {
            const t = extractDocTotals(row);
            docTotalsRef.current.set(id, t);
            addToTotals(t);
          } else if (chg.type === "removed") {
            const prev = docTotalsRef.current.get(id);
            if (prev) {
              // subtract
              addToTotals({
                calories: -prev.calories,
                carbsG: -prev.carbsG,
                sugarG: -prev.sugarG,
                fatG: -prev.fatG,
                proteinG: -prev.proteinG,
                fiberG: -prev.fiberG,
                sodiumMg: -prev.sodiumMg,
              });
              docTotalsRef.current.delete(id);
            }
          } else if (chg.type === "modified") {
            const prev = docTotalsRef.current.get(id) || {
              calories: 0,
              carbsG: 0,
              sugarG: 0,
              fatG: 0,
              proteinG: 0,
              fiberG: 0,
              sodiumMg: 0,
            };
            const next = extractDocTotals(row);
            // apply delta
            addToTotals({
              calories: next.calories - prev.calories,
              carbsG: next.carbsG - prev.carbsG,
              sugarG: next.sugarG - prev.sugarG,
              fatG: next.fatG - prev.fatG,
              proteinG: next.proteinG - prev.proteinG,
              fiberG: next.fiberG - prev.fiberG,
              sodiumMg: next.sodiumMg - prev.sodiumMg,
            });
            docTotalsRef.current.set(id, next);
          }
        });

        scheduleFlush();
      },
      (e) => {
        console.warn("[GoalProgress] onSnapshot error:", e?.message || e);
      }
    );

    return () => {
      if (scansUnsubRef.current) {
        scansUnsubRef.current();
        scansUnsubRef.current = null;
      }
    };
  }, [sel, updatedAt, paused]);

  /* ---------- Bars (memo) ---------- */
  const bars = useMemo(() => {
    if (!targets) return [];

    const multi = daysInWindow;
    const goal = {
      calories: n(targets.calories) * multi,
      carbsG: n(targets.carbsG) * multi,
      sugarG: n(targets.sugarG) * multi,
      fatG: n(targets.fatG) * multi,
      proteinG: n(targets.proteinG) * multi,
      fiberG: n(targets.fiberG) * multi,
      sodiumMg: n(targets.sodiumMg) * multi,
    };

    const caloriesBar = {
      key: "calories",
      label: "Calories",
      color: "#691AF5",
      p: pct(totals.calories, goal.calories),
    };

    const PRIORITY = { carbs: 100, sugar: 95, sodium: 92, fat: 88, protein: 85 };
    const others = [];

    if (flags.hasDiabetes) {
      others.push(
        {
          key: "carbs",
          label: "Carbs",
          color: "#F7931A",
          prio: PRIORITY.carbs,
          p: pct(totals.carbsG, goal.carbsG),
        },
        {
          key: "sugar",
          label: "Sugar",
          color: "#FF65CF",
          prio: PRIORITY.sugar,
          p: pct(totals.sugarG, goal.sugarG),
        }
      );
    }
    if (flags.hasKidney) {
      others.push(
        {
          key: "sodium",
          label: "Sodium",
          color: "#1E90FF",
          prio: PRIORITY.sodium,
          p: pct(totals.sodiumMg, goal.sodiumMg),
        },
        {
          key: "protein",
          label: "Protein",
          color: "#632EFF",
          prio: PRIORITY.protein,
          p: pct(totals.proteinG, goal.proteinG),
        }
      );
    }
    if (flags.hasHeart) {
      others.push({
        key: "fat",
        label: "Fat",
        color: "#FDFF50",
        prio: PRIORITY.fat,
        p: pct(totals.fatG, goal.fatG),
      });
    }

    const hasAny = flags.hasDiabetes || flags.hasKidney || flags.hasHeart;
    if (!hasAny) return [caloriesBar];

    const top2 = [...others].sort((a, b) => b.prio - a.prio).slice(0, 2);
    return [caloriesBar, ...top2];
  }, [targets, totals, daysInWindow, flags]);

  /* ---------- Render ---------- */
  return (
    <>
      <Text
        style={{
          fontSize: size(18),
          fontWeight: "800",
          marginLeft: width(5),
          marginBottom: height(3),
        }}
      >
        Your Goal Progress
      </Text>

      {/* Range buttons */}
      <View
        style={{
          flexDirection: "row",
          width: "60%",
          marginLeft: width(5),
          marginBottom: height(1),
          height: size(40),
          justifyContent: "space-between",
        }}
      >
        {RANGES.map((r) => (
          <SegBtn
            key={r.key}
            label={r.label}
            active={sel === r.key}
            onPress={() => setSel(r.key)}
          />
        ))}
      </View>

      {/* Progress bars */}
      <View
        style={{
          width: "100%",
          paddingVertical: 40,
          alignSelf: "center",
          borderRadius: 15,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#f1f1f1",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: { elevation: 6, shadowColor: "#000" },
          }),
        }}
      >
        {bars.map((b) => (
          <Bar key={b.key} color={b.color} label={b.label} p={b.p} />
        ))}
        {(!targets || bars.length === 0) && (
          <Text style={{ textAlign: "center", color: "#999" }}>
            Loading goals…
          </Text>
        )}
      </View>
    </>
  );
}
