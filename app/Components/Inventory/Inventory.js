import { getAuth } from "@react-native-firebase/auth";
import {
    collection,
    deleteDoc,
    doc,
    getFirestore,
    onSnapshot
} from "@react-native-firebase/firestore";
import { Image } from "expo-image";
import { ClockFading, Minus, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useSheets } from "../../Context/SheetsContext";
import useOpenAIRecipes from "./useOpenAIRecipes";











export default function Inventory() {
  const { register, present, dismiss, dismissAll } = useSheets()
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);


  
const { ramenRecipes, recipesLoading, recipesError, recipesEnd, loadMoreRecipes } =
  useOpenAIRecipes({
    items,                 // your Firestore items array
    enabled: !loading,     // start after Firestore finished loading
    pageSize: 6,           // recipes per "page"
    model: "o4-mini",      // or "gpt-4o-mini" if you want temperature tuning
    // apiKey: "<YOUR_OPENAI_API_KEY>", // or set EXPO_PUBLIC_OPENAI_API_KEY
  });

  // ✅ track items that should slide out (UI-only)
  const [exitingIds, setExitingIds] = useState([]);
  

const startOfDay = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(0,0,0,0);
  return x;
};

  const OPENAI_API_KEY =
    "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";


   // -------- Date grouping helpers --------
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts?.toDate) return ts.toDate();                // Firestore Timestamp
    if (typeof ts === "number") return new Date(ts);   // ms epoch
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);                                // ISO string or Date
  };

  const startOfISOWeek = (d) => {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
    dt.setDate(dt.getDate() - day);
    dt.setHours(0,0,0,0);
    return dt;
  };

  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const labelFor = (date) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const sow = startOfISOWeek(now);
  const som = startOfMonth(now);

  if (date >= todayStart) return "Today";        // 👈 new
  if (date >= sow)        return "This Week";
  if (date >= som)        return "This Month";
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};


  // Build a flat list with headers + items, newest first
  const rows = useMemo(() => {
    // sort by created_at desc
    const sorted = [...items].sort((a, b) => {
      const da = toDate(a.created_at);
      const db = toDate(b.created_at);
      return db.getTime() - da.getTime();
    });

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
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
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



  










  // ---- Animation store (no hooks inside renderItem)
  const animX = useRef(new Map()).current;   // id -> Animated.Value
  const animOp = useRef(new Map()).current;  // id -> Animated.Value
  const getVal = (map, id, init) => {
    if (!map.has(id)) map.set(id, new Animated.Value(init));
    return map.get(id);
  };

  // Optional: reset all hidden rows (for your "Reset hidden" button)
  const resetHidden = () => {
    setExitingIds([]);
    animX.clear();
    animOp.clear();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }


  












  



  

  return (
    <View style={{ backgroundColor: "#fff", height: "100%", width: "100%" }}>
      <ScrollView style={{ height: "100%", paddingTop: height(16), width: "100%", backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: size(25), marginLeft: width(5), fontWeight: "700" }}>Your Fridge</Text>

          <TouchableOpacity style={{ position: 'absolute', right: width(5), flexDirection: 'row', alignItems: 'center' }}>
            <Plus size={20} />
            <Text style={{ marginLeft: width(2), fontSize: size(15), fontWeight: "bold" }}>Add Item</Text>
          </TouchableOpacity>
        </View>






        <FlatList
          ListEmptyComponent={
            <View style={{ marginTop: height(5), width: "90%", height: height(20), alignSelf: 'center' }}>
              <Text style={{ color: "#222", fontSize: size(14), textAlign: 'center', lineHeight: height(2.5) }}>
                Add fridge items to your inventory and get alerts before they expire or when you're running low.
              </Text>
            </View>
          }

          // keep headers even when filtering exiting items
          data={rows.filter(r => r.type === "header" || !exitingIds.includes(r.item.id))}
          keyExtractor={(r, i) => r.type === "header" ? `h-${r.key}-${i}` : r.item.id}

          renderItem={({ item: row }) => {
            if (row.type === "header") {
              return (
                <View style={{ paddingHorizontal: width(5), marginBottom: height(3),  paddingTop: height(3) }}>
                  <Text style={{ fontSize: size(16), fontWeight: "800" }}>{row.key}</Text>
                </View>
              );
            }

            const item = row.item;
            const x = getVal(animX, item.id, 0);
            const op = getVal(animOp, item.id, 1);

            const slideOut = () => {
              Animated.parallel([
                Animated.timing(x,  { toValue: -width(100), duration: 250, useNativeDriver: true }),
                Animated.timing(op, { toValue: 0,           duration: 200, useNativeDriver: true }),
              ]).start(() => {
                setExitingIds(prev => (prev.includes(item.id) ? prev : [...prev, item.id]));
                animX.delete(item.id);
                animOp.delete(item.id);
                (async () => {
                  try {
                    const uid = getAuth()?.currentUser?.uid;
                    if (!uid) return;
                    const db = getFirestore();
                    await deleteDoc(doc(db, "users", uid, "Inventory", item.id));
                  } catch (e) {
                    console.error("Failed to delete from Firestore:", e);
                  }
                })();
              });
            };

            return (
              <Animated.View
                style={{
                  transform: [{ translateX: x }],
                  opacity: op,
                  backgroundColor: '#fff',
                  paddingVertical: size(20),
                  marginBottom: size(20),
                  width: "95%",
                  paddingHorizontal: size(8),
                  alignSelf: 'center',
                  borderRadius: 10,
                  ...Platform.select({
                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.05, shadowRadius: 10 },
                    android: { elevation: 6, shadowColor: '#888' },
                  }),
                }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ height: size(60), width: size(60), borderRadius: 10, overflow: 'hidden', backgroundColor: '#ccc' }}>
                    <Image
                      source={{ uri: item.image_cloud_url }}
                      style={{ height: "100%", width: "100%" }}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                  </View>

                  <View style={{ marginLeft: width(5) }}>
                    <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: size(16), width: width(22) }}>
                      {item.title}
                    </Text>

                    <Text style={{ fontWeight: "bold", fontSize: size(13), marginTop: height(1), width: width(25) }}>
                      {item.serving_size}
                    </Text>
                  </View>

                  {/* freshness bar */}
                  <View style={{ position: 'absolute', marginLeft: width(48) }}>
                    {item.expirationDate ? (() => {
                      const today = new Date();
                      const exp = new Date(item.expirationDate);
                      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      let bgColor = "#00CE39";
                      if (diffDays <= 3) bgColor = "#FE1B20";
                      else if (diffDays <= 7) bgColor = "#FF8C03";
                      return <View style={{ backgroundColor: bgColor, height: height(0.8), width: width(8), borderRadius: 50, alignSelf: "flex-start", marginTop: 6 }} />;
                    })() : (
                      <View style={{ backgroundColor: "#0057FF", height: height(0.8), width: width(8), borderRadius: 50, alignSelf: "flex-start", marginTop: 6 }} />
                    )}
                  </View>

                  <View style={{
                    marginLeft: width(52),
                    position: 'absolute',
                    justifyContent: "space-between",
                    alignItems: 'center',
                    height: size(50),
                    width: 100,
                    gap: 4,
                  }}>
                    <TouchableOpacity style={{
                      height: size(25),
                      borderRadius: size(25) / 2,
                      width: size(25),
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#222',
                    }}>
                      <Plus size={20} color={"#fff"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={slideOut}
                      style={{
                        height: size(25),
                        borderRadius: size(25) / 2,
                        width: size(25),
                        borderWidth: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderColor: "#000000",
                        backgroundColor: '#fff',
                      }}
                    >
                      <Minus size={20} color={"#000"} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ right: width(0), position: 'absolute' }}>
                    <CircularProgress
                      value={1}
                      radius={24}
                      duration={2000}
                      activeStrokeColor="#000"
                      inActiveStrokeColor="#D3DAE0"
                      inActiveStrokeWidth={5}
                      activeStrokeWidth={5}
                      progressValueColor={'#000'}
                      maxValue={1}
                      titleColor={'#000'}
                      titleStyle={{ fontWeight: 'bold' }}
                    />
                  </View>
                </View>
              </Animated.View>
            );
          }}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 16 }}
        />













        <View style={{ height: size(250), width: "95%", alignSelf: 'center', marginTop: height(2) }}>
          <Text style={{ fontSize: size(25), marginBottom: height(4), marginLeft: width(5), fontWeight: "700" }}>
            Cook With What You Have
          </Text>

        <FlatList showsHorizontalScrollIndicator={false}
            horizontal
            data={ramenRecipes}
            keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
              <View style={{
                backgroundColor: "#fff",
                width: size(150),
                marginRight: width(3),
                height: size(150),
                marginBottom: 12,
                borderRadius: 15,
                ...Platform.select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                  },
                  android: {
                    elevation: 6,
                    shadowColor: '#888',
                  }
                })
              }}>
                <Text numberOfLines={2} style={{
                  width: "75%",
                  marginLeft: width(5),
                  marginTop: height(2),
                  fontSize: size(16),
                  fontWeight: "800",
                }}>
                  {item.title}
                </Text>

                <Text style={{
                  position: 'absolute',
                  marginLeft: width(5),
                  bottom: height(6.5),
                  fontSize: size(15),
                  color: item.difficulty.color, fontWeight: "700",
                }}>
                  {item.difficulty.level}
                </Text>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: "95%",
                  position: 'absolute',
                  marginLeft: width(5),
                  bottom: height(3),
                }}>
                  <ClockFading size={16} />
                  <Text style={{ marginLeft: width(2), fontSize: size(13) }}>
                    {item.cookTime}
                  </Text>
                </View>
              </View>
            )}
  onEndReached={loadMoreRecipes}
  onEndReachedThreshold={0.6}
  ListFooterComponent={
    recipesLoading ? <ActivityIndicator style={{ marginRight: 12 }} /> : null
  }
/>
        </View>
      </ScrollView>
    </View>
  )
}
