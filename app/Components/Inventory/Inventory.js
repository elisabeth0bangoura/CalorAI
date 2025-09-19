// ./app/Inventory/Inventory.js
import { getAuth } from "@react-native-firebase/auth";
import firestore, {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "@react-native-firebase/firestore";
import { Image } from "expo-image";
import { Minus, Plus } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useSheets } from "../../Context/SheetsContext";
import {
  default as RecipesScreen,
  default as useOpenAIRecipes,
} from "./useOpenAIRecipes";

/* ----------------- helpers ----------------- */
const toNum = (n, d = 0) => {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v : d;
};
const hasVal = (v) => v !== undefined && v !== null;

/* ----------------- QUANTITY helpers ----------------- */
const getCounterKey = (it) =>
  hasVal(it.qty) ? "qty" : hasVal(it.units_per_pack) ? "units_per_pack" : "qty";

const changeQty = async (it, delta) => {
  try {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) return;
    const db = getFirestore();
    const ref = doc(db, "users", uid, "Inventory", it.id);

    const key = getCounterKey(it);
    const curr = toNum(it[key], 0);

    // delete case: already 0 and another decrement
    if (curr === 0 && delta < 0) {
      await firestore().doc(ref.path).delete();
      return;
    }

    const next = Math.max(0, curr + delta);
    if (next === curr) return;

    await updateDoc(ref, {
      [key]: firestore.FieldValue.increment(delta),
      updated_at: serverTimestamp(),
    });
  } catch (e) {
    console.warn("changeQty failed:", e?.message || e);
  }
};

/* ----------------- /QUANTITY helpers ----------------- */

export default function Inventory() {
  const { register, present, dismiss, dismissAll } = useSheets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exitingIds, setExitingIds] = useState([]);

  // local peak max for each item (prevents shrinking ring on increment)
  const ringMaxRef = useRef(new Map());

  const { ramenRecipes } = useOpenAIRecipes({
    items,
    enabled: !loading,
    pageSize: 6,
    model: "o4-mini",
  });

  // Firestore subscription
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) {
      console.warn("User not logged in");
      setLoading(false);
      return;
    }
    const db = getFirestore();
    const colRef = collection(db, "users", uid, "Inventory");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setItems(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching inventory:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // grouping helpers
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const startOfDay = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts?.toDate) return ts.toDate();
    if (typeof ts === "number") return new Date(ts);
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);
  };
  const labelFor = (date) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const sow = new Date(now);
    sow.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    sow.setHours(0, 0, 0, 0);
    const som = new Date(now.getFullYear(), now.getMonth(), 1);
    if (date >= todayStart) return "Today";
    if (date >= sow) return "This Week";
    if (date >= som) return "This Month";
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };
  const rows = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => toDate(b.created_at) - toDate(a.created_at)
    );
    const out = [];
    let lastHeader = null;
    for (const it of sorted) {
      const d = toDate(it.created_at);
      const label = labelFor(d);
      if (label !== lastHeader) {
        out.push({ type: "header", key: label });
        lastHeader = label;
      }
      out.push({ type: "item", item: it });
    }
    return out;
  }, [items]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: "#fff", height: "100%", width: "100%" }}>
      <ScrollView
        style={{
          height: "100%",
          paddingTop: height(16),
          width: "100%",
          backgroundColor: "#fff",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: size(25),
              marginLeft: width(5),
              fontWeight: "700",
            }}
          >
            Your Fridge
          </Text>

          <TouchableOpacity
            style={{
              position: "absolute",
              right: width(5),
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Plus size={20} />
            <Text
              style={{
                marginLeft: width(2),
                fontSize: size(15),
                fontWeight: "bold",
              }}
            >
              Add Item
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={rows.filter(
            (r) => r.type === "header" || !exitingIds.includes(r.item.id)
          )}
          keyExtractor={(r, i) =>
            r.type === "header" ? `h-${r.key}-${i}` : r.item.id
          }
          renderItem={({ item: row }) => {
            if (row.type === "header") {
              return (
                <View
                  style={{
                    paddingHorizontal: width(5),
                    marginBottom: height(3),
                    paddingTop: height(3),
                  }}
                >
                  <Text style={{ fontSize: size(16), fontWeight: "800" }}>
                    {row.key}
                  </Text>
                </View>
              );
            }

            const item = row.item;
            const counterKey = getCounterKey(item); // "qty" or "units_per_pack"
            const valueNow = toNum(item[counterKey] ?? 0, 0);

            // stable local max
            const prevMax = ringMaxRef.current.get(item.id) ?? 0;
            if (valueNow > prevMax) ringMaxRef.current.set(item.id, valueNow);
            const stableMax = Math.max(1, ringMaxRef.current.get(item.id) || valueNow);

            const onInc = () => {
              ringMaxRef.current.set(item.id, valueNow + 1);
              changeQty(item, +1);
            };
            const onDec = () => {
              changeQty(item, -1);
            };

            return (
              <Animated.View
                style={{
                  backgroundColor: "#fff",
                  paddingVertical: size(20),
                  marginBottom: size(20),
                  width: "95%",
                  paddingHorizontal: size(8),
                  alignSelf: "center",
                  borderRadius: 10,
                  ...Platform.select({
                    ios: {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.05,
                      shadowRadius: 10,
                    },
                    android: { elevation: 6, shadowColor: "#888" },
                  }),
                }}
              >
                <View style={{ flexDirection: "row" }}>
                  <View
                    style={{
                      height: size(60),
                      width: size(60),
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: "#ccc",
                    }}
                  >
                    <Image
                      source={{ uri: item.image_cloud_url }}
                      style={{ height: "100%", width: "100%" }}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                  </View>

                  <View style={{ marginLeft: width(5) }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontWeight: "800",
                        fontSize: size(16),
                        width: width(22),
                      }}
                    >
                      {item.title || item.title_detected || "Item"}
                    </Text>

                    <Text
                      style={{
                        fontWeight: "bold",
                        fontSize: size(13),
                        marginTop: height(1),
                        width: width(25),
                      }}
                    >
                      {item.serving_size || item.brand_detected || ""}
                    </Text>
                  </View>

                  {/* --- RIGHT SIDE: ring + buttons --- */}
                  <View
                    style={{
                      position: "absolute",
                      right: width(0),
                      top: 0,
                      bottom: 0,
                      width: 110,
                    }}
                  >
                    {/* Progress ring */}
                    <View
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        justifyContent: "center",
                        zIndex: 0,
                      }}
                      pointerEvents="none"
                    >
                      <CircularProgress
                        value={valueNow}
                        radius={24}
                        duration={600}
                        activeStrokeColor="#000"
                        inActiveStrokeColor="#D3DAE0"
                        inActiveStrokeWidth={5}
                        activeStrokeWidth={5}
                        progressValueColor={"#000"}
                        maxValue={10}
                        titleColor={"#000"}
                        titleStyle={{ fontWeight: "bold" }}
                      />
                    </View>

                    {/* Buttons */}
                    <View
                      style={{
                        position: "absolute",
                        right: 64,
                        top: 0,
                        bottom: 0,
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                        zIndex: 2,
                        pointerEvents: "auto",
                      }}
                    >
                      <TouchableOpacity
                        onPress={onInc}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                          height: size(25),
                          width: size(25),
                          borderRadius: size(25) / 2,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "#222",
                        }}
                      >
                        <Plus size={20} color="#fff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={onDec}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                          height: size(25),
                          width: size(25),
                          borderRadius: size(25) / 2,
                          borderWidth: 1,
                          borderColor: "#000",
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "#fff",
                        }}
                      >
                        <Minus size={20} color="#000" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          }}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 16 }}
        />

        <View
          style={{
            height: size(250),
            width: "95%",
            alignSelf: "center",
            marginTop: height(2),
          }}
        >
          <Text
            style={{
              fontSize: size(25),
              marginBottom: height(4),
              marginLeft: width(5),
              fontWeight: "700",
            }}
          >
            Cook With What You Have
          </Text>

          <RecipesScreen />
        </View>
      </ScrollView>
    </View>
  );
}

