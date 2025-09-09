// TotalCalories.js
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

import { getAuth } from "@react-native-firebase/auth";
import { collection, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

/* ---------------- helpers ---------------- */
const MS_DAY = 24 * 60 * 60 * 1000;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toDate = (v) =>
  v?.toDate?.() ??
  (v instanceof Date
    ? v
    : typeof v === "number"
    ? new Date(v)
    : typeof v === "string"
    ? new Date(v)
    : v?.seconds
    ? new Date(v.seconds * 1000)
    : null);

// sum a single doc (top-level + items[])
const sumDoc = (row) => {
  let cal = 0, carbs = 0, sugar = 0;
  cal   += n(row?.calories_kcal_total ?? row?.calories_kcal);
  carbs += n(row?.carbs_g);
  sugar += n(row?.sugar_g);

  if (Array.isArray(row?.items)) {
    for (const it of row.items) {
      cal   += n(it?.calories_kcal);
      carbs += n(it?.carbs_g);
      sugar += n(it?.sugar_g);
    }
  }
  return { cal, carbs, sugar };
};

// 0..1 for bar widths; keep calories visually comparable
const normalizeForBars = ({ cal, carbs, sugar }) => {
  const calN = cal / 12;
  const maxN = Math.max(1, calN, carbs, sugar);
  return { cal: calN / maxN, carbs: carbs / maxN, sugar: sugar / maxN };
};

const toPillWidth = (r) => `${6 + (28 - 6) * Math.max(0, Math.min(1, r))}%`;

// Map incoming range prop to # of days (or null for ALL)
const daysFromRange = (range) => {
  const key = String(range || "").toUpperCase();
  if (key === "30D") return 30;
  if (key === "90D") return 90;
  if (key === "1Y")  return 365;
  return null; // ALL
};

// Brand colors (always used for legend)
const BRAND = { carbs: "#F7931A", sugar: "#0058FF", cal: "#691AF5" };

/* ---------------- component ---------------- */
/**
 * @param {string}  range - "30D" | "90D" | "1Y" | "ALL"
 * @param {boolean} showEmptyPlaceholders - show legacy grey pills when empty (default false)
 */
export default function TotalCalories({ range = "ALL", showEmptyPlaceholders = false }) {
  const [docs, setDocs] = useState([]);        // raw docs from Firestore
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // Single listener — doesn’t change when range changes
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();
    const colRef = collection(db, "users", uid, "AllTimeLineScan");

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setDocs(rows);
        setErr(null);
        setLoading(false);
      },
      (e) => {
        setErr(String(e?.message || e));
        setLoading(false);
      }
    );

    return () => unsub?.();
  }, []);

  // Compute filtered totals for the selected range
  const { totals, hasData } = useMemo(() => {
    const days = daysFromRange(range);
    const cutoffTs = days != null ? Date.now() - days * MS_DAY : null;

    let acc = { cal: 0, carbs: 0, sugar: 0 };
    let matched = 0;

    for (const row of docs) {
      const ts =
        toDate(row?.created_at) ||
        toDate(row?.createdAt) ||
        toDate(row?.scannedAt) ||
        toDate(row?.scanned_at);

      if (cutoffTs != null) {
        if (!ts) continue;                 // require timestamp when range active
        if (ts.getTime() < cutoffTs) continue;
      }

      const sums = sumDoc(row);
      acc.cal   += sums.cal;
      acc.carbs += sums.carbs;
      acc.sugar += sums.sugar;
      matched += 1;
    }

    return { totals: acc, hasData: matched > 0 };
  }, [docs, range]);

  const norm = useMemo(
    () => normalizeForBars(hasData ? totals : { cal: 0, carbs: 0, sugar: 0 }),
    [totals, hasData]
  );

  return (
    <View>
      <Text style={{ fontSize: size(18), fontWeight: "800", marginLeft: width(5), marginBottom: height(1) }}>
        Total Calories
      </Text>

      {/* Show 0 cal when no data */}
      <Text style={{ fontSize: size(30), marginBottom: height(2), fontWeight: "800", marginLeft: width(5) }}>
        {Math.round(hasData ? totals.cal : 0)} cal
      </Text>

      <View
        style={{
          width: "100%",
          paddingVertical: 40,
          alignSelf: "center",
          borderRadius: 15,
          flexDirection: "column",
          marginTop: height(2.5),
          justifyContent: "center",
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#f1f1f1",
          ...Platform.select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.01, shadowRadius: 2 },
            android: { elevation: 6, shadowColor: "#000" },
          }),
        }}
      >
        {/* ===== CONTENT ===== */}
        {hasData ? (
          <>
            {/* Pills */}
            <View style={{ width: "90%", alignSelf: "center", flexDirection: "row", alignItems: "center" }}>
              <View style={{ height: height(4), width: toPillWidth(norm.carbs), borderRadius: 10, backgroundColor: BRAND.carbs, marginRight: width(2) }} />
              <View style={{ height: height(4), width: toPillWidth(norm.sugar), borderRadius: 10, backgroundColor: BRAND.sugar, marginRight: width(2) }} />
              <View style={{ height: height(4), width: toPillWidth(norm.cal),   borderRadius: 10, backgroundColor: BRAND.cal }} />
            </View>

            {/* Legend (colored) */}
            <View style={{ width: "80%", alignSelf: "center", marginTop: height(4), flexDirection: "row", justifyContent: "space-between" }}>
              {[
                { key: "carbs", label: "Carbs", color: BRAND.carbs },
                { key: "sugar", label: "Sugar", color: BRAND.sugar },
                { key: "cal",   label: "Calories", color: BRAND.cal },
              ].map((l) => (
                <View key={l.key} style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color, marginRight: 8 }} />
                  <Text style={{ fontSize: size(13), color: "#000" }}>{l.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* NEW default: no pills, but keep **colored** legend */}
            {!showEmptyPlaceholders ? (
              <>
                <View style={{ width: "80%", alignSelf: "center", marginTop: height(1), flexDirection: "row", justifyContent: "space-between" }}>
                  {[
                    { key: "carbs", label: "Carbs", color: BRAND.carbs },
                    { key: "sugar", label: "Sugar", color: BRAND.sugar },
                    { key: "cal",   label: "Calories", color: BRAND.cal },
                  ].map((l) => (
                    <View key={l.key} style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color, marginRight: 8 }} />
                      <Text style={{ fontSize: size(13), color: "#000" }}>{l.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              /* LEGACY empty state (grey pills + grey legend) — preserved */
              <>
                <View style={{ width: "90%", alignSelf: "center", flexDirection: "row", alignItems: "center" }}>
                  <View style={{ height: height(4), width: toPillWidth(0.33), borderRadius: 10, backgroundColor: "#D3DAE0", marginRight: width(2) }} />
                  <View style={{ height: height(4), width: toPillWidth(0.33), borderRadius: 10, backgroundColor: "#D3DAE0", marginRight: width(2) }} />
                  <View style={{ height: height(4), width: toPillWidth(0.33), borderRadius: 10, backgroundColor: "#D3DAE0" }} />
                </View>
                <View style={{ width: "80%", alignSelf: "center", marginTop: height(4), flexDirection: "row", justifyContent: "space-between" }}>
                  {[
                    { key: "carbs", label: "Carbs" },
                    { key: "sugar", label: "Sugar" },
                    { key: "cal",   label: "Calories" },
                  ].map((l) => (
                    <View key={l.key} style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#D3DAE0", marginRight: 8 }} />
                      <Text style={{ fontSize: size(13), color: "#000" }}>{l.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>

      {/* State messages */}
      {loading && <Text style={{ color: "#A6B0B8", marginTop: 8, marginLeft: width(5) }}>Loading…</Text>}
      {!loading && !hasData && (
        <Text style={{ color: "#A6B0B8", marginTop: 8, marginLeft: width(5) }}>
          No entries in this range.
        </Text>
      )}
      {!!err && <Text style={{ color: "#c00", marginTop: 8, marginLeft: width(5) }}>{err}</Text>}
    </View>
  );
}
