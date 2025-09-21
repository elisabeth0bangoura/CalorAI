// ./Cameras/Scan_Barcode_Camera.js
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
import PageAfterScan from "../PageAfterScan/PageAfterScan_Scan_Barcode/PageAfterScan_Scan_Barcode";

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
const toNum = (n, d = 0) => (Number.isFinite(+n) ? +n : d);
const toStr = (s, d = "") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;
const norm = (s) => String(s || "").trim().toLowerCase();

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const asEAN13 = (raw) => {
  let d = onlyDigits(raw);
  if (d.length === 12) d = "0" + d;
  return d;
};
const isValidEAN13 = (code) => {
  const d = onlyDigits(code);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = d.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? n : n * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === (d.charCodeAt(12) - 48);
};

const KJ_TO_KCAL = 1 / 4.184;
const pickKcal = (nutr) => {
  if (!nutr) return 0;
  const kcalServ = nutr["energy-kcal_serving"];
  if (Number.isFinite(+kcalServ)) return Math.round(+kcalServ);
  const kcal100 = nutr["energy-kcal_100g"];
  if (Number.isFinite(+kcal100)) return Math.round(+kcal100);
  const kjServ = nutr["energy_serving"];
  if (Number.isFinite(+kjServ)) return Math.round(+kjServ * KJ_TO_KCAL);
  const kj100 = nutr["energy_100g"];
  if (Number.isFinite(+kj100)) return Math.round(+kj100 * KJ_TO_KCAL);
  return 0;
};
const firstNum = (...vals) => {
  for (const v of vals) if (Number.isFinite(+v)) return +v;
  return 0;
};

/* ---------------- ingredient + alt helpers ---------------- */
const deriveBucket = (candKcal, baseKcal) => {
  if (!Number.isFinite(+candKcal) || !Number.isFinite(+baseKcal)) return "similar";
  const diff = +candKcal - +baseKcal;
  if (diff < -25) return "lower";
  if (diff > 25) return "higher";
  return "similar";
};
const normalizeBucket = (b) => {
  const x = norm(b);
  return x === "lower" || x === "higher" || x === "similar" ? x : "similar";
};
const splitBrandFromDisplay = (display = "", baseBrand = "") => {
  const d = String(display || "").trim();
  const bb = String(baseBrand || "").trim();
  if (d && bb && norm(d).startsWith(norm(bb) + " ")) {
    return { brand: bb, rest: d.slice(bb.length).trim() };
  }
  return { brand: null, rest: d };
};

/* ---------------- dual logger ---------------- */
const mkLogger = (addLog) => (...args) => {
  const line = args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
  console.log(line);
  addLog?.(line);
};

/* ---------------- Firebase upload ---------------- */
const uploadImageToStorage = async ({ fileUri, uid = "anon" }) => {
  const path = `barcodes/${uid}/${Date.now()}.jpg`;
  const ref = storage().ref(path);
  await ref.putFile(fileUri, { contentType: "image/jpeg" });
  return await ref.getDownloadURL();
};

/* ---------- STEP 1: OCR digits from photo (OpenAI) ---------- */
async function readDigitsFromImage({ imageUrl, apiKey, log = console.log }) {
  const prompts = [
    `You are a barcode OCR. Read ONLY the numeric digits printed directly under the black bars.
If the image is upside down, mentally rotate it. Return JSON ONLY:
{ "candidates":[{"digits":"string","confidence":0.95},{"digits":"string","confidence":0.8}] }`,
    `Extract the longest contiguous numeric sequence directly beneath the bars. JSON ONLY:
{ "candidates":[{"digits":"string","confidence":0.9}] }`,
    `Verify EAN-13 check digit if 13 digits. Return up to 3 candidates, highest confidence first. JSON ONLY:
{ "candidates":[{"digits":"string","confidence":0.9},{"digits":"string","confidence":0.7},{"digits":"string","confidence":0.6}] }`,
  ];

  const mkBody = (sys) => ({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.0,
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: [
          { type: "text", text: "Read digits under the bars. JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  for (const p of prompts) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mkBody(p)),
    });
    log("[OCR] status:", r.status);
    if (!r.ok) continue;
    let parsed = {};
    try {
      parsed = JSON.parse((await r.json())?.choices?.[0]?.message?.content || "{}");
    } catch {
      continue;
    }
    log("[OCR] parsed:", parsed);

    const cands = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    for (const c of cands) {
      const ean = asEAN13(onlyDigits(c?.digits));
      if (isValidEAN13(ean)) return ean;
    }
    if (cands[0]?.digits) {
      const best = asEAN13(onlyDigits(cands[0].digits));
      if (isValidEAN13(best)) return best;
    }
  }
  return null;
}

/* ---------- STEP 2: Product from Open Food Facts (+ ingredients fields) ---------- */
async function fetchOFFProduct(barcode, log = console.log) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
  log("[OFF] product url:", url);
  const r = await fetch(url);
  log("[OFF] status:", r.status);
  if (!r.ok) return null;
  const j = await r.json();
  const p = j?.product;
  if (!p) return null;

  const nutr = p.nutriments || {};
  const kcal = pickKcal(nutr);

  const categoriesTags = Array.isArray(p.categories_tags) ? p.categories_tags : [];
  const categoryTagRaw =
    categoriesTags.length ? categoriesTags[categoriesTags.length - 1] : null;
  const categoryLabel = categoryTagRaw
    ? String(categoryTagRaw).replace(/^en:/, "")
    : toStr(p.categories, "unknown");

  const mapped = {
    barcode: String(barcode),
    title: toStr(p.product_name, ""),
    brand: toStr(p.brands || p.brand_owner, ""),
    size: toStr(p.quantity || p.serving_size, ""),
    category: categoryLabel,
    category_tag: categoryTagRaw,
    countries_tags: Array.isArray(p.countries_tags) ? p.countries_tags : [],

    calories_kcal_total: kcal,
    protein_g: firstNum(nutr.proteins_serving, nutr.proteins_100g),
    fat_g: firstNum(nutr.fat_serving, nutr.fat_100g),
    sugar_g: firstNum(nutr.sugars_serving, nutr.sugars_100g),
    carbs_g: firstNum(nutr.carbohydrates_serving, nutr.carbohydrates_100g),
    fiber_g: firstNum(nutr.fiber_serving, nutr.fiber_100g),
    sodium_mg: Math.round(firstNum(nutr.sodium_serving, nutr.sodium_100g) * 1000),

    ingredients_text: toStr(
      p.ingredients_text_en ||
        p.ingredients_text_de ||
        p.ingredients_text_fr ||
        p.ingredients_text,
      ""
    ),
    ingredients_list: Array.isArray(p.ingredients)
      ? p.ingredients.map((ing) => ({
          text: toStr(ing?.text || ing?.id, ""),
          percent_estimate: Number.isFinite(+ing?.percent_estimate)
            ? +ing.percent_estimate
            : null,
          percent: Number.isFinite(+ing?.percent) ? +ing.percent : null,
          percent_min: Number.isFinite(+ing?.percent_min) ? +ing.percent_min : null,
          percent_max: Number.isFinite(+ing?.percent_max) ? +ing.percent_max : null,
        }))
      : [],

    health_score: 0,
    items: [
      {
        name: toStr(p.product_name, "Item"),
        subtitle: toStr(p.serving_size || p.quantity || "", ""),
        calories_kcal: kcal,
        icon: "Utensils",
      },
    ],
    alternatives: [],
  };
  log("[OFF] mapped:", mapped);
  return mapped;
}

/* ---------- STEP 2b: Popular alternatives ---------- */
async function fetchOFFAlternatives(
  { barcode, category, categoryTag, countriesTags, baseKcal },
  log = console.log
) {
  const MIN_UNIQUE_SCANS = 50;
  const PAGE_SIZE = 100;

  const params = new URLSearchParams({
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(PAGE_SIZE),
    sort_by: "unique_scans_n",
    fields:
      "product_name,brands,code,unique_scans_n,nutriments,countries_tags,categories_tags",
  });

  params.append("tagtype_0", "categories");
  params.append("tag_contains_0", "contains");
  params.append("tag_0", categoryTag || category || "");

  if (Array.isArray(countriesTags) && countriesTags.length) {
    params.append("tagtype_1", "countries");
    params.append("tag_contains_1", "contains");
    params.append("tag_1", countriesTags[0]);
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
  log("[OFF] alts url:", url);
  const r = await fetch(url);
  log("[OFF] alts status:", r.status);
  if (!r.ok) return [];

  const j = await r.json();
  const products = Array.isArray(j?.products) ? j.products : [];

  let filtered = products.filter((p) => {
    if (!p || String(p.code) === String(barcode)) return false;
    const scans = Number(p.unique_scans_n || 0);
    const hasName = toStr(p.product_name, "") || toStr(p.brands, "");
    return scans >= MIN_UNIQUE_SCANS && !!hasName;
  });

  if (filtered.length < 4) {
    filtered = products
      .filter((p) => p && String(p.code) !== String(barcode))
      .sort((a, b) => (b.unique_scans_n || 0) - (a.unique_scans_n || 0))
      .slice(0, 20);
  }

  const base = baseKcal || 0;
  const seen = new Set();
  const alts = [];

  for (const p of filtered) {
    const kcal = pickKcal(p.nutriments || {});
    const brand = toStr(p.brands, "").split(",")[0] || "";
    const name = `${brand} ${toStr(p.product_name, "")}`.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    alts.push({
      name,
      calories_diff: Math.round(kcal - base),
      _pop: Number(p.unique_scans_n || 0),
    });
  }

  alts.sort((a, b) => {
    if (b._pop !== a._pop) return b._pop - a._pop;
    return Math.abs(a.calories_diff) - Math.abs(b.calories_diff);
  });

  const out = alts.slice(0, 8).map(({ name, calories_diff }) => ({ name, calories_diff }));
  log("[OFF] alts mapped:", out);
  return out;
}

/* ---------- STEP 2c LLM fallback alternatives ---------- */
async function fetchLLMAlternatives({
  brand,
  title,
  category,
  baseKcal,
  countriesTags,
  apiKey,
  log = console.log,
}) {
  const display = [toStr(brand, ""), toStr(title, "")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const market =
    Array.isArray(countriesTags) && countriesTags.length
      ? countriesTags[0].replace(/^en:/, "")
      : "";

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Recommend close substitutes. Prefer same-brand variants, then popular competitors. JSON ONLY:
{ "alternatives":[{"name":"string","calories_diff":-40|null} ...] }`,
      },
      {
        role: "user",
        content: `Product: ${display || "(unknown)"} 
Category: ${toStr(category, "")}
Market hint: ${market}
Base calories: ${Number.isFinite(+baseKcal) ? +baseKcal : "unknown"}
Return ONLY JSON.`,
      },
    ],
  };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    log("[LLM-ALTS] status:", r.status);
    if (!r.ok) return [];
    const j = await r.json();
    let parsed = {};
    try {
      parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    } catch {}
    const arr = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
    const cleaned = arr
      .map((x) => ({
        name: toStr(x?.name, ""),
        calories_diff: Number.isFinite(+x?.calories_diff)
          ? Math.round(+x.calories_diff)
          : null,
      }))
      .filter((x) => x.name);
    log("[LLM-ALTS] parsed:", cleaned);
    return cleaned.slice(0, 8);
  } catch (e) {
    log("[LLM-ALTS] error:", e?.message || String(e));
    return [];
  }
}

/* ---------- STEP 3: Ingredients by Brand+Title (+photo) ---------- */
async function fetchIngredientsByNameBrand({
  brand,
  title,
  category,
  countriesTags,
  imageUrl,
  apiKey,
  log = console.log,
}) {
  const display = [toStr(brand, ""), toStr(title, "")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const market =
    Array.isArray(countriesTags) && countriesTags.length
      ? countriesTags[0].replace(/^en:/, "")
      : "";

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Return a realistic ingredient list for a packaged food using brand + product + category + photo. JSON ONLY:
{ "ingredients": ["string", ...] }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `brand+name: ${display || "(unknown)"}\ncategory: ${toStr(
              category,
              ""
            )}\nmarket hint: ${market}\nReturn only JSON.`,
          },
          ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
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
    log("[LLM-ING] status:", r.status);
    if (!r.ok) return [];
    const j = await r.json();
    let parsed = {};
    try {
      parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
    } catch {}
    const arr = Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
    const cleaned = arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    log("[LLM-ING] parsed:", cleaned);
    return cleaned;
  } catch (e) {
    log("[LLM-ING] error:", e?.message || String(e));
    return [];
  }
}

/* ---------- STEP 4: Build ingredients breakdown ---------- */
function buildIngredientsBreakdownFromList(ingredientsArray, total_kcal) {
  if (!Array.isArray(ingredientsArray) || ingredientsArray.length === 0) return null;
  const seen = new Set();
  const top = [];
  for (const name of ingredientsArray) {
    const key = String(name).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    top.push(String(name).trim());
    if (top.length >= 6) break;
  }
  if (!top.length) return null;

  if (!Number.isFinite(total_kcal)) {
    return top.map((n) => ({ name: n, calories_kcal: 0, icon: "Utensils" }));
  }

  const each = Math.floor(total_kcal / top.length);
  const out = top.map((n) => ({ name: n, calories_kcal: each, icon: "Utensils" }));
  const sum = out.reduce((s, x) => s + x.calories_kcal, 0);
  const diff = total_kcal - sum;
  if (diff && out.length) out[0] = { ...out[0], calories_kcal: out[0].calories_kcal + diff };
  return out;
}

/* ---------------- HEALTH PROFILE + PROMS ---------------- */
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
  ]
    .join(" ")
    .toLowerCase();
  return /(coffee|espresso|latte|cappuccino|americano|mocha|cold\s*brew|energy\s*drink|caffeine|mate|yerba|guarana|cola|tea|matcha)/i.test(
    hay
  );
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
    if (k.proteinLevel && macros.protein_g != null) {
      const pl = String(k.proteinLevel).toLowerCase();
      if (pl.startsWith("low") && macros.protein_g > 25)
        kidney += ` Protein ${macros.protein_g} g may be high for your low-protein target.`;
    }
    parts.kidney = kidney;
    lines.push(kidney);
  }

  if (profile?.heartSettings) {
    const h = profile.heartSettings;
    const cap = satFatCapFor(h.satFatLimit);
    let heart = `Heart: `;
    if (macros.fat_g != null) {
      heart += `fat ${macros.fat_g} g`;
      if (macros.fat_g >= 17) heart += ` — on the higher side; keep other meals lighter today.`;
      else heart += ` — reasonable for most plans.`;
      heart += ` Aim saturated fat ≈${cap} g/day (${h.satFatLimit || "moderate"}).`;
    } else {
      heart += `fat not visible on label.`;
    }
    parts.heart = heart;
    lines.push(heart);
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
    parts.diabetes = diabetes;
    lines.push(diabetes);
  }

  const caffeinated = looksCaffeinated(product || {});
  if (profile?.habits?.reduceCoffee) {
    let coffee = `Coffee: you're cutting back. `;
    coffee += caffeinated
      ? `This looks caffeinated — try decaf or a smaller size today.`
      : `Nice — this seems caffeine-free.`;
    parts.reduceCoffee = coffee;
    lines.push(coffee);
  }
  if (profile?.habits?.stopSmoking) {
    let smoke = `Stop smoking: keep momentum. `;
    smoke += caffeinated
      ? `Coffee can be a trigger; swap with water or take a short walk after.`
      : `Use meals as a cue to breathe deeply instead of lighting up.`;
    parts.stopSmoking = smoke;
    lines.push(smoke);
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
export default forwardRef(function Scan_Barcode_Camera(
  { inCarousel = false, isActive = false, onScanResult, onScanList, openAiApiKey },
  ref
) {
  const userId = getAuth().currentUser?.uid || "anon";
  const { register, present /* isS2Open, isS3Open (kept, not gating) */ } = useSheets();
  const { setCurrentItemId, setCurrentItem } = useCurrentScannedItemId();

  // ⚠️ Dev-only fallback; use secure backend in prod
  const OPENAI_API_KEY_FALLBACK =
    "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";
  const EFFECTIVE_OPENAI_KEY = openAiApiKey || OPENAI_API_KEY_FALLBACK;

  const {
    setImageUrl,
    setCloudUrl,
    setResult,
    setRaw,
    addLog,
    resetScan,
    setTitle,
    setCalories,
    setProtein,
    setFat,
    setSugar,
    setCarbs,
    setFiber,
    setSodium,
    setHealthScore,
    setAlternatives,
    setList,
    markScannedNow,
    formatScannedAt,
    setIngredientsBreakdown,
    scanBusy, beginScan, endScan,
    setProms,
  } = useScanResults();

  function localDateId(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ✅ Register "s3" ONCE (same as your food camera)
  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan {...props} />);
  }, [register]);

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const log = mkLogger(addLog);

  /* ---------- Scanner frame animation (purely visual) ---------- */
  const frameSize = useMemo(() => Math.min(width(70), height(38)), []);
  const scanAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      scanAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
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
          Alert.alert("Camera not ready", "Open the BARCODE tab before scanning.");
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
        log("[BC] scan started");

        // small hold so AF locks
        await new Promise((r) => setTimeout(r, 900));

        const pic = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: true,
        });
        if (!pic?.uri) {
          log("[ERR] No photo captured");
          Alert.alert("Scan failed", "No photo captured.");
          return;
        }

        // 🔥 EXACTLY LIKE FOOD: set image → stamp → open s3 right away
        setImageUrl(pic.uri);
        markScannedNow();
        log(`Stamped scan time: ${formatScannedAt?.() || "now"}`);
        present?.("s3");

        // Upload
        log("[BC] uploading to Firebase…");
        const downloadUrl = await uploadImageToStorage({
          fileUri: pic.uri,
          uid: userId,
        });
        setCloudUrl(downloadUrl);
        log("[BC] upload done");

        // Load health profile + habits
        const profile = await fetchUserHealthProfile(userId, addLog);

        // OCR digits with OpenAI
        log("[BC] OCR (OpenAI) …");
        const ean13 = await readDigitsFromImage({
          imageUrl: downloadUrl,
          apiKey: EFFECTIVE_OPENAI_KEY,
          log,
        });
        log("[BC] OCR result (ean13):", ean13);

        // Build analyzed object
        let analyzed;
        if (!ean13) {
          analyzed = {
            barcode: "",
            title: "",
            brand: "",
            size: "",
            category: "unknown",
            calories_kcal_total: 0,
            protein_g: 0,
            fat_g: 0,
            sugar_g: 0,
            carbs_g: 0,
            fiber_g: 0,
            sodium_mg: 0,
            health_score: 0,
            items: [],
            alternatives: [],
            ingredients_text: "",
            ingredients_list: [],
            category_tag: null,
            countries_tags: [],
          };
        } else {
          analyzed = await fetchOFFProduct(ean13, log);
          if (!analyzed) {
            analyzed = {
              barcode: ean13,
              title: "",
              brand: "",
              size: "",
              category: "unknown",
              calories_kcal_total: 0,
              protein_g: 0,
              fat_g: 0,
              sugar_g: 0,
              carbs_g: 0,
              fiber_g: 0,
              sodium_mg: 0,
              health_score: 0,
              items: [],
              alternatives: [],
              ingredients_text: "",
              ingredients_list: [],
              category_tag: null,
              countries_tags: [],
            };
          } else {
            analyzed.alternatives = await fetchOFFAlternatives(
              {
                barcode: analyzed.barcode,
                category: analyzed.category,
                categoryTag: analyzed.category_tag,
                countriesTags: analyzed.countries_tags,
                baseKcal: analyzed.calories_kcal_total,
              },
              log
            );

            if (!analyzed.alternatives || analyzed.alternatives.length < 3) {
              const llmAlts = await fetchLLMAlternatives({
                brand: analyzed.brand,
                title: analyzed.title,
                category: analyzed.category,
                baseKcal: analyzed.calories_kcal_total,
                countriesTags: analyzed.countries_tags,
                apiKey: EFFECTIVE_OPENAI_KEY,
                log,
              });

              const merged = [...(analyzed.alternatives || []), ...llmAlts];
              const seen = new Set();
              analyzed.alternatives = merged
                .filter((a) => {
                  const key = String(a?.name || "").toLowerCase().trim();
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .slice(0, 8);
              log("[ALTS] merged:", analyzed.alternatives);
            }
          }
        }

        await pushFinalPayload({
          analyzed,
          pic,
          downloadUrl,
          userId,
          profile,
        });
      } catch (e) {
        log("[ERR] flow:", e?.message || String(e));
        Alert.alert("Barcode flow failed", e?.message || String(e));
      } finally {
        setLoading(false);
        if (_startedGlobal) endScan();
        log("[BC] scan finished");
      }
    },
  }));

  const pushFinalPayload = async ({ analyzed, pic, downloadUrl, userId, profile }) => {
    const clean = (v) => (v === "string" ? "" : v);
    analyzed.title = clean(toStr(analyzed.title, ""));
    analyzed.brand = clean(toStr(analyzed.brand, ""));
    analyzed.size = clean(toStr(analyzed.size, ""));
    analyzed.category = clean(toStr(analyzed.category, "unknown"));

    // push to context (this flips your LoadingPage to content once data arrives)
    setResult(analyzed);
    setRaw(JSON.stringify(analyzed));

    const titleSafe = toStr(analyzed?.title, "Scanned product");
    const kcalSafe = toNum(analyzed?.calories_kcal_total, null);
    const protein = toNum(analyzed?.protein_g, 0);
    const fat = toNum(analyzed?.fat_g, 0);
    const sugar = toNum(analyzed?.sugar_g, 0);
    const carbs = toNum(analyzed?.carbs_g, 0);
    const fiber = toNum(analyzed?.fiber_g, 0);
    const sodium = toNum(analyzed?.sodium_mg, 0);
    let health = toNum(analyzed?.health_score, 0);
    if (health < 0) health = 0;
    if (health > 10) health = 10;

    setTitle(titleSafe);
    setCalories(kcalSafe);
    setProtein(protein);
    setFat(fat);
    setSugar(sugar);
    setCarbs(carbs);
    setFiber(fiber);
    setSodium(sodium);
    setHealthScore(health);

    // Ingredients (OFF or LLM fallback)
    const looksBad = (t) =>
      String(t || "").replace(/[^A-Za-zÄäÖöÜüßÀ-ÿ]/g, "").length < 3;
    let ingList = Array.isArray(analyzed?.ingredients_list)
      ? analyzed.ingredients_list
      : [];
    if (ingList.length < 2 || ingList.every((i) => looksBad(i?.text))) {
      const llmIngredients = await fetchIngredientsByNameBrand({
        brand: analyzed?.brand,
        title: analyzed?.title,
        category: analyzed?.category,
        countriesTags: analyzed?.countries_tags,
        imageUrl: downloadUrl,
        apiKey: (typeof EFFECTIVE_OPENAI_KEY === "string" ? EFFECTIVE_OPENAI_KEY : ""),
        log: mkLogger(addLog),
      });
      if (llmIngredients.length) {
        ingList = llmIngredients.map((t) => ({ text: t }));
        analyzed.ingredients_text = llmIngredients.join(", ");
        analyzed.ingredients_list = ingList;
      }
    }

    const arr = (ingList || []).map((i) => toStr(i?.text, "")).filter(Boolean);
    const ingredientsBreakdown = buildIngredientsBreakdownFromList(
      arr,
      Number.isFinite(kcalSafe) ? kcalSafe : null
    );
    setIngredientsBreakdown?.(ingredientsBreakdown);

    const ingredients_full = Array.isArray(ingredientsBreakdown)
      ? ingredientsBreakdown.map((x) => ({
          name: toStr(x?.name, ""),
          estimated_kcal: toNum(x?.calories_kcal, 0),
        }))
      : [];

    // Items (fallback to a single item if empty)
    const items = Array.isArray(analyzed?.items) ? analyzed.items : [];
    const itemsSafe = items.map((it) => ({
      name: toStr(it?.name, "Item"),
      subtitle: toStr(it?.subtitle, ""),
      calories_kcal: toNum(it?.calories_kcal, 0),
      icon:
        it?.icon && String(it.icon).trim().length ? String(it.icon).trim() : "Utensils",
    }));
    if (!itemsSafe.length) {
      itemsSafe.push({
        name: titleSafe || "Unknown product",
        subtitle: analyzed?.size || "",
        calories_kcal: Number.isFinite(kcalSafe) ? kcalSafe : 0,
        icon: "Utensils",
      });
    }

    // Health proms
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
        items: itemsSafe,
      },
    });
    setProms?.(proms);

    // Ingredient cards
    const reconciledIngredients = ingredients_full.length
      ? ingredients_full
      : Array.isArray(ingredientsBreakdown)
      ? ingredientsBreakdown.map((x) => ({
          name: toStr(x?.name, ""),
          estimated_kcal: toNum(x?.calories_kcal, 0),
        }))
      : [];

    const perIngredientList = reconciledIngredients.map((ing) => ({
      name: toStr(ing?.name, ""),
      estimated_kcal: toNum(ing?.estimated_kcal, 0),
    }));
    const perIngredientKcalMap = Object.fromEntries(
      perIngredientList.map((i) => [i.name, i.estimated_kcal])
    );

    const ingredientCards = reconciledIngredients.map((ing) => ({
      label: ing.name,
      amt: Number.isFinite(ing.estimated_kcal)
        ? `+${Math.round(ing.estimated_kcal)} cal`
        : "+0 cal",
      icon: "Utensils",
      IconCOlor: "#1E67FF",
      iconColorBg: "#EEF3FF",
      color: "#FFFFFF",
    }));
    setList?.(ingredientCards);
    onScanList?.(ingredientCards);

    // Alternatives (grouped)
    const baseBrand = toStr(analyzed?.brand, "");
    const rawAlts = Array.isArray(analyzed?.alternatives) ? analyzed.alternatives : [];
    const sameBrand = [];
    const otherBrands = [];

    for (const a of rawAlts) {
      const display = toStr(a?.name, "");
      const { brand: detectedBrand, rest } = splitBrandFromDisplay(display, baseBrand);
      const variant = toStr(a?.flavor_or_variant || "", "");
      const diff = Number.isFinite(+a?.calories_diff) ? +a.calories_diff : NaN;
      const kcal =
        Number.isFinite(kcalSafe) && Number.isFinite(diff)
          ? Math.round(kcalSafe + diff)
          : NaN;
      const bucket = normalizeBucket(a?.bucket) ?? deriveBucket(kcal, kcalSafe);

      const normalized = {
        brand: detectedBrand,
        name: rest || display,
        flavor_or_variant: variant || null,
        calories_per_package_kcal: Number.isFinite(kcal) ? Math.round(kcal) : null,
        bucket,
      };

      if (baseBrand && norm(detectedBrand) === norm(baseBrand)) sameBrand.push(normalized);
      else otherBrands.push(normalized);
    }

    const ALL_ALTS = [...sameBrand, ...otherBrands];
    const lessAlts = ALL_ALTS.filter((a) => a.bucket === "lower").slice(0, 5);
    const simAlts  = ALL_ALTS.filter((a) => a.bucket === "similar").slice(0, 2);
    const moreAlts = ALL_ALTS.filter((a) => a.bucket === "higher").slice(0, 5);

    const toCard = (p) => ({
      label: [p.brand, p.name, p.flavor_or_variant].filter(Boolean).join(" "),
      amt: Number.isFinite(p.calories_per_package_kcal)
        ? `${p.calories_per_package_kcal}cal`
        : "—",
      moreOrLess:
        p.bucket === "lower" ? "less" : p.bucket === "higher" ? "more" : "similar",
    });

    const flatCards = [...lessAlts, ...simAlts, ...moreAlts].map(toCard);
    setAlternatives?.(flatCards);

    const alternatives_summary = {
      lower: lessAlts.length,
      similar: simAlts.length,
      higher: moreAlts.length,
      total: ALL_ALTS.length,
    };

    // Common payload
    const basePayload = {
      barcode: toStr(analyzed?.barcode, ""),
      title: titleSafe,
      brand: baseBrand || null,

      calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
      protein_g: protein,
      fat_g: fat,
      sugar_g: sugar,
      carbs_g: carbs,
      fiber_g: fiber,
      sodium_mg: sodium,
      health_score: health,

      items: itemsSafe,
      ingredients_full: reconciledIngredients,
      ingredients_kcal_list: perIngredientList,
      ingredients_kcal_map: perIngredientKcalMap,

      alternatives: {
        base_brand: baseBrand || null,
        same_brand: sameBrand,
        other_brands: otherBrands,
        summary_by_bucket: alternatives_summary,
      },
      alternatives_flat: flatCards,

      proms,
      profile_used: proms?.profile_used || null,

      image_local_uri: pic?.uri || null,
      image_cloud_url: downloadUrl || null,
      scanned_at_pretty: formatScannedAt?.() || null,
      created_at: serverTimestamp(),

      raw: JSON.stringify(analyzed),
      result: analyzed,
    };

    // Save
    try {
      const db = getFirestore();
      const reCol = collection(db, "users", userId, "RecentlyEaten");
      const docRef = await addDoc(reCol, basePayload);
      setCurrentItemId?.(docRef.id);
      setCurrentItem?.({ id: docRef.id, ...basePayload });
      addLog?.("[BC] saved to Firestore (RecentlyEaten)");
    } catch (err) {
      addLog?.(`[ERR] Firestore save RecentlyEaten: ${err?.message || err}`);
    }

    try {
      const db = getFirestore();
      const dateId = localDateId();
      const todayCol = collection(db, "users", userId, "Today", dateId, "List");
      await addDoc(todayCol, basePayload);
      addLog?.(`Saved scan to Firestore at Today/${dateId}`);
    } catch (err) {
      addLog?.(`[ERR] Firestore save Today: ${err?.message || err}`);
      Alert.alert("Firestore save failed", err?.message || String(err));
    }

    try {
      const db = getFirestore();
      const atlCol = collection(db, "users", userId, "AllTimeLineScan");
      await addDoc(atlCol, basePayload);
      addLog?.("Saved scan to Firestore (AllTimeLineScan)");
    } catch (err) {
      addLog?.(`[ERR] Firestore save AllTimeLineScan: ${err?.message || err}`);
      Alert.alert("Firestore save failed", err?.message || String(err));
    }

    addLog?.(
      `[SCANNED PRODUCT] ${analyzed?.barcode} ${analyzed?.brand} ${analyzed?.title}`
    );
    onScanResult?.(analyzed);
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
  const frameLeft = (width(100) - frameSize) / 2;
  const frameTop = height(32);
  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize - 4],
  });

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
        {/* Always show camera (like the food camera) */}
        <View
          style={{ height: "100%", width: "100%" }}
          pointerEvents={inCarousel ? "none" : "auto"}
        >
          <CameraView
            ref={cameraRef}
            style={{ height: "100%", width: "100%" }}
            facing="back"
            flash="off"
            autofocus="on"
            onCameraReady={() => log("Camera ready")}
          />
        </View>

        {/* Scanner overlay */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Dim around frame */}
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: frameTop, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: frameTop + frameSize, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", left: 0, top: frameTop, width: frameLeft, height: frameSize, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View style={{ position: "absolute", right: 0, top: frameTop, width: frameLeft, height: frameSize, backgroundColor: "rgba(0,0,0,0.45)" }} />
          {/* Frame */}
          <View style={{ position: "absolute", left: frameLeft, top: frameTop, width: frameSize, height: frameSize, borderRadius: 14, borderColor: "rgba(255,255,255,0.2)", borderWidth: 1 }} />
          {/* Corners */}
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop - 2, width: 40, height: 6, backgroundColor: "#fff", borderTopLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop - 2, width: 6, height: 40, backgroundColor: "#fff", borderTopLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize - 38, top: frameTop - 2, width: 40, height: 6, backgroundColor: "#fff", borderTopRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize - 4, top: frameTop - 2, width: 6, height: 40, backgroundColor: "#fff", borderTopRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop + frameSize - 4, width: 40, height: 6, backgroundColor: "#fff", borderBottomLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft - 2, top: frameTop + frameSize - 38, width: 6, height: 40, backgroundColor: "#fff", borderBottomLeftRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize - 38, top: frameTop + frameSize - 4, width: 40, height: 6, backgroundColor: "#fff", borderBottomRightRadius: 4 }} />
          <View style={{ position: "absolute", left: frameLeft + frameSize - 4, top: frameTop + frameSize - 38, width: 6, height: 40, backgroundColor: "#fff", borderBottomRightRadius: 4 }} />
          {/* Optional scan line
          <Animated.View
            style={{
              position: "absolute",
              left: frameLeft + 10,
              width: frameSize - 20,
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
