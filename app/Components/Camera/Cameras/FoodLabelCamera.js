// ./Cameras/FoodLabel_Camera.js
import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, width } from "react-native-responsive-sizes";
import PageAfterScan_FoodLabel from "../PageAfterScan/PageAfterScan_Scan_FoodLabel/PageAfterScan_FoodLabel";

// ✅ Firebase
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
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
const toStr = (s, d = "") => (typeof s === "string" && s.trim().length ? s.trim() : d);

/* LLM-based icon picker (no hard-coded regex rules) */
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
`You are helping a nutrition app choose a single UI icon for a scanned product.
Pick exactly ONE icon name from this allowed set (case-sensitive):
${JSON.stringify(allowed)}
Choose the icon that best matches the food or drink described. If unsure, use "Utensils".
Return JSON ONLY like: { "icon": "Apple" }`,
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
  } catch (e) {
    log("[ICON] error:", e?.message || String(e));
    return "Utensils";
  }
}

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

/* ---------------- Firebase upload ---------------- */
const uploadImageToStorage = async ({ fileUri, uid = "anon" }) => {
  const path = `labels/${uid}/${Date.now()}.jpg`;
  const ref = storage().ref(path);
  await ref.putFile(fileUri, { contentType: "image/jpeg" });
  return await ref.getDownloadURL();
};

/* ---------------- title normalizer ---------------- */
function prettyProductTitle(rawTitle, category) {
  const t = toStr(rawTitle, "");
  const low = t.toLowerCase();
  if (/(milk|milch|lait)/i.test(low) || /dairy|milk/i.test(toStr(category, ""))) return "Milk";
  const NOISE = /(uht|ultra[-\s]?heat(?:ed)?|h[-\s]?milch|vollmilch|whole|semi[-\s]?skimmed|skimmed|1\.?5%|3\.?5%)/gi;
  return t.replace(NOISE, "").trim() || t || "Milk";
}

/* ---------- English normalizer for label JSON ---------- */
async function ensureEnglishFields(label, apiKey, log = console.log) {
  if (!label || typeof label !== "object") return label;
  const raw = JSON.stringify(label);
  const looksNonEnglish =
    /[^\x00-\x7F]/.test(raw) ||
    /(fideos|instant[aá]neos|grasas|energ[ií]a|az[uú]cares|sodio|sal|prote[ií]nas|hidratos|carbohidratos|fibra|fibre|kohlenhydrate|zucker|eiwei[sß]|fett|energie|salz|eiweiß)/i.test(raw);
  if (!looksNonEnglish) return label;

  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`You will receive a JSON that represents a parsed food label.
Re-output the SAME JSON shape but with all free-text values in English (en).
Keep "brand" as printed (do not translate brands). Translate "title" and "ingredients".
Do NOT add or remove fields. JSON ONLY.`,
      },
      { role: "user", content: JSON.stringify(label) },
    ],
  };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[LABEL-EN] status:", r.status);
    if (!r.ok) return label;
    const j = await r.json();
    const eng = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    return eng && typeof eng === "object" ? eng : label;
  } catch (e) {
    log("[LABEL-EN] error:", e?.message || String(e));
    return label;
  }
}

/* ---------- STEP 1: Parse the FOOD LABEL via OpenAI (image → JSON) ---------- */
async function readFoodLabelFromImage({ imageUrl, apiKey, log = console.log }) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`You read packaged food LABELS from an image (any country, any language).
Output must be in English (en) except "brand".
Map synonyms: energy/kcal/kJ, fat, saturated fat, carbs/carbohydrate, sugars, fiber, protein, sodium/salt/natrium, calcium, serving size, servings per container.
If values exist only per 100 g/ml and a serving size is visible, compute per serving.
If only per 100 g/ml and net weight is visible, compute total for package.
If energy is in kJ, convert to kcal (1 kcal = 4.184 kJ).
If SALT is listed instead of sodium, convert to sodium_mg = round(salt_g * 393).
If serving size uses fl oz or oz, convert to ml (29.5735 ml/fl oz) or g (28.3495 g/oz).
If a number is not visible, set null (don’t guess).

Also infer a product name and broad category if visible.
Return JSON ONLY:
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
          { type: "text", text: "Read the nutrition facts on this food label and return JSON only." },
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

/* ---------- (International) nutrition-table helper ---------- */
async function readNutritionTable({ imageUrl, apiKey, log = console.log }) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`Extract a NUTRITION FACTS table from a food label image (any country/language).
Normalize to per_100 and per_serving blocks. Use these rules:
- Convert kJ→kcal (1 kcal = 4.184 kJ).
- If SALT is provided, convert to sodium_mg = round(salt_g * 393).
- If serving size uses fl oz or oz, convert to ml or g (29.5735 ml/fl oz, 28.3495 g/oz).
- If a number is not visible, set null (do NOT guess).
Return JSON ONLY:
{
  "serving_size": {"value": number|null, "unit": "g|ml|null"},
  "servings_per_package": number|null,
  "per_100": {
    "energy_kcal": number|null, "protein_g": number|null, "fat_g": number|null, "sat_fat_g": number|null,
    "carbs_g": number|null, "sugars_g": number|null, "fiber_g": number|null, "sodium_mg": number|null, "calcium_mg": number|null
  },
  "per_serving": {
    "energy_kcal": number|null, "protein_g": number|null, "fat_g": number|null, "sat_fat_g": number|null,
    "carbs_g": number|null, "sugars_g": number|null, "fiber_g": number|null, "sodium_mg": number|null, "calcium_mg": number|null
  }
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

/* ---------- OFF fallback when numbers missing ---------- */
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
    if (!products.length) return null;

    let best = products[0];
    if (category) {
      for (const p of products) {
        if (String(p?.categories || "").toLowerCase().includes(String(category).toLowerCase())) {
          best = p; break;
        }
      }
    }
    return best || null;
  } catch (e) {
    log("[OFF] error:", e?.message || String(e));
    return null;
  }
}
function mergeOFFIntoLabel(label, off, log = console.log) {
  if (!off) return label;

  const nutr = off?.nutriments || {};
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

  const out = { ...label };
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

  if (!off) return label;
  const merged = mergeOFFIntoLabel(label, off, log);
  log("[OFF] merged into label");
  return merged;
}

/* ---------- Alternatives (LLM) ---------- */
async function fetchAlternativesLLM({ title, category, baseKcal, apiKey, log = console.log }) {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`You are a nutrition coach. Given a scanned food and its category, return up to 8 lower-calorie alternatives.
Prefer lighter variants first, then close substitutes. Names must be generic (no brands).
Return ONLY JSON:
{ "alternatives":[ { "name":"Skimmed milk", "calories_diff": -60 }, ... ] }`
      },
      {
        role: "user",
        content: `Item: ${toStr(title, "(unknown)")}
Category: ${toStr(category, "")}
Base calories/serving: ${Number.isFinite(+baseKcal) ? +baseKcal : "unknown"}
JSON only.`,
      },
    ],
  };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[ALTS] status:", r.status);
    if (!r.ok) return [];
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    const arr = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
    return arr
      .map(a => ({
        name: toStr(a?.name, "").trim(),
        calories_diff: Number.isFinite(+a?.calories_diff) ? Math.round(+a.calories_diff) : null,
      }))
      .filter(a => a.name && a.calories_diff !== null)
      .slice(0, 8);
  } catch (e) {
    log("[ALTS] error:", e?.message || String(e));
    return [];
  }
}

/* ---------- calorie calculator ---------- */
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

/* ---------- map label → analyzed ---------- */
function mapLabelToAnalyzed(label) {
  const brand = toStr(label?.brand, "");
  const category = toStr(label?.category, "") || toStr(label?.inferred_category, "") || "unknown";

  const rawTitle = toStr(label?.title, "") || toStr(label?.inferred_title, "");
  const title = prettyProductTitle(rawTitle, category);

  const servings = Number.isFinite(+label?.servings_per_package) ? +label.servings_per_package : null;
  const sz = Number.isFinite(+label?.serving_size_g) ? +label.serving_size_g : null;

  const { perServing, perPackage } = computeCalories(label);

  const protein = Number.isFinite(+label?.protein_g_per_serving) ? +label.protein_g_per_serving : null;
  const fat = Number.isFinite(+label?.fat_g_per_serving) ? +label.fat_g_per_serving : null;
  const sat_fat = Number.isFinite(+label?.sat_fat_g_per_serving) ? +label.sat_fat_g_per_serving : null;
  const carbs = Number.isFinite(+label?.carbs_g_per_serving) ? +label.carbs_g_per_serving : null;
  const sugar = Number.isFinite(+label?.sugars_g_per_serving) ? +label.sugars_g_per_serving : null;
  const fiber = Number.isFinite(+label?.fiber_g_per_serving) ? +label.fiber_g_per_serving : null;
  const sodium = Number.isFinite(+label?.sodium_mg_per_serving) ? +label.sodium_mg_per_serving : null;
  const calcium = Number.isFinite(+label?.calcium_mg_per_serving) ? +label.calcium_mg_per_serving : null;

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

    protein_g: Number.isFinite(protein) ? protein : null,
    fat_g: Number.isFinite(fat) ? fat : null,
    sat_fat_g: Number.isFinite(sat_fat) ? sat_fat : null,
    sugar_g: Number.isFinite(sugar) ? sugar : null,
    carbs_g: Number.isFinite(carbs) ? carbs : null,
    fiber_g: Number.isFinite(fiber) ? fiber : null,
    sodium_mg: Number.isFinite(sodium) ? sodium : null,
    calcium_mg: Number.isFinite(calcium) ? calcium : null,

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

/* ---------- NEW: product-only breakdown (no macros here) ---------- */
async function buildProductOnlyBreakdown(analyzed, apiKey, log = console.log) {
  const sizeStr = toStr(analyzed?.size, "");
  const title = toStr(analyzed?.title, "Product");

  const icon = await pickIconForProduct({
    category: analyzed?.category,
    title,
    apiKey,
    log,
  });

  const kcalTotal = Number.isFinite(+analyzed?.calories_kcal_total)
    ? +analyzed.calories_kcal_total
    : null;

  const kcalPerServing = Number.isFinite(+analyzed?.calories_kcal_per_serving)
    ? +analyzed.calories_kcal_per_serving
    : null;

  const kcal = kcalTotal ?? kcalPerServing ?? 0;
  const name = sizeStr ? `${title} • ${sizeStr}` : title;

  return [
    { name, calories_kcal: kcal, icon: safeIconName(icon) }
  ];
}

/* ---------- partial payload for the UI ---------- */
function buildPartialFromLabel({ label, imageUrl }) {
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
  return {
    scan_summary: {
      image_url: imageUrl || null,
      servings_per_container: Number.isFinite(+label?.servings_per_package) ? +label.servings_per_package : null,
      serving_size_g: serving,
      ingredients_text: Array.isArray(label?.ingredients) ? label.ingredients.join(", ") : "",
      ingredients: Array.isArray(label?.ingredients) ? label.ingredients : [],
      nutrition_label: perServing,
      nutrition: perServing,
    },
  };
}

/* ---------------- Camera overlay ---------------- */
function LabelFrameOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.maskTop} />
      <View style={styles.middleRow}>
        <View style={styles.maskSide} />
        <View style={styles.frameBox}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <Text style={styles.frameText}>Align FOOD LABEL inside the frame</Text>
        </View>
        <View style={styles.maskSide} />
      </View>
      <View style={styles.maskBottom} />
    </View>
  );
}

/* ---------------- component ---------------- */
export default forwardRef(function FoodLabelCamera(
  { inCarousel = false, isActive = false, onScanResult, onScanList, openAiApiKey },
  ref
) {
  const userId = getAuth().currentUser?.uid;
  const { register, present, isS2Open, isS3Open } = useSheets();

  const OPENAI_API_KEY_FALLBACK =
    "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";
  const EFFECTIVE_OPENAI_KEY = openAiApiKey || OPENAI_API_KEY_FALLBACK;


  const {
    setImageUrl, setCloudUrl, setResult, setRaw, addLog, resetScan,
    setTitle, setCalories, setProtein, setFat, setSugar, setCarbs,
    setFiber, setSodium, setHealthScore, setAlternatives, setList,
    markScannedNow, formatScannedAt, setIngredientsBreakdown, setPartial,
   scanBusy, beginScan, endScan,
  } = useScanResults();

  // register Food Label page
  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan_FoodLabel {...props} />);
  }, [register]);

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const log = mkLogger(addLog);

  useImperativeHandle(ref, () => ({
    scan: async () => {
      try {
        if (!isS2Open || !isActive || !cameraRef.current) {
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
        beginScan();               // 🔴 global: show loader on next page
        resetScan();
       // setLocalLoading(true);
        setLoading(true);
        log("[LABEL] scan started");

        await new Promise((r) => setTimeout(r, 900));

        const pic = await cameraRef.current.takePictureAsync({
          quality: 1,
          skipProcessing: false,
        });
        if (!pic?.uri) {
          log("[ERR] No photo captured");
          Alert.alert("Scan failed", "No photo captured.");
          return;
        }

        // open result sheet early
        setImageUrl(pic.uri);
        markScannedNow();
        present?.("s3");
        log("[LABEL] S3 opened", formatScannedAt?.() || "now");

        // upload to Firebase
        log("[LABEL] uploading …");
        const downloadUrl = await uploadImageToStorage({
          fileUri: pic.uri,
          uid: userId || "anon",
        });
        setCloudUrl(downloadUrl);
        log("[LABEL] upload done:", downloadUrl);

        // ---------- Parse the label ----------
        let label = await readFoodLabelFromImage({
          imageUrl: downloadUrl,
          apiKey: EFFECTIVE_OPENAI_KEY,
          log,
        });

        // generic nutrition table extractor and merge
        const tbl = await readNutritionTable({ imageUrl: downloadUrl, apiKey: EFFECTIVE_OPENAI_KEY, log });
        if (tbl) {
          label = mergeNutritionTableIntoLabel(label, tbl);
          log("[TABLE] merged into label");
        }

        // ensure English output (brand unchanged)
        label = await ensureEnglishFields(label, EFFECTIVE_OPENAI_KEY, log);

        // OFF fallback if numbers still missing
        label = await fillFromOFFIfMissing(label, log);

        // partial for UI
        const partialPayload = buildPartialFromLabel({ label, imageUrl: downloadUrl });
        setPartial?.(partialPayload);
        log("[PARTIAL] set for UI:", partialPayload);

        // Map to context fields
        let analyzed = mapLabelToAnalyzed(label || {});
        await pushFinalPayload({ analyzed, pic, downloadUrl, userId });
      } catch (e) {
        log("[ERR] flow:", e?.message || String(e));
        Alert.alert("Food label flow failed", e?.message || String(e));

      } finally {
         endScan();                 // 🟢 tell S3 loader to finish
        setLoading(false);
        log("[LABEL] scan finished");
      }
    },
  }));

  const pushFinalPayload = async ({ analyzed, pic, downloadUrl, userId }) => {
    // normalize strings
    const clean = (v) => (v === "string" ? "" : v);
    analyzed.title = prettyProductTitle(clean(toStr(analyzed.title, "")), analyzed.category);
    analyzed.brand = clean(toStr(analyzed.brand, ""));
    analyzed.size = clean(toStr(analyzed.size, ""));
    analyzed.category = clean(toStr(analyzed.category, "unknown"));

    setResult(analyzed);
    setRaw(JSON.stringify(analyzed));

    const titleSafe = toStr(analyzed?.title, "Scanned product");

    // per-serving & total
    const perServingKcal = Number.isFinite(+analyzed?.calories_kcal_per_serving)
      ? +analyzed.calories_kcal_per_serving
      : null;

    const totalKcal =
      Number.isFinite(+analyzed?.calories_kcal_total)
        ? +analyzed.calories_kcal_total
        : (Number.isFinite(perServingKcal) && Number.isFinite(+analyzed?.servings_per_package))
          ? Math.round(perServingKcal * +analyzed.servings_per_package)
          : null;

    setTitle(titleSafe);
    setCalories(totalKcal);

    setProtein(Number.isFinite(+analyzed?.protein_g) ? +analyzed.protein_g : null);
    setFat(Number.isFinite(+analyzed?.fat_g) ? +analyzed.fat_g : null);
    setSugar(Number.isFinite(+analyzed?.sugar_g) ? +analyzed.sugar_g : null);
    setCarbs(Number.isFinite(+analyzed?.carbs_g) ? +analyzed.carbs_g : null);
    setFiber(Number.isFinite(+analyzed?.fiber_g) ? +analyzed.fiber_g : null);
    setSodium(Number.isFinite(+analyzed?.sodium_mg) ? +analyzed.sodium_mg : null);
    setHealthScore(0);

    // 🔥 Product-only breakdown (no macros here) — uses LLM icon picker
    const productRows = await buildProductOnlyBreakdown(analyzed, EFFECTIVE_OPENAI_KEY, mkLogger(null));
    setIngredientsBreakdown?.(productRows);
    mkLogger(null)(`[BREAKDOWN] productRows=${productRows?.length ?? 0}`);

    // ---- Lower-calorie alternatives (optional; safe guard)
    let alts = [];
    try {
      const basePerServing =
        Number.isFinite(+analyzed?.calories_kcal_per_serving)
          ? +analyzed.calories_kcal_per_serving
          : (Number.isFinite(+analyzed?.calories_kcal_total) && Number.isFinite(+analyzed?.servings_per_package) && +analyzed.servings_per_package > 0)
            ? Math.round(+analyzed.calories_kcal_total / +analyzed.servings_per_package)
            : null;

      if (typeof fetchAlternativesLLM === "function") {
        alts = await fetchAlternativesLLM({
          title: analyzed.title,
          category: analyzed.category,
          baseKcal: basePerServing,
          apiKey: EFFECTIVE_OPENAI_KEY,
          log: mkLogger(null),
        });
      }
    } catch (e) {
      mkLogger(null)("[ALTS] skipped:", e?.message || String(e));
    }
    setAlternatives?.(alts);

    // items/card list
    const items = Array.isArray(analyzed?.items) ? analyzed.items : [];
    const itemsSafe = items.map((it) => ({
      name: toStr(it?.name, "Item"),
      subtitle: toStr(it?.subtitle, ""),
      calories_kcal: toNum(it?.calories_kcal, 0),
      icon: safeIconName(it?.icon),
    }));
    if (!itemsSafe.length) {
      itemsSafe.push({
        name: titleSafe || "Unknown product",
        subtitle: analyzed?.size || "",
        calories_kcal: Number.isFinite(perServingKcal) ? perServingKcal : (Number.isFinite(totalKcal) ? totalKcal : 0),
        icon: "Utensils",
      });
    }
    setList?.(itemsSafe);

    // Firestore (non-blocking)
    try {
      const db = getFirestore();
      const colRef = collection(db, "users", userId || "anon", "RecentlyEaten");
      await addDoc(colRef, {
        barcode: toStr(analyzed?.barcode, ""),
        title: titleSafe,
        calories_kcal_total: Number.isFinite(totalKcal) ? totalKcal : null,
        calories_kcal_per_serving: Number.isFinite(perServingKcal) ? perServingKcal : null,
        protein_g: Number.isFinite(+analyzed?.protein_g) ? +analyzed.protein_g : null,
        fat_g: Number.isFinite(+analyzed?.fat_g) ? +analyzed.fat_g : null,
        sugar_g: Number.isFinite(+analyzed?.sugar_g) ? +analyzed.sugar_g : null,
        carbs_g: Number.isFinite(+analyzed?.carbs_g) ? +analyzed.carbs_g : null,
        fiber_g: Number.isFinite(+analyzed?.fiber_g) ? +analyzed.fiber_g : null,
        sodium_mg: Number.isFinite(+analyzed?.sodium_mg) ? +analyzed.sodium_mg : null,
        sat_fat_g: Number.isFinite(+analyzed?.sat_fat_g) ? +analyzed.sat_fat_g : null,
        calcium_mg: Number.isFinite(+analyzed?.calcium_mg) ? +analyzed.calcium_mg : null,
        servings_per_package: Number.isFinite(+analyzed?.servings_per_package) ? +analyzed.servings_per_package : null,
        serving_size_g: Number.isFinite(+analyzed?.serving_size_g) ? +analyzed.serving_size_g : null,
        health_score: 0,
        items: itemsSafe,
        alternatives: alts,
        image_local_uri: pic?.uri || null,
        image_cloud_url: downloadUrl || null,
        scanned_at_pretty: formatScannedAt?.() || null,
        created_at: serverTimestamp(),
        raw: JSON.stringify(analyzed),
        result: analyzed,
      });
      mkLogger(null)("[LABEL] saved to Firestore");
    } catch (err) {
      mkLogger(null)(`[ERR] Firestore save: ${err?.message || err}`);
    }

    console.log("[SCANNED FOOD LABEL]", analyzed?.brand, analyzed?.title);
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>
          We need your permission to use the camera
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
        {isS2Open && isActive && !isS3Open ? (
          <View style={{ height: "100%", width: "100%" }}>
            <CameraView
              ref={cameraRef}
              style={{ height: "100%", width: "100%" }}
              facing="back"
              flash="off"
              autofocus="on"
              onCameraReady={() => mkLogger(null)("Camera ready")}
            />
            {/* 🔲 Food Label frame overlay */}
            <LabelFrameOverlay />
          </View>
        ) : null}

        {loading && (
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

const FRAME_RATIO = 0.7;
const FRAME_HEIGHT_RATIO = 0.45;

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
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // --- frame mask ---
  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    height: height(100) * FRAME_HEIGHT_RATIO,
  },
  maskTop: {
    height: height(100) * ((1 - FRAME_HEIGHT_RATIO) / 2),
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  maskBottom: {
    height: height(100) * ((1 - FRAME_HEIGHT_RATIO) / 2),
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  maskSide: {
    width: width(100) * ((1 - FRAME_RATIO) / 2),
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  frameBox: {
    width: width(100) * FRAME_RATIO,
    height: "100%",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  frameText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#fff",
  },
  cTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderRadius: 10 },
  cTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderRadius: 10 },
  cBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderRadius: 10 },
  cBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderRadius: 10 },
});
