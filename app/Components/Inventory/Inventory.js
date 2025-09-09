// ./app/Inventory/Inventory.js
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot, // 👈 added
  serverTimestamp,
  updateDoc, // 👈 added
} from "@react-native-firebase/firestore";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { ClockFading, Minus, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useSheets } from "../../Context/SheetsContext";
import useOpenAIRecipes from "./useOpenAIRecipes";

/* ----------------- tiny helpers (same style as Scan_Food_Camera) ----------------- */
const toNum = (n, d = 0) => {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v : d;
};
const toStr = (s, d = "") => (typeof s === "string" && s.trim().length ? s.trim() : d);
const norm = (s = "") => String(s).trim().toLowerCase();

const LUCIDE_SAFE = new Set([
  "Utensils","Apple","Banana","Bread","Cheese","Cookie","Candy","Coffee","Egg",
  "Fish","Milk","Pizza","Sandwich","Salad","Carrot","Drumstick","CupSoda","Avocado","IceCream",
]);
const safeIconName = (s) => (LUCIDE_SAFE.has(String(s).trim()) ? String(s).trim() : "Utensils");

const pickIngredientIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("apple")) return "Apple";
  if (n.includes("banana")) return "Banana";
  if (n.includes("cracker") || n.includes("bread") || n.includes("noodle") || n.includes("ramen") || n.includes("pasta")) return "Bread";
  if (n.includes("sugar")) return "Candy";
  if (n.includes("salt") || n.includes("sodium")) return "CupSoda";
  if (n.includes("garlic") || n.includes("onion") || n.includes("veg")) return "Carrot";
  if (n.includes("oil") || n.includes("fat")) return "Cheese";
  return "Utensils";
};

const categoryOf = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("salt") || n.includes("sodium")) return "salt";
  if (n.includes("cracker") || n.includes("noodle") || n.includes("wheat") || n.includes("ramen") || n.includes("pasta") || n.includes("bread")) return "noodle";
  if (n.includes("season") || n.includes("powder") || n.includes("sauce") || n.includes("flavor")) return "seasoning";
  if (n.includes("veg") || n.includes("cabbage") || n.includes("kimchi") || n.includes("onion") || n.includes("garlic") || n.includes("scallion")) return "veg";
  return "other";
};

const reconcileIngredientsToTotal = (rows, targetKcal) => {
  const baseRows = rows.map((r) => {
    const cat = categoryOf(r.name);
    const base =
      cat === "salt"
        ? 0
        : Number.isFinite(r?.estimated_kcal)
        ? Number(r.estimated_kcal)
        : (Number.isFinite(r?.estimated_grams) && Number.isFinite(r?.kcal_per_100g))
        ? (Number(r.estimated_grams) * Number(r.kcal_per_100g)) / 100
        : 0;
    return { ...r, _cat: cat, _base: Math.max(0, base) };
  });

  const target = Number(targetKcal);
  if (!Number.isFinite(target) || target <= 0) {
    return baseRows.map((r) => ({ ...r, estimated_kcal: Math.max(0, Math.round(r._base)) }));
  }

  let baseSum = baseRows.reduce((s, r) => s + r._base, 0);
  if (baseSum <= 0.0001) {
    let shares = baseRows.map((r) => (r._cat === "noodle" ? 0.8 : r._cat === "seasoning" ? 0.15 : r._cat === "veg" ? 0.05 : 0));
    if (shares.every((v) => v === 0)) shares = baseRows.map(() => 1 / baseRows.length);
    const totalShare = shares.reduce((a, b) => a + b, 0) || 1;
    const raw = shares.map((s) => (s / totalShare) * target);
    let out = raw.map((v) => Math.max(0, Math.round(v)));
    let diff = target - out.reduce((a, b) => a + b, 0);
    const noodleIdxs = baseRows.map((r, i) => (r._cat === "noodle" ? i : -1)).filter((i) => i >= 0);
    const pool = noodleIdxs.length ? noodleIdxs : [out.length - 1];
    if (diff > 0) for (let i = 0; i < diff; i++) out[pool[i % pool.length]] += 1;
    else for (let i = 0; i < -diff; i++) out[pool[i % pool.length]] = Math.max(0, out[pool[i % pool.length]] - 1);
    return baseRows.map((r, i) => ({ ...r, estimated_kcal: out[i] }));
  }

  const scale = target / baseSum;
  let assigned = baseRows.map((r) => Math.max(0, Math.round(r._base * scale)));

  const SEASONING_CAP = 120;
  let excess = 0;
  assigned = assigned.map((v, i) => {
    if (baseRows[i]._cat === "seasoning" && v > SEASONING_CAP) {
      excess += v - SEASONING_CAP;
      return SEASONING_CAP;
    }
    return v;
  });
  if (excess > 0) {
    const noodleIdxs = baseRows.map((r, i) => (r._cat === "noodle" ? i : -1)).filter((i) => i >= 0);
    const pool = noodleIdxs.length ? noodleIdxs : [assigned.length - 1];
    const per = Math.floor(excess / pool.length);
    pool.forEach((i) => (assigned[i] += per));
    let rem = excess - per * pool.length;
    for (let k = 0; k < rem; k++) assigned[pool[k % pool.length]] += 1;
  }

  let sumNow = assigned.reduce((a, b) => a + b, 0);
  let diff = target - sumNow;
  const noodleIdxs = baseRows.map((r, i) => (r._cat === "noodle" ? i : -1)).filter((i) => i >= 0);
  const pool = noodleIdxs.length ? noodleIdxs : [assigned.length - 1];
  if (diff > 0) for (let i = 0; i < diff; i++) assigned[pool[i % pool.length]] += 1;
  else for (let i = 0; i < -diff; i++) assigned[pool[i % pool.length]] = Math.max(0, assigned[pool[i % pool.length]] - 1);

  return baseRows.map((r, i) => ({ ...r, estimated_kcal: assigned[i] }));
};

const normalizeBucket = (b) => {
  const s = norm(b);
  if (s.startsWith("low") || s === "less" || s === "lower") return "lower";
  if (s.startsWith("high") || s === "more" || s === "higher") return "higher";
  if (s.startsWith("sim") || s === "same") return "similar";
  return null;
};
const deriveBucket = (altKcal, baseKcal) => {
  const a = Number(altKcal), b = Number(baseKcal);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return "similar";
  const diff = (a - b) / b;
  if (diff <= -0.07) return "lower";
  if (diff >= 0.07) return "higher";
  return "similar";
};

// split a raw “Ingredients: …” line
const parseIngredientsText = (txt = "") => {
  const t = String(txt || "");
  const cleaned = t
    .replace(
      /^\s*(ingredients?|zutaten|ingredientes|ingr[ée]dients|ingrediënten|ingredienti|inhaltsstoffe|içindekiler|malzemeler|состав|配料|成分|原材料|재료)\s*[:：\-–]\s*/i,
      ""
    )
    .trim();
  if (!cleaned) return [];
  const rawTokens = cleaned.split(/[,;•·・●]+/u).map((s) => s.trim()).filter(Boolean);
  const out = [];
  rawTokens.forEach((tok) => {
    const m = tok.match(/^(.*?)\((.*?)\)\s*$/);
    if (m) {
      const head = m[1].trim();
      const inner = m[2].split(/[,;]+/g).map((x) => x.trim()).filter(Boolean);
      if (head) out.push(head);
      inner.forEach((x) => out.push(x));
    } else {
      out.push(tok);
    }
  });
  return out.map((name, i) => ({ index: i + 1, name }));
};
/* ----------------- /helpers ----------------- */

/* ----------------- OpenAI calls (same shape as Scan_Food_Camera) ----------------- */
const analyzeFoodUrl = async ({ imageUrl, apiKey }) => {
  const systemPrompt = `
You are **Cal Diet AI — Visual Mode**. Ignore text unless helpful; identify foods from the image (any cuisine/language), estimate portions, and return **STRICT JSON** in the schema below.

- Always give per-package/serving **calories_kcal_total**.
- Fill macros (protein_g, fat_g, carbs_g, sugar_g, fiber_g, sodium_mg) with realistic values; avoid 0 unless truly zero.
- Build **ingredients_full** (salt = 0 kcal) and ensure per-ingredient kcal never exceed total; scale if needed.
- Provide **8–12 alternatives** with per-package kcal and bucket vs this product (±7%).

Return ONLY:
{
  "title": "string", "brand": "string", "calories_kcal_total": number,
  "protein_g": number, "fat_g": number, "sugar_g": number, "carbs_g": number, "fiber_g": number, "sodium_mg": number, "health_score": number,
  "ingredients_full": [{ "index": number,"name":"string","estimated_grams":number|null,"kcal_per_100g":number|null,"estimated_kcal":number|null,"assumed":boolean }],
  "ingredients_text": "string",
  "items": [{ "name": "string","subtitle": "string","calories_kcal": number,"icon":"string" }],
  "alternatives": [{ "brand":"string","name":"string","flavor_or_variant":"string","calories_per_package_kcal":number,"bucket":"lower|similar|higher" }]
}`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        { type: "text", text: "Analyze this product and return strict JSON only." },
        { type: "image_url", image_url: { url: imageUrl } },
      ]},
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
};

const analyzeIngredientsOnly = async ({ imageUrl, apiKey }) => {
  const systemPrompt = `
Extract ONLY ingredients (many languages). Return:
{ "ingredients_text": "string", "ingredients_full": [{ "index":number,"name":"string","estimated_grams":number|null,"kcal_per_100g":number|null,"estimated_kcal":number|null,"assumed":boolean }] }
- Keep printed order; expand parentheses; numbers may be null.`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        { type: "text", text: "Return ingredients only, JSON." },
        { type: "image_url", image_url: { url: imageUrl } },
      ]},
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
};

const fetchAlternativesFallback = async ({ title, brand, kcal, apiKey }) => {
  const systemPrompt = `
Generate 8–12 realistic alternatives (same brand first if known, then others). Return:
{ "alternatives":[{ "brand":"string","name":"string","flavor_or_variant":"string","calories_per_package_kcal":number,"bucket":"lower|similar|higher"}] }`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Base: ${title || "Food"} | brand: ${brand || ""} | kcal: ${Number(kcal) || "(unknown)"}` },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
};
/* ----------------- /OpenAI calls ----------------- */

export default function Inventory() {
  const { register, present, dismiss, dismissAll } = useSheets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const { ramenRecipes, recipesLoading, recipesError, recipesEnd, loadMoreRecipes } =
    useOpenAIRecipes({
      items,
      enabled: !loading,
      pageSize: 6,
      model: "o4-mini",
      // apiKey: "<YOUR_OPENAI_API_KEY>",
    });

  // ✅ track items that should slide out (UI-only)
  const [exitingIds, setExitingIds] = useState([]);

  const startOfDay = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setHours(0,0,0,0); return x; };

  const OPENAI_API_KEY =
    "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";

  // -------- Date grouping helpers --------
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts?.toDate) return ts.toDate();
    if (typeof ts === "number") return new Date(ts);
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);
  };
  const startOfISOWeek = (d) => { const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); dt.setHours(0,0,0,0); return dt; };
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const labelFor = (date) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const sow = startOfISOWeek(now);
    const som = startOfMonth(now);
    if (date >= todayStart) return "Today";
    if (date >= sow)        return "This Week";
    if (date >= som)        return "This Month";
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Build a flat list with headers + items, newest first
  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => toDate(b.created_at) - toDate(a.created_at));
    const out = [];
    let lastHeader = null;
    for (const it of sorted) {
      const d = toDate(it.created_at);
      const label = labelFor(d);
      if (label !== lastHeader) { out.push({ type: "header", key: label }); lastHeader = label; }
      out.push({ type: "item", item: it });
    }
    return out;
  }, [items]);

  // Firestore subscription
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) { console.warn("User not logged in"); setLoading(false); return; }
    const db = getFirestore();
    const colRef = collection(db, "users", uid, "Inventory");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setItems(data);
        setLoading(false);
      },
      (error) => { console.error("Error fetching inventory:", error); setLoading(false); }
    );
    return () => unsubscribe();
  }, []);

  /* ----------------- ENRICH INVENTORY DOCS (ingredients + alternatives) ----------------- */
  const processing = useRef(new Set());   // ids being enriched
  const alreadyDone = useRef(new Set());  // memo inside session

  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid || !OPENAI_API_KEY) return;

    // sequential queue to be gentle with rate limits
    const queue = items
      .filter(it =>
        it?.image_cloud_url &&
        !it?.enriched_v2 &&                      // only once (flag we will set)
        !processing.current.has(it.id) &&
        !alreadyDone.current.has(it.id)
      );

    if (!queue.length) return;

    const run = async () => {
      for (const it of queue) {
        processing.current.add(it.id);
        try {
          const db = getFirestore();
          const ref = doc(db, "users", uid, "Inventory", it.id);

          // 1) main analysis
          const analyzed = await analyzeFoodUrl({ imageUrl: it.image_cloud_url, apiKey: OPENAI_API_KEY });

          // 2) maybe a better ingredients-only pass
          let ingredientsFull = Array.isArray(analyzed?.ingredients_full) ? analyzed.ingredients_full : [];
          if ((!ingredientsFull || ingredientsFull.length < 3) && analyzed?.ingredients_text) {
            try {
              const ingOnly = await analyzeIngredientsOnly({ imageUrl: it.image_cloud_url, apiKey: OPENAI_API_KEY });
              if (Array.isArray(ingOnly?.ingredients_full) && ingOnly.ingredients_full.length > (ingredientsFull?.length || 0)) {
                ingredientsFull = ingOnly.ingredients_full;
              }
            } catch {}
          }
          if (!ingredientsFull?.length && analyzed?.ingredients_text) {
            ingredientsFull = parseIngredientsText(analyzed.ingredients_text);
          }

          // 3) reconcile per-ingredient kcal to package total
          const kcalSafe = toNum(analyzed?.calories_kcal_total, null);
          const reconciled = reconcileIngredientsToTotal(
            (ingredientsFull || []).map((row, i) => ({
              index: toNum(row?.index, i + 1),
              name: toStr(row?.name, ""),
              estimated_grams: Number.isFinite(toNum(row?.estimated_grams, NaN)) ? toNum(row?.estimated_grams, NaN) : null,
              kcal_per_100g: Number.isFinite(toNum(row?.kcal_per_100g, NaN)) ? toNum(row?.kcal_per_100g, NaN) : null,
              estimated_kcal: Number.isFinite(toNum(row?.estimated_kcal, NaN)) ? Math.round(toNum(row?.estimated_kcal, NaN)) : null,
              assumed: !!row?.assumed,
            }))
              .filter(r => r.name.length > 0)
              .sort((a, b) => a.index - b.index),
            kcalSafe
          );

          // 4) alternatives (fallback if needed)
          let rawAlts = Array.isArray(analyzed?.alternatives) ? analyzed.alternatives : [];
          if (!rawAlts || rawAlts.length < 6) {
            try {
              const altFallback = await fetchAlternativesFallback({
                title: toStr(analyzed?.title, it.title || "Food"),
                brand: toStr(analyzed?.brand, it.brand || ""),
                kcal: kcalSafe || null,
                apiKey: OPENAI_API_KEY,
              });
              if (Array.isArray(altFallback?.alternatives)) rawAlts = rawAlts.concat(altFallback.alternatives);
            } catch {}
          }

          const sameBrand = [];
          const otherBrands = [];
          const baseBrand = toStr(analyzed?.brand, "");
          rawAlts.forEach((a) => {
            const brand = toStr(a?.brand, "");
            const name = toStr(a?.name, "");
            const variant = toStr(a?.flavor_or_variant || "", "");
            const kcal = toNum(a?.calories_per_package_kcal, NaN);
            const bucket = normalizeBucket(a?.bucket) ?? deriveBucket(kcal, kcalSafe);
            const normalized = {
              brand: brand || null,
              name,
              flavor_or_variant: variant || null,
              calories_per_package_kcal: Number.isFinite(kcal) ? Math.round(kcal) : null,
              bucket,
            };
            if (baseBrand && norm(brand) === norm(baseBrand)) sameBrand.push(normalized); else otherBrands.push(normalized);
          });

          const ALL = [...sameBrand, ...otherBrands];
          const less = ALL.filter(x => x.bucket === "lower").slice(0,5);
          const simil = ALL.filter(x => x.bucket === "similar").slice(0,2);
          const more = ALL.filter(x => x.bucket === "higher").slice(0,5);
          const toCard = (p) => ({
            label: [p.brand, p.name, p.flavor_or_variant].filter(Boolean).join(" "),
            amt: Number.isFinite(p.calories_per_package_kcal) ? `${p.calories_per_package_kcal}cal` : "—",
            moreOrLess: p.bucket === "lower" ? "less" : p.bucket === "higher" ? "more" : "similar",
          });
          const alternatives_flat = [...less, ...simil, ...more].map(toCard);

          // 5) persist to Inventory doc (merge)
          await updateDoc(ref, {
            // keep original Inventory fields; just augment
            title_detected: toStr(analyzed?.title, it.title || ""),
            brand_detected: baseBrand || null,
            calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
            protein_g: toNum(analyzed?.protein_g, null),
            fat_g: toNum(analyzed?.fat_g, null),
            sugar_g: toNum(analyzed?.sugar_g, null),
            carbs_g: toNum(analyzed?.carbs_g, null),
            fiber_g: toNum(analyzed?.fiber_g, null),
            sodium_mg: toNum(analyzed?.sodium_mg, null),
            health_score: toNum(analyzed?.health_score, null),

            ingredients_full: reconciled,
            ingredients_kcal_list: reconciled.map(r => ({ name: r.name, kcal: Number(r.estimated_kcal) || 0 })),
            ingredients_kcal_map: Object.fromEntries(reconciled.map(r => [norm(r.name), Number(r.estimated_kcal) || 0])),

            alternatives: {
              base_brand: baseBrand || null,
              same_brand: sameBrand,
              other_brands: otherBrands,
              summary_by_bucket: {
                lower: less.length, similar: simil.length, higher: more.length, total: ALL.length,
              },
            },
            alternatives_flat,

            enriched_v2: true,
            enriched_at: serverTimestamp(),
          });

          alreadyDone.current.add(it.id);
        } catch (e) {
          console.warn("Inventory enrich failed:", it.id, e?.message || e);
        } finally {
          processing.current.delete(it.id);
        }
      }
    };

    run();
  }, [items, OPENAI_API_KEY]);
  /* ----------------- /ENRICHMENT ----------------- */

  // ---- Animation store (no hooks inside renderItem)
  const animX = useRef(new Map()).current;
  const animOp = useRef(new Map()).current;
  const getVal = (map, id, init) => {
    if (!map.has(id)) map.set(id, new Animated.Value(init));
    return map.get(id);
  };

  const resetHidden = () => {
    setExitingIds([]);
    animX.clear();
    animOp.clear();
  };




    const animation = useRef(null);
    useEffect(() => {
      // You can control the ref programmatically, rather than using autoPlay
      // animation.current?.play();
    }, []);





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

            <>


            <View style={{
            ...(Platform.OS === "ios"
            ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            }
            : { elevation: 2, shadowColor: "#00000030" }),
            }}>

            
              <View style={{
              borderRadius: 19,
              height: height(4),
              marginTop: height(5),
              width: "60%",
              alignSelf: 'center',
              overflow: 'hidden',
              
              }}>
                        
                            
                        
              <LottieView
              autoPlay
              ref={animation}
              style={{
                                            
              width: 500,
              height:500,
              }} contentFit="contain"
              // Find more Lottie files at https://lottiefiles.com/featured
              source={require("../../../assets/BackgroundMotion.json")}
              />
                        
              </View>

             </View>
           
            <View style={{ marginTop: height(2), width: "90%", height: height(20), alignSelf: 'center' }}>
              <Text style={{ color: "#222", fontSize: size(14), textAlign: 'center', lineHeight: height(2.5) }}>
                Add fridge items to your inventory and get alerts before they expire or when you're running low.
              </Text>
            </View>

           </>
          }
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
                      {item.title || item.title_detected || "Item"}
                    </Text>

                    <Text style={{ fontWeight: "bold", fontSize: size(13), marginTop: height(1), width: width(25) }}>
                      {item.serving_size || item.brand_detected || ""}
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

          <FlatList
            showsHorizontalScrollIndicator={false}
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
                  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 10 },
                  android: { elevation: 6, shadowColor: '#888' },
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
            ListFooterComponent={recipesLoading ? <ActivityIndicator style={{ marginRight: 12 }} /> : null}
          />
        </View>
      </ScrollView>
    </View>
  );
}
