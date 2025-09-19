// WeightTimelineByDay.js
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "@react-native-firebase/firestore";
import { MoveLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => (typeof lb === "number" ? lb * KG_PER_LB : undefined);
const kgToLb = (kg) => (typeof kg === "number" ? kg / KG_PER_LB : undefined);

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHeader(d) {
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function WeightTimelineByDay() {
  const [weightUnit, setWeightUnit] = useState("kg");
  const [items, setItems] = useState([]); // raw rows
  const [loading, setLoading] = useState(true);

  const {
    dismiss,
  } = useSheets();

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;

    if (!uid) {
      // No user yet; render empty state instead of throwing
      setItems([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();

    // --- User doc -> weightUnit (SAFE) ---
    const userRef = doc(db, "users", uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        try {
          // snap may be null in some edge cases; guard it
          const data = snap?.data ? snap.data() : undefined;
          const wu = data?.weightUnit;
          if (wu === "kg" || wu === "lb") {
            setWeightUnit((prev) => (prev === wu ? prev : wu));
          }
        } catch (e) {
          console.warn("[user onSnapshot] error reading data():", e?.message || e);
        }
      },
      (err) => {
        console.warn("[user onSnapshot] error:", err?.message || err);
      }
    );

    // --- weights collection (newest first) (SAFE) ---
    const qRef = query(
      collection(db, "users", uid, "weightprogrss"), // keep your collection name
      orderBy("createdAt", "desc")
    );

    const unsubList = onSnapshot(
      qRef,
      (snap) => {
        try {
          const docs = Array.isArray(snap?.docs) ? snap.docs : [];
          const next = docs
            .filter(Boolean)
            .map((d) => {
              let data = {};
              try {
                data = d?.data ? d.data() || {} : {};
              } catch (e) {
                console.warn("[weights map] d.data() failed:", e?.message || e);
              }

              // createdAt can be a Firestore Timestamp or Date or missing
              let createdAt = null;
              const raw = data?.createdAt;
              if (raw) {
                if (typeof raw?.toDate === "function") {
                  createdAt = raw.toDate();
                } else if (raw instanceof Date) {
                  createdAt = raw;
                } else if (typeof raw === "number") {
                  // epoch ms fallback
                  createdAt = new Date(raw);
                }
              }

              return {
                id: d?.id ?? Math.random().toString(36).slice(2),
                kg: typeof data?.kg === "number" ? data.kg : undefined,
                lb: typeof data?.lb === "number" ? data.lb : undefined,
                unit: data?.unit,
                source: data?.source,
                createdAt,
              };
            });

          setItems(next);
          setLoading(false);
        } catch (e) {
          console.warn("[weights onSnapshot] handler failed:", e?.message || e);
          setLoading(false);
        }
      },
      (err) => {
        console.warn("[weights onSnapshot] error:", err?.message || err);
        setLoading(false);
      }
    );

    return () => {
      try { unsubUser && unsubUser(); } catch {}
      try { unsubList && unsubList(); } catch {}
    };
  }, []);

  // Group by day + convert to preferred unit
  const sections = useMemo(() => {
    const bucket = new Map();

    for (const it of items) {
      if (!it?.createdAt || !(it.createdAt instanceof Date) || isNaN(it.createdAt)) continue;

      let value;
      let unit;

      if (weightUnit === "kg") {
        value =
          typeof it.kg === "number"
            ? it.kg
            : typeof it.lb === "number"
            ? lbToKg(it.lb)
            : undefined;
        unit = "kg";
      } else {
        value =
          typeof it.lb === "number"
            ? it.lb
            : typeof it.kg === "number"
            ? kgToLb(it.kg)
            : undefined;
        unit = "lb";
      }

      const displayValue =
        typeof value === "number" && isFinite(value)
          ? Math.round(value * 10) / 10
          : undefined;

      let timeLabel = "";
      try {
        timeLabel = it.createdAt.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {}

      const ymd = formatYMD(it.createdAt);
      if (!bucket.has(ymd)) {
        bucket.set(ymd, { titleDate: it.createdAt, rows: [] });
      }
      bucket.get(ymd).rows.push({
        id: it.id,
        displayValue,
        displayUnit: unit,
        timeLabel,
      });
    }

    return Array.from(bucket.entries())
      .sort((a, b) => b[1].titleDate - a[1].titleDate)
      .map(([ymd, group]) => ({
        key: ymd,
        title: formatHeader(group.titleDate),
        rows: group.rows,
      }));
  }, [items, weightUnit]);

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (!sections.length) {
    return (
      <>
        <View style={{ padding: 16 }}>
          <Text>No weight entries yet.</Text>
        </View>

        <TouchableOpacity
          onPress={() => dismiss("Habits_Weight_History")}
          hitSlop={8}
          style={{
            top: height(78),
            zIndex: 100,
            paddingVertical: 14,
            flexDirection: "row",
            width: size(125),
            left: width(5),
            height: size(50),
            paddingHorizontal: 20,
            alignItems: "center",
            position: "absolute",
            borderRadius: 15,
            backgroundColor: "#000",
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOffset: { width: 2, height: 1 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
              },
              android: { elevation: 4, shadowColor: "#ccc" },
            }),
          }}
        >
          <MoveLeft size={18} color="#fff" />
          <Text
            style={{
              color: "#fff",
              marginLeft: width(5),
              fontSize: size(14),
              fontWeight: "700",
            }}
          >
            Done
          </Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={{ width: "100%", height: "100%" }}
        contentContainerStyle={{ paddingBottom: height(8) }}
      >
        <Text
          style={{
            fontSize: size(25),
            fontWeight: "800",
            marginLeft: width(5),
            marginTop: height(5),
          }}
        >
          Habits & Weight history
        </Text>

        {sections.map((section) => (
          <View key={section.key} style={{ marginTop: height(5) }}>
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 16,
                marginLeft: width(5),
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: size(16), color: "#111" }}>
                {section.title}
              </Text>
            </View>

            {/* Section body */}
            <View style={{ marginLeft: width(5), width: "90%" }}>
              {section.rows.map((item) => (
                <View
                  key={item.id}
                  style={{
                    paddingVertical: 12,
                    flexDirection: "row",
                  }}
                >
                  <View style={{ width: "100%", marginLeft: width(5) }}>
                    <Text style={{ fontWeight: "700", fontSize: size(18) }}>
                      {item.displayValue != null ? `${item.displayValue}` : "—"}{" "}
                      <Text style={{ fontWeight: "400" }}>{item.displayUnit}</Text>
                    </Text>
                    <Text style={{ color: "#6B7280", marginTop: 4 }}>
                      {item.timeLabel ?? ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          dismiss("Habits_Weight_History");
        }}
        hitSlop={8}
        style={{
          top: height(78),
          zIndex: 100,
          paddingVertical: 14,
          flexDirection: "row",
          width: size(125),
          left: width(5),
          height: size(50),
          paddingHorizontal: 20,
          alignItems: "center",
          position: "absolute",
          borderRadius: 15,
          backgroundColor: "#000",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 2, height: 1 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
            },
            android: { elevation: 4, shadowColor: "#ccc" },
          }),
        }}
      >
        <MoveLeft size={18} color="#fff" />
        <Text
          style={{
            color: "#fff",
            marginLeft: width(5),
            fontSize: size(14),
            fontWeight: "700",
          }}
        >
          Done
        </Text>
      </TouchableOpacity>
    </>
  );
}
