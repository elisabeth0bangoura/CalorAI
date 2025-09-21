// ./Cameras/FoodLabel_Camera.js
import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, width } from "react-native-responsive-sizes";
import PageAfterScan_FoodLabel from "../PageAfterScan/PageAfterScan_Scan_FoodLabel/PageAfterScan_FoodLabel";

// ✅ Current-item context
import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";

// ✅ Firebase
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

/* ---------------- helpers ---------------- */
const LUCIDE_SAFE = new Set([
  "Utensils","Apple","Banana","Bread","Cheese","Cookie","Candy","Coffee",
  "Egg","Fish","Milk","Pizza","Sandwich","Salad","Carrot","Drumstick",
  "CupSoda","Avocado","IceCream","Droplet","Bone"
]);
const safeIconName = (s) =>
  typeof s === "string" && LUCIDE_SAFE.has(s.trim()) ? s.trim() : "Utensils";
const toNum = (n, d = 0) => (Number.isFinite(+n) ? +n : d);
const toStr = (s, d = "") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;
const norm = (s) => String(s || "").trim().toLowerCase();

/* --- tiny categorizer for ingredient kcal reconciliation --- */
const categoryOf = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("salt") || n.includes("sodium")) return "salt";
  if (/(wheat|flour|noodle|pasta|cracker|bread|rice|oat|corn)/i.test(n)) return "starch";
  if (/(season|powder|sauce|flavor|spice)/i.test(n)) return "seasoning";
  if (/(oil|fat|butter|cream)/i.test(n)) return "fat";
  if (/(sugar|glucose|fructose|syrup|honey)/i.test(n)) return "sugar";
  if (/(veg|onion|garlic|cabbage|carrot|pepper|tomato)/i.test(n)) return "veg";
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
    return baseRows.map((r) => ({ ...r, estimated_kcal: Math.round(r._base) }));
  }

  let baseSum = baseRows.reduce((s, r) => s + r._base, 0);
  if (baseSum <= 0.0001) {
    // heuristic split
    let shares = baseRows.map((r) => {
      if (r._cat === "starch") return 0.6;
      if (r._cat === "fat") return 0.2;
      if (r._cat === "sugar") return 0.15;
      if (r._cat === "seasoning") return 0.04;
      if (r._cat === "veg") return 0.01;
      return 0.0;
    });
    if (shares.every((v) => v === 0)) shares = baseRows.map(() => 1 / baseRows.length);
    const totalShare = shares.reduce((a, b) => a + b, 0) || 1;
    const out = shares.map((s) => Math.max(0, Math.round((s / totalShare) * target)));
    let diff = target - out.reduce((a, b) => a + b, 0);
    const starchIdxs = baseRows.map((r, i) => (r._cat === "starch" ? i : -1)).filter((i) => i >= 0);
    const pool = starchIdxs.length ? starchIdxs : [out.length - 1];
    if (diff > 0) for (let i = 0; i < diff; i++) out[pool[i % pool.length]] += 1;
    else for (let i = 0; i < -diff; i++) out[pool[i % pool.length]] = Math.max(0, out[pool[i % pool.length]] - 1);
    return baseRows.map((r, i) => ({ ...r, estimated_kcal: out[i] }));
  }

  const scale = target / baseSum;
  let assigned = baseRows.map((r) => Math.max(0, Math.round(r._base * scale)));

  // cap seasonings
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
    const starchIdxs = baseRows.map((r, i) => (r._cat === "starch" ? i : -1)).filter((i) => i >= 0);
    const pool = starchIdxs.length ? starchIdxs : [assigned.length - 1];
    const per = Math.floor(excess / pool.length);
    pool.forEach((i) => (assigned[i] += per));
    let rem = excess - per * pool.length;
    for (let k = 0; k < rem; k++) assigned[pool[k % pool.length]] += 1;
  }

  // fix rounding
  let sumNow = assigned.reduce((a, b) => a + b, 0);
  let diff = target - sumNow;
  const starchIdxs = baseRows.map((r, i) => (r._cat === "starch" ? i : -1)).filter((i) => i >= 0);
  const pool = starchIdxs.length ? starchIdxs : [assigned.length - 1];
  if (diff > 0) for (let i = 0; i < diff; i++) assigned[pool[i % pool.length]] += 1;
  else for (let i = 0; i < -diff; i++) assigned[pool[i % pool.length]] = Math.max(0, assigned[pool[i % pool.length]] - 1);

  return baseRows.map((r, i) => ({ ...r, estimated_kcal: assigned[i] }));
};

/* ---------- Firebase upload ---------- */
const uploadImageToStorage = async ({ fileUri, uid = "anon" }) => {
  const path = `labels/${uid}/${Date.now()}.jpg`;
  const ref = storage().ref(path);
  await ref.putFile(fileUri, { contentType: "image/jpeg" });
  return await ref.getDownloadURL();
};

/* ---------------- dual logger ---------------- */
const mkLogger = (addLog) => (...args) => {
  const line = args
    .map((a) => {
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(" ");
  console.log(line);
  addLog?.(line);
};

/* ---------------- icon picker ---------------- */
async function pickIconForProduct({ category, title, apiKey, log = console.log }) {
  try {
    const allowed = Array.from(LUCIDE_SAFE);
    const body = {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
`Pick one UI icon name from this set (case-sensitive):
${JSON.stringify(allowed)}
Return JSON only: {"icon":"Apple"}.`,
        },
        {
          role: "user",
          content: `Title: ${toStr(title, "")}\nCategory: ${toStr(category, "")}\nJSON only.`,
        },
      ],
    };
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[ICON] status:", r.status);
    if (!r.ok) return "Utensils";
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    return safeIconName(parsed?.icon);
  } catch {
    return "Utensils";
  }
}

/* ---------- OFF helpers (fallback) ---------- */
function parseServingSizeG(s) {
  const m = String(s || "").match(/([\d.]+)\s*(g|ml)?/i);
  return m ? +m[1] : null;
}
async function offSearchByText({ title, brand, category }, log = console.log) {
  const terms = [brand, title].filter(Boolean).join(" ").trim();
  if (!terms) return null;
  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "5",
    sort_by: "unique_scans_n",
  });
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
  log("[OFF] search url:", url);
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const products = Array.isArray(j?.products) ? j.products : [];
    return products[0] || null;
  } catch { return null; }
}
function mergeOFFIntoLabel(label, off) {
  if (!off) return label;
  const nutr = off.nutriments || {};
  const kcal100 =
    Number.isFinite(+nutr["energy-kcal_100g"]) ? +nutr["energy-kcal_100g"] :
    Number.isFinite(+nutr["energy_100g"]) ? (+nutr["energy_100g"] / 4.184) : null;

  const servingG =
    Number.isFinite(+label?.serving_size_g) ? +label.serving_size_g :
    parseServingSizeG(off?.serving_size);

  const kcalServing =
    Number.isFinite(+nutr["energy-kcal_serving"]) ? +nutr["energy-kcal_serving"] :
    (Number.isFinite(kcal100) && Number.isFinite(servingG)) ? Math.round(kcal100 * (servingG/100)) : null;

  const protein =
    Number.isFinite(+nutr["proteins_serving"]) ? +nutr["proteins_serving"] :
    Number.isFinite(+nutr["proteins_100g"]) && Number.isFinite(servingG) ? (+nutr["proteins_100g"] * servingG / 100) : null;

  const fat =
    Number.isFinite(+nutr["fat_serving"]) ? +nutr["fat_serving"] :
    Number.isFinite(+nutr["fat_100g"]) && Number.isFinite(servingG) ? (+nutr["fat_100g"] * servingG / 100) : null;

  const carbs =
    Number.isFinite(+nutr["carbohydrates_serving"]) ? +nutr["carbohydrates_serving"] :
    Number.isFinite(+nutr["carbohydrates_100g"]) && Number.isFinite(servingG) ? (+nutr["carbohydrates_100g"] * servingG / 100) : null;

  const sugars =
    Number.isFinite(+nutr["sugars_serving"]) ? +nutr["sugars_serving"] :
    Number.isFinite(+nutr["sugars_100g"]) && Number.isFinite(servingG) ? (+nutr["sugars_100g"] * servingG / 100) : null;

  const fiber =
    Number.isFinite(+nutr["fiber_serving"]) ? +nutr["fiber_serving"] :
    Number.isFinite(+nutr["fiber_100g"]) && Number.isFinite(servingG) ? (+nutr["fiber_100g"] * servingG / 100) : null;

  const sodiumMg =
    Number.isFinite(+nutr["sodium_serving"]) ? (+nutr["sodium_serving"] * 1000) :
    Number.isFinite(+nutr["sodium_100g"]) && Number.isFinite(servingG) ? (+nutr["sodium_100g"] * servingG * 1000 / 100) : null;

  const out = { ...(label || {}) };
  out.energy_kcal_per_100g = out.energy_kcal_per_100g ?? (Number.isFinite(kcal100) ? Math.round(kcal100) : null);
  out.energy_kcal_per_serving = out.energy_kcal_per_serving ?? (Number.isFinite(kcalServing) ? Math.round(kcalServing) : null);

  out.protein_g_per_serving = out.protein_g_per_serving ?? (Number.isFinite(protein) ? Math.round(protein * 10)/10 : null);
  out.fat_g_per_serving     = out.fat_g_per_serving     ?? (Number.isFinite(fat) ? Math.round(fat * 10)/10 : null);
  out.carbs_g_per_serving   = out.carbs_g_per_serving   ?? (Number.isFinite(carbs) ? Math.round(carbs * 10)/10 : null);
  out.sugars_g_per_serving  = out.sugars_g_per_serving  ?? (Number.isFinite(sugars) ? Math.round(sugars * 10)/10 : null);
  out.fiber_g_per_serving   = out.fiber_g_per_serving   ?? (Number.isFinite(fiber) ? Math.round(fiber * 10)/10 : null);
  out.sodium_mg_per_serving = out.sodium_mg_per_serving ?? (Number.isFinite(sodiumMg) ? Math.round(sodiumMg) : null);
  return out;
}
async function fillFromOFFIfMissing(label, log = console.log) {
  const missingAll =
    !Number.isFinite(+label?.energy_kcal_per_serving) &&
    !Number.isFinite(+label?.energy_kcal_per_100g) &&
    !Number.isFinite(+label?.energy_kcal_total_for_package);

  const missMacros =
    !Number.isFinite(+label?.protein_g_per_serving) &&
    !Number.isFinite(+label?.fat_g_per_serving) &&
    !Number.isFinite(+label?.carbs_g_per_serving);

  if (!missingAll && !missMacros) return label;

  const off = await offSearchByText({
    title: label?.title || label?.inferred_title,
    brand: label?.brand,
    category: label?.category || label?.inferred_category,
  }, log);

  return mergeOFFIntoLabel(label, off);
}

/* ---------- Read Nutrition Label via OpenAI ---------- */
async function readFoodLabelFromImage({ imageUrl, apiKey, log = console.log }) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`Extract food LABEL fields from an image (any language). Output in English, keep brand as printed.
If energy in kJ, convert to kcal (1 kcal = 4.184 kJ).
If SALT is listed, convert to sodium_mg = round(salt_g * 393).
JSON ONLY:
{
  "brand": "string|null",
  "title": "string|null",
  "category": "string|null",
  "serving_size_g":  number|null,
  "servings_per_package": number|null,
  "net_weight_g": number|null,

  "energy_kcal_per_100g": number|null,
  "energy_kcal_per_serving": number|null,
  "energy_kcal_total_for_package": number|null,

  "protein_g_per_serving": number|null,
  "fat_g_per_serving": number|null,
  "sat_fat_g_per_serving": number|null,
  "carbs_g_per_serving": number|null,
  "sugars_g_per_serving": number|null,
  "fiber_g_per_serving": number|null,
  "sodium_mg_per_serving": number|null,
  "calcium_mg_per_serving": number|null,

  "ingredients": ["string", ...],

  "inferred_title": "string|null",
  "inferred_category": "string|null",
  "inference_confidence": 0.0
}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Read the full nutrition facts and return JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[LABEL] status:", r.status);
    if (!r.ok) return null;
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    log("[LABEL] parsed:", parsed);
    return parsed;
  } catch (e) {
    log("[LABEL] error:", e?.message || String(e));
    return null;
  }
}

async function readNutritionTable({ imageUrl, apiKey, log = console.log }) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`Extract NUTRITION TABLE to per_100 and per_serving. Convert kJ→kcal and salt→sodium. JSON ONLY:
{
  "serving_size": {"value": number|null, "unit": "g|ml|null"},
  "servings_per_package": number|null,
  "per_100": {"energy_kcal": number|null, "protein_g": number|null, "fat_g": number|null, "sat_fat_g": number|null, "carbs_g": number|null, "sugars_g": number|null, "fiber_g": number|null, "sodium_mg": number|null, "calcium_mg": number|null},
  "per_serving": {"energy_kcal": number|null, "protein_g": number|null, "fat_g": number|null, "sat_fat_g": number|null, "carbs_g": number|null, "sugars_g": number|null, "fiber_g": number|null, "sodium_mg": number|null, "calcium_mg": number|null}
}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the nutrition table precisely. JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[NUTRITION-TABLE] status:", r.status);
    if (!r.ok) return null;
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    log("[NUTRITION-TABLE] parsed:", parsed);
    return parsed;
  } catch (e) {
    log("[NUTRITION-TABLE] error:", e?.message || String(e));
    return null;
  }
}
function mergeNutritionTableIntoLabel(label, tbl) {
  if (!tbl || typeof tbl !== "object") return label || {};
  const out = { ...(label || {}) };

  const svVal = Number.isFinite(+tbl?.serving_size?.value) ? +tbl.serving_size.value : null;
  const svUnit = typeof tbl?.serving_size?.unit === "string" ? tbl.serving_size.unit.toLowerCase() : null;
  const servingG = svVal ? (svUnit === "ml" ? svVal : svVal) : null;

  const p100 = tbl?.per_100 || {};
  const pS = tbl?.per_serving || {};
  const calc = (k100, kS) => {
    if (Number.isFinite(+kS)) return +kS;
    if (Number.isFinite(+k100) && Number.isFinite(servingG)) return +(k100 * (servingG / 100));
    return null;
  };

  out.serving_size_g = out.serving_size_g ?? servingG;
  out.servings_per_package = out.servings_per_package ?? (Number.isFinite(+tbl?.servings_per_package) ? +tbl.servings_per_package : null);

  out.energy_kcal_per_serving = out.energy_kcal_per_serving ?? calc(p100.energy_kcal, pS.energy_kcal);
  out.protein_g_per_serving   = out.protein_g_per_serving   ?? calc(p100.protein_g,   pS.protein_g);
  out.fat_g_per_serving       = out.fat_g_per_serving       ?? calc(p100.fat_g,       pS.fat_g);
  out.sat_fat_g_per_serving   = out.sat_fat_g_per_serving   ?? calc(p100.sat_fat_g,   pS.sat_fat_g);
  out.carbs_g_per_serving     = out.carbs_g_per_serving     ?? calc(p100.carbs_g,     pS.carbs_g);
  out.sugars_g_per_serving    = out.sugars_g_per_serving    ?? calc(p100.sugars_g,    pS.sugars_g);
  out.fiber_g_per_serving     = out.fiber_g_per_serving     ?? calc(p100.fiber_g,     pS.fiber_g);
  out.sodium_mg_per_serving   = out.sodium_mg_per_serving   ?? calc(p100.sodium_mg,   pS.sodium_mg);
  out.calcium_mg_per_serving  = out.calcium_mg_per_serving  ?? calc(p100.calcium_mg,  pS.calcium_mg);

  out.energy_kcal_per_100g = out.energy_kcal_per_100g ?? (Number.isFinite(+p100.energy_kcal) ? Math.round(+p100.energy_kcal) : null);

  return out;
}

/* ---------- Title + mapping ---------- */
function prettyProductTitle(rawTitle, category) {
  const t = toStr(rawTitle, "");
  if (!t) return t;
  const NOISE = /(uht|ultra[-\s]?heat(?:ed)?|barista|edition|%|\d+ml|\d+g)/gi;
  return t.replace(NOISE, "").trim() || t;
}
function computeCalories(label) {
  const per100 = Number.isFinite(+label?.energy_kcal_per_100g) ? +label.energy_kcal_per_100g : null;
  const servingSize = Number.isFinite(+label?.serving_size_g) ? +label.serving_size_g : null;
  const servings = Number.isFinite(+label?.servings_per_package) ? +label.servings_per_package : null;
  const netWeight = Number.isFinite(+label?.net_weight_g) ? +label.net_weight_g : null;
  const perServingLLM = Number.isFinite(+label?.energy_kcal_per_serving) ? +label.energy_kcal_per_serving : null;
  const totalLLM = Number.isFinite(+label?.energy_kcal_total_for_package) ? +label.energy_kcal_total_for_package : null;

  const perServing =
    perServingLLM ??
    (Number.isFinite(per100) && Number.isFinite(servingSize) ? per100 * (servingSize / 100) : null);

  const total =
    (Number.isFinite(perServing) && Number.isFinite(servings)) ? perServing * servings :
    (Number.isFinite(per100) && Number.isFinite(netWeight)) ? per100 * (netWeight / 100) :
    totalLLM ?? null;

  return {
    perServing: Number.isFinite(perServing) ? Math.round(perServing) : null,
    perPackage: Number.isFinite(total) ? Math.round(total) : null,
  };
}
function mapLabelToAnalyzed(label) {
  const brand = toStr(label?.brand, "");
  const category = toStr(label?.category, "") || toStr(label?.inferred_category, "") || "unknown";
  const rawTitle = toStr(label?.title, "") || toStr(label?.inferred_title, "");
  const title = prettyProductTitle(rawTitle, category);
  const servings = Number.isFinite(+label?.servings_per_package) ? +label.servings_per_package : null;
  const sz = Number.isFinite(+label?.serving_size_g) ? +label.serving_size_g : null;

  const { perServing, perPackage } = computeCalories(label);

  const sizeStr =
    Number.isFinite(sz) && Number.isFinite(servings)
      ? `${sz}g × ${servings}`
      : Number.isFinite(sz)
      ? `${sz}g`
      : toStr(label?.net_weight_g, "")
      ? `${label.net_weight_g}g`
      : "";

  const ing = Array.isArray(label?.ingredients) ? label.ingredients.map(String) : [];

  return {
    barcode: "",
    title,
    brand,
    size: sizeStr,
    category,
    calories_kcal_per_serving: perServing,
    calories_kcal_total: perPackage,
    servings_per_package: servings,
    serving_size_g: sz,
    net_weight_g: Number.isFinite(+label?.net_weight_g) ? +label.net_weight_g : null,

    protein_g: Number.isFinite(+label?.protein_g_per_serving) ? +label.protein_g_per_serving : null,
    fat_g: Number.isFinite(+label?.fat_g_per_serving) ? +label.fat_g_per_serving : null,
    sat_fat_g: Number.isFinite(+label?.sat_fat_g_per_serving) ? +label.sat_fat_g_per_serving : null,
    carbs_g: Number.isFinite(+label?.carbs_g_per_serving) ? +label.carbs_g_per_serving : null,
    sugar_g: Number.isFinite(+label?.sugars_g_per_serving) ? +label.sugars_g_per_serving : null,
    fiber_g: Number.isFinite(+label?.fiber_g_per_serving) ? +label.fiber_g_per_serving : null,
    sodium_mg: Number.isFinite(+label?.sodium_mg_per_serving) ? +label.sodium_mg_per_serving : null,
    calcium_mg: Number.isFinite(+label?.calcium_mg_per_serving) ? +label.calcium_mg_per_serving : null,

    ingredients_text: ing.join(", "),
    ingredients_list: ing.map((t) => ({ text: t })),
    health_score: 0,
    items: [
      {
        name: title || "Item",
        subtitle: sizeStr,
        calories_kcal: Number.isFinite(perServing) ? perServing : (Number.isFinite(perPackage) ? perPackage : 0),
        icon: "Utensils",
      },
    ],
  };
}

/* ---------- Alternatives ---------- */
const normalizeBucket = (b) => {
  const s = norm(b || "");
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
async function fetchAlternativesDetailed({ title, brand, kcal, apiKey, log = console.log }) {
  const systemPrompt = `
Generate 8–12 realistic packaged-food alternatives. Prefer same brand first (variants, sizes), then other brands.
Reply JSON:
{ "alternatives":[{ "brand":"string","name":"string","flavor_or_variant":"string","calories_per_package_kcal":number,"bucket":"lower|similar|higher"}] }`.trim();

  const userMsg = `
Base product:
- title: ${title || "Unknown product"}
- brand: ${brand || "(none)"}
- kcal per package: ${Number.isFinite(Number(kcal)) ? Number(kcal) : "(unknown)"}
Return JSON only.`.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.15,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      }),
    });
    log("[ALTS-DETAILED] status:", r.status);
    if (!r.ok) return { alternatives: [] };
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    return parsed && typeof parsed === "object" ? parsed : { alternatives: [] };
  } catch (e) {
    log("[ALTS-DETAILED] error:", e?.message || String(e));
    return { alternatives: [] };
  }
}

/* ---------------- HEALTH PROFILE + PROMS (same style as barcode) ---------------- */
const fetchUserHealthProfile = async (uid, addLog) => {
  try {
    const db = getFirestore();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists) return {};
    const data = snap.data() || {};
    const habitsContainer = data.habits && typeof data.habits === "object" ? data.habits : {};
    const habits = {
      reduceCoffee:
        typeof data.reduceCoffee === "boolean"
          ? data.reduceCoffee
          : typeof habitsContainer.reduceCoffee === "boolean"
          ? habitsContainer.reduceCoffee
          : false,
      stopSmoking:
        typeof data.stopSmoking === "boolean"
          ? data.stopSmoking
          : typeof habitsContainer.stopSmoking === "boolean"
          ? habitsContainer.stopSmoking
          : false,
    };
    addLog?.("[HEALTH] loaded settings");
    return {
      kidneySettings: data.kidneySettings || {},
      heartSettings: data.heartSettings || {},
      diabetesSettings: data.diabetesSettings || {},
      habits,
    };
  } catch (e) {
    addLog?.(`[HEALTH] load failed: ${e?.message || e}`);
    return {};
  }
};
const pct = (v, limit) =>
  Number.isFinite(v) && Number.isFinite(limit) && limit > 0
    ? Math.round((v / limit) * 100)
    : null;
const satFatCapFor = (level = "moderate") => {
  const m = String(level || "moderate").toLowerCase();
  if (m.startsWith("low")) return 10;
  if (m.startsWith("high")) return 20;
  return 13;
};
const looksCaffeinated = ({ title, ingredients_text, items }) => {
  const hay = [
    String(title || ""),
    String(ingredients_text || ""),
    ...(Array.isArray(items) ? items.map((i) => `${i?.name || ""} ${i?.subtitle || ""}`) : []),
  ].join(" ").toLowerCase();
  return /(coffee|espresso|latte|cappuccino|americano|mocha|cold\s*brew|energy\s*drink|caffeine|mate|yerba|guarana|cola|tea|matcha)/i.test(hay);
};
const buildHealthPrompts = ({ macros, profile, product }) => {
  const lines = [];
  const parts = {};

  if (profile?.kidneySettings) {
    const k = profile.kidneySettings;
    const sodiumLimit = Number.isFinite(+k.sodiumLimitMg) ? +k.sodiumLimitMg : 2000;
    const sodiumP = pct(macros.sodium_mg, sodiumLimit);
    let kidney = `Kidney: `;
    if (Number.isFinite(macros.sodium_mg)) {
      kidney += `${macros.sodium_mg} mg sodium`;
      if (sodiumP != null) kidney += ` (${sodiumP}% of your ${sodiumLimit} mg/day).`;
      if (sodiumP != null && sodiumP >= 40)
        kidney += ` Consider low-sodium options or less seasoning.`;
    } else {
      kidney += `sodium not visible on label.`;
    }
    parts.kidney = kidney; lines.push(kidney);
  }

  if (profile?.heartSettings) {
    const h = profile.heartSettings;
    const cap = satFatCapFor(h.satFatLimit);
    let heart = `Heart: `;
    if (macros.fat_g != null) {
      heart += `fat ${macros.fat_g} g`;
      heart += macros.fat_g >= 17 ? ` — on the higher side; keep other meals lighter today.` : ` — reasonable.`;
      heart += ` Aim saturated fat ≈${cap} g/day (${h.satFatLimit || "moderate"}).`;
    } else {
      heart += `fat not visible on label.`;
    }
    parts.heart = heart; lines.push(heart);
  }

  if (profile?.diabetesSettings) {
    let diabetes = `Diabetes: `;
    const flags = [];
    if (macros.carbs_g != null && macros.carbs_g >= 45) flags.push(`carbs ${macros.carbs_g} g`);
    if (macros.sugar_g != null && macros.sugar_g >= 15) flags.push(`sugars ${macros.sugar_g} g`);
    if (macros.fiber_g != null && macros.fiber_g < 4)   flags.push(`low fiber (${macros.fiber_g} g)`);
    diabetes += flags.length
      ? flags.join(", ") + ` — pair with lean protein/veg or halve the portion.`
      : `no major flags detected for this serving.`;
    parts.diabetes = diabetes; lines.push(diabetes);
  }

  const caffeinated = looksCaffeinated(product || {});
  if (profile?.habits?.reduceCoffee) {
    let coffee = `Coffee: you're cutting back. `;
    coffee += caffeinated ? `This looks caffeinated — try decaf or a smaller size today.` : `Nice — this seems caffeine-free.`;
    parts.reduceCoffee = coffee; lines.push(coffee);
  }
  if (profile?.habits?.stopSmoking) {
    let smoke = `Stop smoking: keep momentum. `;
    smoke += caffeinated ? `Coffee can be a trigger; swap with water or take a short walk after.` : `Use meals as a cue to breathe deeply instead of lighting up.`;
    parts.stopSmoking = smoke; lines.push(smoke);
  }

  const text =
    lines.length
      ? `Personalized flags\n• ${lines.join("\n• ")}`
      : "Personalized flags: none detected for your current settings.";

  return {
    text,
    parts,
    numbers: {
      sodium_mg: macros.sodium_mg ?? null,
      carbs_g: macros.carbs_g ?? null,
      fat_g: macros.fat_g ?? null,
      fiber_g: macros.fiber_g ?? null,
      sugar_g: macros.sugar_g ?? null,
      protein_g: macros.protein_g ?? null,
    },
    profile_used: {
      kidneySettings: profile?.kidneySettings || null,
      heartSettings: profile?.heartSettings || null,
      diabetesSettings: profile?.diabetesSettings || null,
      habits: profile?.habits || null,
    },
  };
};

/* ---------------- component ---------------- */
export default forwardRef(function FoodLabel_Camera(
  { inCarousel = false, isActive = false, onScanResult, onScanList, openAiApiKey },
  ref
) {
  const userId = getAuth().currentUser?.uid || "anon";
  const { register, present /* keep same gating as barcode: always show camera */ } = useSheets();
  const { setCurrentItemId, setCurrentItem } = useCurrentScannedItemId();

  // ⚠️ Dev-only fallback; use secure backend in prod
  const OPENAI_API_KEY_FALLBACK =
    "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";
  const EFFECTIVE_OPENAI_KEY = openAiApiKey || OPENAI_API_KEY_FALLBACK;

  const {
    setImageUrl, setCloudUrl, setResult, setRaw, addLog, resetScan,
    setTitle, setCalories, setProtein, setFat, setSugar, setCarbs,
    setFiber, setSodium, setHealthScore, setAlternatives, setList,
    markScannedNow, formatScannedAt, setIngredientsBreakdown,
    scanBusy, beginScan, endScan, setProms, setPartial, setHint,
  } = useScanResults();

  function localDateId(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // register s3
  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan_FoodLabel {...props} />);
  }, [register]);

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(0.12); // <<< small default zoom sharpens preview AF
  const log = mkLogger(addLog);

  /* ---------- overlay anim (visual only) ---------- */
  const frameSize = useMemo(() => ({ w: width(72), h: height(38) }), []);
  const scanAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      scanAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [loading, scanAnim]);

  useImperativeHandle(ref, () => ({
    scan: async () => {
      let _startedGlobal = false;
      try {
        if (!cameraRef.current) {
          Alert.alert("Camera not ready", "Open the FOOD LABEL tab before scanning.");
          return;
        }
        if (!permission?.granted) {
          const req = await requestPermission();
          if (!req?.granted) return;
        }
        if (!EFFECTIVE_OPENAI_KEY || EFFECTIVE_OPENAI_KEY === "sk-REPLACE_ME") {
          Alert.alert("Missing OpenAI API key");
          return;
        }

        resetScan();
        beginScan();
        _startedGlobal = true;
        setLoading(true);
        log("[LABEL] scan started");

        // small hold so AF locks (flat panel text)
        await new Promise((r) => setTimeout(r, 800));

        // higher quality for tiny text
        const pic = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: true,
          exif: false,
          base64: false,
        });
        if (!pic?.uri) {
          log("[ERR] No photo captured");
          Alert.alert("Scan failed", "No photo captured.");
          return;
        }

        // show S3 early
        setImageUrl(pic.uri);
        markScannedNow();
        present?.("s3");
        log(`Stamped scan time: ${formatScannedAt?.() || "now"}`);

        // upload
        log("[LABEL] uploading to Firebase…");
        const downloadUrl = await uploadImageToStorage({ fileUri: pic.uri, uid: userId });
        setCloudUrl(downloadUrl);
        log("[LABEL] upload done");

        // profile for health prompts
        const profile = await fetchUserHealthProfile(userId, addLog);

        // parse label
        let label = await readFoodLabelFromImage({ imageUrl: downloadUrl, apiKey: EFFECTIVE_OPENAI_KEY, log });
        const tbl = await readNutritionTable({ imageUrl: downloadUrl, apiKey: EFFECTIVE_OPENAI_KEY, log });
        if (tbl) {
          label = mergeNutritionTableIntoLabel(label, tbl);
          log("[TABLE] merged");
        }
        // OFF fallback if still missing
        label = await fillFromOFFIfMissing(label, log);

        // partial + hint (optional UI)
        const serving = Number.isFinite(+label?.serving_size_g) ? +label.serving_size_g : null;
        const perServing = {
          calories_kcal: Number.isFinite(+label?.energy_kcal_per_serving) ? +label.energy_kcal_per_serving : null,
          fat_g: Number.isFinite(+label?.fat_g_per_serving) ? +label.fat_g_per_serving : null,
          carbs_g: Number.isFinite(+label?.carbs_g_per_serving) ? +label.carbs_g_per_serving : null,
          protein_g: Number.isFinite(+label?.protein_g_per_serving) ? +label.protein_g_per_serving : null,
          sugar_g: Number.isFinite(+label?.sugars_g_per_serving) ? +label.sugars_g_per_serving : null,
          fiber_g: Number.isFinite(+label?.fiber_g_per_serving) ? +label.fiber_g_per_serving : null,
          sodium_mg: Number.isFinite(+label?.sodium_mg_per_serving) ? +label.sodium_mg_per_serving : null,
        };
        setPartial?.({
          hint: "Tip: Fill the frame with the full panel (nutrition + ingredients + net weight). Avoid glare & curve.",
          scan_summary: {
            image_url: downloadUrl,
            servings_per_container: Number.isFinite(+label?.servings_per_package) ? +label.servings_per_package : null,
            serving_size_g: serving,
            ingredients_text: Array.isArray(label?.ingredients) ? label.ingredients.join(", ") : "",
            ingredients: Array.isArray(label?.ingredients) ? label.ingredients : [],
            nutrition: perServing,
          },
        });
        setHint?.("Tip: Fill the frame with the full panel. Avoid glare & curve.");

        // map to analyzed
        let analyzed = mapLabelToAnalyzed(label || {});

        await pushFinalPayload({
          analyzed,
          pic,
          downloadUrl,
          userId,
          profile,
        });

        onScanResult?.(analyzed);
      } catch (e) {
        log("[ERR] flow:", e?.message || String(e));
        Alert.alert("Food label flow failed", e?.message || String(e));
      } finally {
        setLoading(false);
        if (_startedGlobal) endScan();
        log("[LABEL] scan finished]");
      }
    },
  }));

  const pushFinalPayload = async ({ analyzed, pic, downloadUrl, userId, profile }) => {
    // sanitize
    const clean = (v) => (v === "string" ? "" : v);
    analyzed.title = clean(toStr(analyzed.title, ""));
    analyzed.brand = clean(toStr(analyzed.brand, ""));
    analyzed.size = clean(toStr(analyzed.size, ""));
    analyzed.category = clean(toStr(analyzed.category, "unknown"));

    // context
    setResult(analyzed);
    setRaw(JSON.stringify(analyzed));

    const titleSafe = toStr(analyzed?.title, "Scanned product");
    const perServingKcal = toNum(analyzed?.calories_kcal_per_serving, null);
    const totalKcal = toNum(analyzed?.calories_kcal_total, null);
    const kcalSafe = Number.isFinite(totalKcal)
      ? totalKcal
      : (Number.isFinite(perServingKcal) && Number.isFinite(+analyzed?.servings_per_package))
        ? Math.round(perServingKcal * +analyzed.servings_per_package)
        : null;

    const protein = toNum(analyzed?.protein_g, null);
    const fat = toNum(analyzed?.fat_g, null);
    const sugar = toNum(analyzed?.sugar_g, null);
    const carbs = toNum(analyzed?.carbs_g, null);
    const fiber = toNum(analyzed?.fiber_g, null);
    const sodium = toNum(analyzed?.sodium_mg, null);

    setTitle(titleSafe);
    setCalories(kcalSafe);
    setProtein(protein);
    setFat(fat);
    setSugar(sugar);
    setCarbs(carbs);
    setFiber(fiber);
    setSodium(sodium);
    setHealthScore(0);

    // Ingredient breakdown from label text
    const ingredientNames = (analyzed?.ingredients_text || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let ingredientsFull = ingredientNames.map((name, i) => ({
      index: i + 1,
      name,
      estimated_grams: null,
      kcal_per_100g: null,
      estimated_kcal: null,
      assumed: true,
    }));

    const reconciled = reconcileIngredientsToTotal(
      ingredientsFull,
      Number.isFinite(kcalSafe) ? kcalSafe : (Number.isFinite(perServingKcal) ? perServingKcal : 0)
    );

    // UI cards
    const ingredientCards = reconciled.map((ing) => ({
      label: ing.name,
      amt: Number.isFinite(ing.estimated_kcal) ? `+${ing.estimated_kcal} cal` : "+0 cal",
      icon: "Utensils",
      IconCOlor: "#1E67FF",
      iconColorBg: "#EEF3FF",
      color: "#FFFFFF",
    }));
    setIngredientsBreakdown?.(ingredientCards);
    setList?.(ingredientCards);
    onScanList?.(ingredientCards);

    // Alternatives (LLM)
    let detailed = await fetchAlternativesDetailed({
      title: analyzed.title,
      brand: analyzed.brand,
      kcal: kcalSafe,
      apiKey: EFFECTIVE_OPENAI_KEY,
      log: mkLogger(null),
    });
    let rawAlts = Array.isArray(detailed?.alternatives) ? detailed.alternatives : [];
    const sameBrand = [];
    const otherBrands = [];
    for (const a of rawAlts) {
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
      if (analyzed.brand && norm(brand) === norm(analyzed.brand)) sameBrand.push(normalized);
      else otherBrands.push(normalized);
    }
    const ALL_ALTS = [...sameBrand, ...otherBrands];
    const lessAlts = ALL_ALTS.filter((a) => a.bucket === "lower").slice(0, 5);
    const simAlts  = ALL_ALTS.filter((a) => a.bucket === "similar").slice(0, 2);
    const moreAlts = ALL_ALTS.filter((a) => a.bucket === "higher").slice(0, 5);
    const toCard = (p) => ({
      label: [p.brand, p.name, p.flavor_or_variant].filter(Boolean).join(" "),
      amt: Number.isFinite(p.calories_per_package_kcal) ? `${p.calories_per_package_kcal}cal` : "—",
      moreOrLess: p.bucket === "lower" ? "less" : p.bucket === "higher" ? "more" : "similar",
    });
    const alternatives_flat = [...lessAlts, ...simAlts, ...moreAlts].map(toCard);
    setAlternatives?.(alternatives_flat);

    // Health proms (profile-aware, same style as barcode)
    const proms = buildHealthPrompts({
      macros: {
        sodium_mg: sodium,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: fiber,
        sugar_g: sugar,
        protein_g: protein,
      },
      profile,
      product: {
        title: titleSafe,
        ingredients_text: analyzed?.ingredients_text || "",
        items: analyzed?.items || [],
      },
    });
    setProms?.(proms);

    // product card icon (optional)
    try {
      const icon = await pickIconForProduct({
        category: analyzed?.category,
        title: analyzed?.title,
        apiKey: EFFECTIVE_OPENAI_KEY,
        log: mkLogger(null),
      });
      if (Array.isArray(analyzed?.items) && analyzed.items.length) {
        analyzed.items[0].icon = safeIconName(icon);
      }
    } catch {}

    // Payload
    const payload = {
      barcode: "",
      title: titleSafe,
      brand: toStr(analyzed?.brand, "") || null,
      category: toStr(analyzed?.category, "") || null,

      calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
      calories_kcal_per_serving: Number.isFinite(perServingKcal) ? perServingKcal : null,

      protein_g: Number.isFinite(protein) ? protein : null,
      fat_g: Number.isFinite(fat) ? fat : null,
      sugar_g: Number.isFinite(sugar) ? sugar : null,
      carbs_g: Number.isFinite(carbs) ? carbs : null,
      fiber_g: Number.isFinite(fiber) ? fiber : null,
      sodium_mg: Number.isFinite(sodium) ? sodium : null,

      servings_per_package: Number.isFinite(+analyzed?.servings_per_package) ? +analyzed.servings_per_package : null,
      serving_size_g: Number.isFinite(+analyzed?.serving_size_g) ? +analyzed.serving_size_g : null,
      health_score: 0,

      items: Array.isArray(analyzed?.items) ? analyzed.items : [],
      ingredients_full: reconciled,
      ingredients_kcal_list: reconciled.map((r) => ({ name: r.name, kcal: Number(r.estimated_kcal) || 0 })),
      ingredients_kcal_map: Object.fromEntries(reconciled.map((r) => [norm(r.name), Number(r.estimated_kcal) || 0])),

      alternatives: {
        base_brand: toStr(analyzed?.brand, "") || null,
        same_brand: sameBrand,
        other_brands: otherBrands,
        summary_by_bucket: {
          lower: lessAlts.length,
          similar: simAlts.length,
          higher: moreAlts.length,
          total: ALL_ALTS.length,
        },
      },
      alternatives_flat,

      proms,
      profile_used: proms?.profile_used || null,

      image_local_uri: pic?.uri || null,
      image_cloud_url: downloadUrl || null,
      scanned_at_pretty: formatScannedAt?.() || null,
      created_at: serverTimestamp(),

      raw: JSON.stringify(analyzed),
      result: analyzed,
    };

    // Save (RecentlyEaten)
    try {
      const db = getFirestore();
      const reCol = collection(db, "users", userId, "RecentlyEaten");
      const docRef = await addDoc(reCol, payload);
      setCurrentItemId?.(docRef.id);
      setCurrentItem?.({ id: docRef.id, ...payload });
      addLog?.("[LABEL] saved to Firestore (RecentlyEaten)");
    } catch (err) {
      addLog?.(`[ERR] Firestore save RecentlyEaten: ${err?.message || err}`);
    }

    // Save (Today/date/List)
    try {
      const db = getFirestore();
      const dateId = localDateId();
      const todayCol = collection(db, "users", userId, "Today", dateId, "List");
      await addDoc(todayCol, payload);
      addLog?.(`Saved scan to Firestore at Today/${dateId}`);
    } catch (err) {
      addLog?.(`[ERR] Firestore save Today: ${err?.message || err}`);
    }

    // Save (AllTimeLineScan)
    try {
      const db = getFirestore();
      const atlCol = collection(db, "users", userId, "AllTimeLineScan");
      await addDoc(atlCol, payload);
      addLog?.("Saved scan to Firestore (AllTimeLineScan)");
    } catch (err) {
      addLog?.(`[ERR] Firestore save AllTimeLineScan: ${err?.message || err}`);
    }

    addLog?.(`[SCANNED FOOD LABEL] ${analyzed?.brand} ${analyzed?.title}`);
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>
          We need your permission to use the camera
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ---------- overlay geometry ---------- */
  const frameLeft = (width(100) - frameSize.w) / 2;
  const frameTop = height(28);
  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize.h - 4],
  });

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
        {/* Always show camera (matches barcode approach) */}
        <View style={{ height: "100%", width: "100%" }} pointerEvents={inCarousel ? "none" : "auto"}>
          <CameraView
            ref={cameraRef}
            style={{ height: "100%", width: "100%" }}
            facing="back"
            flash="off"
            autofocus="on"
            zoom={zoom}             // <<< small zoom for sharper live preview focus
            ratio="4:3"             // <<< use native sensor aspect for a crisper feed
            useCamera2Api           // <<< Android: better AF/AE pipeline
            onCameraReady={() => {  // keep your log; no other changes
              log("Camera ready");
            }}
          />
        </View>

        {/* Label frame overlay (wider than tall) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Dim around frame */}
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: frameTop, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: frameTop + frameSize.h, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", left: 0, top: frameTop, width: frameLeft, height: frameSize.h, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", right: 0, top: frameTop, width: frameLeft, height: frameSize.h, backgroundColor: "rgba(0,0,0,0.45)" }} />
          {/* Frame */}
          <View style={{ position: "absolute", left: frameLeft, top: frameTop, width: frameSize.w, height: frameSize.h, borderRadius: 14, borderColor: "rgba(255,255,255,0.2)", borderWidth: 1 }} />
          {/* Corners */}
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop - 2, width: 40, height: 6, backgroundColor: "#fff", borderTopLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop - 2, width: 6, height: 40, backgroundColor: "#fff", borderTopLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize.w - 38, top: frameTop - 2, width: 40, height: 6, backgroundColor: "#fff", borderTopRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize.w - 4, top: frameTop - 2, width: 6, height: 40, backgroundColor: "#fff", borderTopRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop + frameSize.h - 4, width: 40, height: 6, backgroundColor: "#fff", borderBottomLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop + frameSize.h - 38, width: 6, height: 40, backgroundColor: "#fff", borderBottomLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize.w - 38, top: frameTop + frameSize.h - 4, width: 40, height: 6, backgroundColor: "#fff", borderBottomRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize.w - 4, top: frameTop + frameSize.h - 38, width: 6, height: 40, backgroundColor: "#fff", borderBottomRightRadius: 4 }} />
          {/* Optional scan line */}
          {/* <Animated.View
            style={{
              position: "absolute",
              left: frameLeft + 10,
              width: frameSize.w - 20,
              top: frameTop,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#FF3B30",
              transform: [{ translateY: scanTranslateY }],
            }}
          /> */}
        </View>

        {(loading || scanBusy) && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12, fontWeight: "700" }}>
              Uploading & analyzing…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#111",
    borderRadius: 12,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});
