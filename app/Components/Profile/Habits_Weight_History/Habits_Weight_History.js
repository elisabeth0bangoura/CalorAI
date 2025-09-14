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

const ROW_MIN_HEIGHT = 10;
const RAIL_W = 0;
const LINE = "#E5E7EB";
const DOT = "#111";

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHeader(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WeightTimelineByDay() {
  const [weightUnit, setWeightUnit] = useState("kg");
  const [items, setItems] = useState([]); // raw docs
  const [loading, setLoading] = useState(true);


    const {
      register, present, dismiss, dismissAll,
      isS2Open, setIsS2Open,
      isS3Open, setIsS3Open,
      isS4Open, setIsS4Open,
      isS5Open, setIsS5Open,
      isS6Open, setIsS6Open,
      isS7Open, setIsS7Open,
      isS8Open, setIsS8Open,
      isS9Open, setIsS9Open,
     isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
     isTargetWeightOpen, setIsTargetWeightOpen,
    } = useSheets();
  
  
  

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();

    // user doc -> weightUnit
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() || {};
      if (data?.weightUnit === "kg" || data?.weightUnit === "lb") {
        setWeightUnit((prev) => (prev === data.weightUnit ? prev : data.weightUnit));
      }
    });

    // weights collection (newest first)
    const qRef = query(
      collection(db, "users", uid, "weightprogrss"),
      orderBy("createdAt", "desc")
    );

    const unsubList = onSnapshot(
      qRef,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() || {};
          const createdAt =
            data.createdAt && typeof data.createdAt.toDate === "function"
              ? data.createdAt.toDate()
              : null;
        return {
            id: d.id,
            kg: typeof data.kg === "number" ? data.kg : undefined,
            lb: typeof data.lb === "number" ? data.lb : undefined,
            unit: data.unit,
            source: data.source,
            createdAt,
          };
        });
        setItems(next);
        setLoading(false);
      },
      (err) => {
        console.warn("weightprogrss snapshot error:", err?.message);
        setLoading(false);
      }
    );

    return () => {
      unsubUser?.();
      unsubList?.();
    };
  }, []);

  // Group by day + convert to preferred unit
  const sections = useMemo(() => {
    const bucket = new Map();

    for (const it of items) {
      if (!it.createdAt) continue;

      let value, unit;
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
        typeof value === "number" ? Math.round(value * 10) / 10 : undefined;

      const timeLabel = it.createdAt.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });

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
      <View style={{ padding: 16 }}>
        <Text>No weight entries yet.</Text>
      </View>
    );
  }

  return (

    <>

    <ScrollView style={{ width: "100%", height: "100%" }}>

        <Text style={{
          fontSize: size(25),
          fontWeight: "800",
          marginLeft: width(5),
          marginTop: height(5)
        }}>
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

          {/* Section body with ONE vertical rail */}
          <View
            style={{

              marginLeft: width(5),
              width: "90%",
            }}
          >
          

            {section.rows.map((item, idx) => (
              <View
                key={item.id}
                style={{
                  height: "auto",
                  paddingVertical: 12,
                    
                  flexDirection: "row",
                }}
              >
           

                {/* Content */}
                <View style={{ height: "100%", width: "100%", marginLeft: width(5), }}>
                
                  <Text style={{ fontWeight: "700", fontSize: size(18) }}>
                    {item.displayValue != null
                      ? `${item.displayValue}` : "—"} <Text style={{fontWeight: "400",}}>{item.displayUnit}</Text>
                    
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
                dismiss("Habits_Weight_History")
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
              backgroundColor:  "#000",
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
             <MoveLeft size={18} color="#fff"  />

            <Text style={{ color: "#fff", marginLeft: width(5), fontSize: size(14), fontWeight: "700" }}>
              Done
            </Text>

          
             
          
          </TouchableOpacity>

</>

  );
}