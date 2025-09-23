// WeightProgressWagmiWithRanges.js
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { height, size, width } from "react-native-responsive-sizes";
import { LineChart } from "react-native-wagmi-charts";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "@react-native-firebase/firestore";

/* ---------- visual tokens ---------- */
const COLORS = {
  line: "#5BC951",
  fill: "#5BC951",
  empty: "#D3DAE0",
  textDim: "#A6B0B8",
  shadow: "#00000050",
};

/* ---------- public ranges ---------- */
export const RANGES = [
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "1Y",  label: "1Y",  days: 365 },
  { key: "All", label: "All", days: null },
];

const MS_DAY = 24 * 60 * 60 * 1000;

/* ---------- helpers ---------- */
const toDate = (v) =>
  v?.toDate?.() ??
  (v instanceof Date
    ? v
    : typeof v === "number"
    ? new Date(v > 1e12 ? v : v * 1000)
    : typeof v === "string"
    ? new Date(v)
    : v?.seconds
    ? new Date(v.seconds * 1000)
    : null);

/* ---------- Big number that follows tooltip when active ---------- */
function HeaderValue({ latestKg }) {
  const { isActive } = LineChart.useChart();
  const [active, setActive] = useState(false);

  useAnimatedReaction(
    () => isActive.value,
    (val) => runOnJS(setActive)(!!val),
    []
  );

  if (active) {
    return (
      <LineChart.PriceText
        precision={1}
        format={({ value }) => {
          "worklet";
          return `${Number(value).toFixed(1)} kg`;
        }}
        style={{ color: "#000", fontSize: size(30), fontWeight: "800" }}
      />
    );
  }

  return (
    <Text style={{ color: "#000", fontSize: size(30), fontWeight: "800" }}>
      {latestKg?.toFixed?.(1) ?? "0.0"} kg
    </Text>
  );
}

/* ---------- component ---------- */
export default function WeightProgressChart({
  heightPx = 180,
  range = "90d",
  title = "Weight Progress",
}) {
  const uid = getAuth().currentUser?.uid;

  const [allPoints, setAllPoints] = useState([]); // [{ timestamp, value(kg) }]
  const [loading, setLoading] = useState(true);

  const selected = useMemo(() => {
    const key = String(range || "").trim();
    return (
      RANGES.find((r) => r.key.toLowerCase() === key.toLowerCase()) ||
      RANGES.find((r) => r.key === "90d")
    );
  }, [range]);

  /* Stream weight from /users/$uid/weightprogrss ordered by createdAt ASC */
  useEffect(() => {
    if (!uid) return;
    const db = getFirestore();
    const qy = query(
      collection(db, "users", uid, "weightprogrss"), // <-- path used
      orderBy("createdAt", "asc")
    );

    setLoading(true);
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = (snap?.docs ?? [])
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .map((row) => {
            const t = toDate(row?.createdAt);
            const kg = Number(row?.kg);
            return t && Number.isFinite(kg)
              ? { timestamp: t.getTime(), value: kg }
              : null;
          })
          .filter(Boolean);

        setAllPoints(rows);
        setLoading(false);
      },
      (err) => {
        console.warn("[WeightChart] onSnapshot error:", err?.message || err);
        setAllPoints([]);
        setLoading(false);
      }
    );
    return () => unsub?.();
  }, [uid]);

  /* Filter by selected range (fallback to All if empty) */
  const { points } = useMemo(() => {
    if (!selected?.days) return { points: allPoints };
    const cutoff = Date.now() - selected.days * MS_DAY;
    const filtered = allPoints.filter((p) => p.timestamp >= cutoff);
    return filtered.length ? { points: filtered } : { points: allPoints };
  }, [selected, allPoints]);

  const hasData = points.length > 0;

  /* y-range padding */
  const yRange = useMemo(() => {
    if (!hasData) return undefined;
    let min = Math.min(...points.map((p) => p.value));
    let max = Math.max(...points.map((p) => p.value));
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }
    const pad = (max - min) * 0.07 || 0.5;
    return { min: min - pad, max: max + pad };
  }, [points, hasData]);

  // Latest weight (shown when cursor not active)
  const latestKg = points.at(-1)?.value ?? 0;

  const providerKey = `${selected.key}-${points.length}-${points.at(-1)?.timestamp || 0}`;

  return (
    <>
      {hasData ? (
        <LineChart.Provider key={providerKey} data={points} yRange={yRange}>
          {/* header + big number */}
          <View style={{ paddingHorizontal: width(5), marginBottom: 8 }}>
            <Text style={{ fontSize: size(18), marginBottom: height(1), fontWeight: "800" }}>
              {title}
            </Text>
            <HeaderValue latestKg={latestKg} />
          </View>

          {/* chart card */}
          <View
            style={{
              width: "100%",
              borderRadius: 16,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#f1f1f1",
              paddingVertical: 12,
              marginTop: height(2),
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.01,
                  shadowRadius: 10,
                },
                android: { elevation: 2, shadowColor: COLORS.shadow },
              }),
            }}
          >
            <LineChart height={heightPx} yGutter={16} width={Math.round(width(90))}>
              <LineChart.Path color={COLORS.line} width={3}>
                <LineChart.Gradient color={COLORS.fill} />
              </LineChart.Path>

              {/* Tooltip now shows the DATE (not the kg number) */}
              <LineChart.CursorCrosshair color={COLORS.line}>
                <LineChart.Tooltip
                  position="top"
                  textStyle={{
                    backgroundColor: "black",
                    borderRadius: 6,
                    color: "white",
                    fontSize: 12,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <LineChart.DatetimeText
                    options={{ month: "short", day: "numeric" }} // e.g., "Sep 9"
                  />
                </LineChart.Tooltip>
                <LineChart.HoverTrap />
              </LineChart.CursorCrosshair>
            </LineChart>
          </View>
        </LineChart.Provider>
      ) : (
        <>
          <View style={{ paddingHorizontal: width(5), marginBottom: 8 }}>
            <Text style={{ fontSize: size(18), marginBottom: height(1), fontWeight: "800" }}>
              {title}
            </Text>
          </View>

          <View
            style={{
              width: "100%",
              borderRadius: 16,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#f1f1f1",
              paddingVertical: 12,
              marginTop: height(2),
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View style={{ height: heightPx, justifyContent: "center", alignItems: "center" }}>
              <View style={{ height: 3, width: "85%", backgroundColor: COLORS.empty, borderRadius: 2 }} />
              <Text style={{ color: COLORS.textDim, marginTop: 8 }}>No entries yet</Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}
