// TotalCalories.js
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

/* ---------------- constants & helpers ---------------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const BRAND = { carbs: "#F7931A", sugar: "#0058FF", cal: "#691AF5" };

const num = (v, d = 0) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : d;
};

const toDate = (v) =>
  v?.toDate?.() ??
  (v instanceof Date
    ? v
    : typeof v === "number"
    ? new Date(v > 1e12 ? v : v * 1000)
    : typeof v === "string"
    ? new Date(v)
    : v?.seconds != null
    ? new Date(v.seconds * 1000)
    : null);

const daysFromRange = (range) => {
  const key = String(range || "").toUpperCase();
  if (key === "30D") return 30;
  if (key === "90D") return 90;
  if (key === "1Y") return 365;
  return null; // ALL
};

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

/* Prefer top-level totals; otherwise fall back to items[] */
const sumDoc = (row) => {
  let cal =
    num(row?.calories_kcal_total, NaN) ??
    num(row?.calories_kcal, NaN);
  let carbs = num(row?.carbs_g, NaN);
  let sugar = num(row?.sugar_g, NaN);

  // If top-level missing, try first item then full sum as fallback
  if (!Number.isFinite(cal) || !Number.isFinite(carbs) || !Number.isFinite(sugar)) {
    const it0 = Array.isArray(row?.items) ? row.items[0] : null;
    cal = Number.isFinite(cal) ? cal : num(it0?.calories_kcal, 0);
    carbs = Number.isFinite(carbs) ? carbs : num(it0?.carbs_g, 0);
    sugar = Number.isFinite(sugar) ? sugar : num(it0?.sugar_g, 0);
  }

  // If there’s NO top-level calories but items[] exists, sum all items
  if (!row?.calories_kcal_total && Array.isArray(row?.items)) {
    let addCal = 0,
      addCarbs = 0,
      addSugar = 0;
    for (const it of row.items) {
      addCal += num(it?.calories_kcal);
      addCarbs += num(it?.carbs_g);
      addSugar += num(it?.sugar_g);
    }
    cal += addCal;
    carbs += addCarbs;
    sugar += addSugar;
  }

  return { cal, carbs, sugar };
};

/* Normalize for pill widths */
const normalizeForBars = ({ cal, carbs, sugar }) => {
  // keep calories visually comparable (convert to a similar scale)
  const calN = cal / 12;
  const maxN = Math.max(1, calN, carbs, sugar);
  return {
    cal: Math.max(0, calN / maxN),
    carbs: Math.max(0, carbs / maxN),
    sugar: Math.max(0, sugar / maxN),
  };
};

const pillWidth = (ratio) => {
  const r = Math.max(0, Math.min(1, ratio));
  return `${6 + (28 - 6) * r}%`; // min 6%, max 28%
};

/* ---------------- component ---------------- */
/**
 * Pulls live data from: /users/$uid/RecentlyEaten
 * Props:
 *  - range: "30D" | "90D" | "1Y" | "ALL"
 */
export default function TotalCalories({ range = "ALL" }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Live Firestore stream
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();
    const colRef = collection(db, "users", uid, "RecentlyEaten");

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setDocs(rows);
        setLoading(false);
        setErr(null);
      },
      (e) => {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    );
    return () => unsub?.();
  }, []);

  // Aggregate for the selected range
  const { totals, hasData } = useMemo(() => {
    const days = daysFromRange(range);
    const cutoff = days != null ? Date.now() - days * MS_DAY : null;

    let acc = { cal: 0, carbs: 0, sugar: 0 };
    let matched = 0;

    for (const row of docs) {
      const ts =
        toDate(row?.created_at) ||
        toDate(row?.createdAt) ||
        toDate(row?.scanned_at) ||
        toDate(row?.scannedAt);

      if (cutoff != null) {
        if (!ts) continue;
        if (ts.getTime() < cutoff) continue;
      }

      const s = sumDoc(row);
      acc.cal += s.cal;
      acc.carbs += s.carbs;
      acc.sugar += s.sugar;
      matched++;
    }
    return { totals: acc, hasData: matched > 0 };
  }, [docs, range]);

  const bars = useMemo(
    () => normalizeForBars(hasData ? totals : { cal: 0, carbs: 0, sugar: 0 }),
    [totals, hasData]
  );

  return (
    <View>
      <Text
        style={{
          fontSize: size(18),
          fontWeight: "800",
          marginLeft: width(5),
          marginBottom: height(1),
        }}
      >
        Total Calories
      </Text>

      <Text
        style={{
          fontSize: size(30),
          marginBottom: height(2),
          fontWeight: "800",
          marginLeft: width(5),
        }}
      >
        {fmtInt(hasData ? totals.cal : 0)} cal
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
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.01,
              shadowRadius: 2,
            },
            android: { elevation: 6, shadowColor: "#000" },
          }),
        }}
      >
        {/* Pills */}
        <View
          style={{
            width: "90%",
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              height: height(4),
              width: pillWidth(bars.carbs),
              borderRadius: 10,
              backgroundColor: BRAND.carbs,
              marginRight: width(2),
            }}
          />
          <View
            style={{
              height: height(4),
              width: pillWidth(bars.sugar),
              borderRadius: 10,
              backgroundColor: BRAND.sugar,
              marginRight: width(2),
            }}
          />
          <View
            style={{
              height: height(4),
              width: pillWidth(bars.cal),
              borderRadius: 10,
              backgroundColor: BRAND.cal,
            }}
          />
        </View>

        {/* Legend */}
        <View
          style={{
            width: "80%",
            alignSelf: "center",
            marginTop: height(4),
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {[
            { key: "carbs", label: "Carbs", color: BRAND.carbs, val: totals.carbs },
            { key: "sugar", label: "Sugar", color: BRAND.sugar, val: totals.sugar },
            { key: "cal", label: "Calories", color: BRAND.cal, val: totals.cal },
          ].map((l) => (
            <View key={l.key} style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: l.color,
                  marginRight: 8,
                }}
              />
              <Text style={{ fontSize: size(13), color: "#000" }}>
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* State messages (optional) */}
      {loading && (
        <Text style={{ color: "#A6B0B8", marginTop: 8, marginLeft: width(5) }}>
          Loading…
        </Text>
      )}
      {!loading && !hasData && (
        <Text style={{ color: "#A6B0B8", marginTop: 8, marginLeft: width(5) }}>
          No entries in this range.
        </Text>
      )}
      {!!err && (
        <Text style={{ color: "#c00", marginTop: 8, marginLeft: width(5) }}>
          {err}
        </Text>
      )}
    </View>
  );
}
