// AutoAdjustMacros.js
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import {
    collection,
    doc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    setDoc,
} from "@react-native-firebase/firestore";
import {
    Candy,
    Cigarette,
    Coffee,
    CupSoda,
    Droplet,
    Egg,
    Flame,
    GlassWater,
    Leaf,
    MoveLeft,
    Wheat,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import { Switch } from "react-native-gesture-handler";
import { height, size, width } from "react-native-responsive-sizes";

/* ---------- Colors & helpers ---------- */
const COLORS_FALLBACK = {
  cal: "#FFCF2D",
  protein: "#632EFF",
  carbs: "#F7931A",
  fat: "#FCDB2A",
  fiber: "#A87DD8",
  sugar: "#FF89A0",
  sodium: "#D7A44A",
  coffee: "#C15217",
  cigarette: "#F7931A",
  water: "#0057FF",
};

const ringProps = {
  radius: 24,
  activeStrokeWidth: 6,
  inActiveStrokeWidth: 6,
  inActiveStrokeOpacity: 0.15,
  strokeLinecap: "round",
  rotation: -90,
};

const labelFor = (k) =>
  ({
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    fiber: "Fiber",
    sugar: "Sugar",
    sodium: "Sodium",
    coffee: "Coffee",
    cigarette: "Cigarettes",
  }[k] || k);

const iconFor = (k) => {
  switch (k) {
    case "calories":
      return Flame;
    case "protein":
      return Egg;
    case "carbs":
      return Wheat;
    case "fat":
      return Droplet;
    case "fiber":
      return Leaf;
    case "sugar":
      return Candy;
    case "sodium":
      return CupSoda;
    case "coffee":
      return Coffee;
    case "cigarette":
      return Cigarette;
    default:
      return GlassWater;
  }
};

// Firestore -> local color key mapping (only for colors, NOT for enabled)
const COLOR_KEY_MAP = {
  calories: "cal",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fiber",
  sugar: "sugar",
  sodium: "sodium",
  coffee: "coffee",
  cigarette: "cigarette",
};

export default function AutoAdjustMacros() {
  const [loading, setLoading] = useState(true);

  // users/$uid.AutoAdjustMacros ("yes" | "no")
  const [isEnabled, setIsEnabled] = useState(false);

  // AllNeeds/current
  const [enabledMap, setEnabledMap] = useState({});
  const [colorsMap, setColorsMap] = useState(COLORS_FALLBACK);

  const { dismiss } = useSheets();

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const db = getFirestore();

    // User doc (master switch)
    const unsubUser = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap?.exists ? snap.data() : {};
        if (data?.AutoAdjustMacros === "yes") setIsEnabled(true);
        else if (data?.AutoAdjustMacros === "no") setIsEnabled(false);
      },
      (err) => console.warn("[user onSnapshot]", err?.message || err)
    );

    // AllNeeds/current
    const needsRef = doc(db, "users", uid, "AllNeeds", "current");
    const unsubNeeds = onSnapshot(
      needsRef,
      async (snap) => {
        if (!snap?.exists) {
          // create skeleton so writes never 404
          await setDoc(needsRef, { enabled: {}, colors: {} }, { merge: true });
          setEnabledMap({});
          setColorsMap({ ...COLORS_FALLBACK });
          setLoading(false);
          return;
        }
        const d = snap.data() || {};
        const enabled = d.enabled || {};
        const colors = d.colors || {};

        // merge colors into local keys with fallbacks
        const merged = { ...COLORS_FALLBACK };
        Object.keys(COLOR_KEY_MAP).forEach((k) => {
          const localKey = COLOR_KEY_MAP[k];
          if (typeof colors[k] === "string") merged[localKey] = colors[k];
        });
        if (typeof colors?.water === "string") merged.water = colors.water;

        setColorsMap((prev) =>
          JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged
        );
        setEnabledMap(enabled);
        setLoading(false);
      },
      (err) => {
        console.warn("[AllNeeds/current onSnapshot error]", err?.message || err);
        setLoading(false);
      }
    );

    // optional: keep, if you still use weight list elsewhere
    const qRef = query(
      collection(db, "users", uid, "weightprogrss"),
      orderBy("createdAt", "desc")
    );
    const unsubList = onSnapshot(
      qRef,
      () => {},
      (err) => console.warn("[weightprogrss snapshot] error:", err?.message || err)
    );

    return () => {
      try { unsubUser && unsubUser(); } catch {}
      try { unsubNeeds && unsubNeeds(); } catch {}
      try { unsubList && unsubList(); } catch {}
    };
  }, []);

  // MASTER switch
  const toggleMasterSwitch = async () => {
    const next = !isEnabled;
    setIsEnabled(next);
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      await setDoc(doc(getFirestore(), "users", uid), { AutoAdjustMacros: next ? "yes" : "no" }, { merge: true });
    } catch (e) {
      console.warn("Failed to update AutoAdjustMacros:", e?.message || e);
      setIsEnabled(!next);
    }
  };

  // Enable a single key by writing the WHOLE enabled map back (bulletproof)
  const enableKey = async (key) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();
    const ref = doc(db, "users", uid, "AllNeeds", "current");

    // build next map
    const nextEnabled = { ...(enabledMap || {}), [key]: true };

    // optimistic
    setEnabledMap(nextEnabled);

    try {
      // write entire sub-map so rules that reject dot-path still accept this
      await setDoc(ref, { enabled: nextEnabled }, { merge: true });
    } catch (e) {
      console.warn(`[enableKey:${key}]`, e?.message || e);
      // revert (snapshot will also correct)
      setEnabledMap((prev) => ({ ...(prev || {}), [key]: false }));
    }
  };

  // Disabled keys in desired order
  const disabledKeys = useMemo(() => {
    const order = [
      "calories",
      "protein",
      "carbs",
      "fat",
      "fiber",
      "sugar",
      "sodium",
      "coffee",
      "cigarette",
    ];
    return order.filter((k) => enabledMap?.[k] === false);
  }, [enabledMap]);

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading…</Text>
      </View>
    );
  }

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
          Auto adjust macros
        </Text>

        {/* Master switch */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: height(5) }}>
          <Text
            style={{
              fontSize: size(16),
              marginLeft: width(5),
              lineHeight: height(2.5),
              width: "60%",
              color: "#000",
            }}
          >
            Automatically rebalance your protein, carbs and fat targets when your calorie goal changes.
          </Text>

          <Switch
            style={{ right: width(5), position: "absolute" }}
            trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
            thumbColor="#fff"
            ios_backgroundColor="#E6E6E8"
            onValueChange={toggleMasterSwitch}
            value={isEnabled}
          />
        </View>

        {/* Disabled list */}
        {disabledKeys.length > 0 && (
          <View style={{ marginTop: height(4), width: "90%", alignSelf: "center" }}>
            <Text style={{ fontSize: size(16), fontWeight: "800", marginBottom: height(1) }}>
              Hidden cards
            </Text>

            {disabledKeys.map((k) => {
              const Icon = iconFor(k);
              const colorKey = COLOR_KEY_MAP[k] || k;
              const ringColor =
                colorsMap?.[colorKey] || COLORS_FALLBACK[colorKey] || "#111";

              return (
                <TouchableOpacity
                  key={`disabled-${k}`}
                  activeOpacity={0.85}
                  onPress={() => enableKey(k)}
                  style={{
                    height: height(10),
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    marginTop: height(1),
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.05,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <View style={{ marginRight: 14 }}>
                    <CircularProgressBase
                      {...ringProps}
                      value={0}
                      maxValue={100}
                      activeStrokeColor={ringColor}
                      inActiveStrokeColor={ringColor}
                    >
                      <Icon size={18} color="#000" />
                    </CircularProgressBase>
                  </View>

                  <Text style={{ fontWeight: "800", fontSize: size(14) }}>
                    {labelFor(k)}{" "}
                    <Text style={{ fontWeight: "500", color: "#6B7280" }}>
                      (tap to enable)
                    </Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Done */}
      <TouchableOpacity
        onPress={() => dismiss("AutoAdjustMacros")}
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
        <Text style={{ color: "#fff", marginLeft: width(5), fontSize: size(14), fontWeight: "700" }}>
          Done
        </Text>
      </TouchableOpacity>
    </>
  );
}
