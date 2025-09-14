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
  setDoc, // write to Firestore
} from "@react-native-firebase/firestore";
import { MoveLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Switch } from "react-native-gesture-handler";
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

export default function RolloverCalories() {
  const [weightUnit, setWeightUnit] = useState("kg");
  const [items, setItems] = useState([]); // raw docs
  const [loading, setLoading] = useState(true);

  // Switch state mirrors Firestore users/$uid.RolloverCalories ("yes" | "no")
  const [isEnabled, setIsEnabled] = useState(false);

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

    // Subscribe to user doc (weightUnit + RolloverCalories)
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() || {};

      if (data?.weightUnit === "kg" || data?.weightUnit === "lb") {
        setWeightUnit((prev) => (prev === data.weightUnit ? prev : data.weightUnit));
      }

      if (data?.RolloverCalories === "yes") setIsEnabled(true);
      else if (data?.RolloverCalories === "no") setIsEnabled(false);
    });

    // Subscribe to weight entries (unchanged; you can remove if not needed here)
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

  // Toggle and save to Firestore: users/$uid.RolloverCalories -> "yes"/"no"
  const toggleSwitch = async () => {
    const next = !isEnabled;
    setIsEnabled(next); // optimistic

    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      const db = getFirestore();
      const ref = doc(db, "users", uid);
      await setDoc(ref, { RolloverCalories: next ? "yes" : "no" }, { merge: true });
    } catch (e) {
      console.warn("Failed to update RolloverCalories:", e?.message);
      setIsEnabled(!next); // revert on failure
    }
  };

  return (
    <>
      <View style={{ width: "100%", height: "100%" }}>
        <Text
          style={{
            fontSize: size(25),
            fontWeight: "800",
            marginLeft: width(5),
            marginTop: height(5),
          }}
        >
         Rollover calories
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: height(5),
          }}
        >
          <Text
            style={{
              fontSize: size(16),
              marginLeft: width(5),
              lineHeight: height(2.5),
              width: "60%",
              color: "#000",
            }}
          >
            Add up to 200 left over calories from yesterday into today's daily goal
          </Text>

          <Switch
            style={{
              right: width(5),
              position: "absolute",
            }}
            trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
            thumbColor="#fff"
            ios_backgroundColor="#E6E6E8"
            onValueChange={toggleSwitch}
            value={isEnabled}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => {
          dismiss("RolloverCalories");
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