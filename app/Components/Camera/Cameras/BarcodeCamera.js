// ./Cameras/Scan_Barcode_Camera.js
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
import PageAfterScan from "../PageAfterScan/PageAfterScan_Scan_Barcode/PageAfterScan_Scan_Barcode";

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
  "CupSoda","Avocado","IceCream",
]);
const safeIconName = (s) => (typeof s === "string" && LUCIDE_SAFE.has(s.trim())) ? s.trim() : "Utensils";
const toNum = (n, d = 0) => Number.isFinite(+n) ? +n : d;
const toStr = (s, d = "") => (typeof s === "string" && s.trim().length) ? s.trim() : d;

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const asEAN13 = (raw) => { let d = onlyDigits(raw); if (d.length === 12) d = "0" + d; return d; };
const isValidEAN13 = (code) => {
  const d = onlyDigits(code);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = d.charCodeAt(i) - 48;
    sum += (i % 2 === 0) ? n : n * 3;
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

/* ---------------- dual logger ---------------- */
const mkLogger = (addLog) => (...args) => {
  const line = args.map((a)=> {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(" ");
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
      { role: "user", content: [
          { type: "text", text: "Read digits under the bars. JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ] },
    ],
  });

  for (const p of prompts) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(mkBody(p)),
    });
    log("[OCR] status:", r.status);
    if (!r.ok) continue;
    let parsed = {};
    try { parsed = JSON.parse((await r.json())?.choices?.[0]?.message?.content || "{}"); }
    catch { continue; }
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
  const categoryTagRaw = categoriesTags.length ? categoriesTags[categoriesTags.length - 1] : null;
  const categoryLabel  = categoryTagRaw
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

    // OFF ingredients (may be junk)
    ingredients_text: toStr(
      p.ingredients_text_en || p.ingredients_text_de || p.ingredients_text_fr || p.ingredients_text,
      ""
    ),
    ingredients_list: Array.isArray(p.ingredients)
      ? p.ingredients.map((ing) => ({
          text: toStr(ing?.text || ing?.id, ""),
          percent_estimate: Number.isFinite(+ing?.percent_estimate) ? +ing.percent_estimate : null,
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

/* ---------- STEP 2b: Popular (well-known) alternatives ---------- */
async function fetchOFFAlternatives({ barcode, category, categoryTag, countriesTags, baseKcal }, log = console.log) {
  const MIN_UNIQUE_SCANS = 50;
  const PAGE_SIZE = 100;

  const params = new URLSearchParams({
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(PAGE_SIZE),
    sort_by: "unique_scans_n",
    fields: "product_name,brands,code,unique_scans_n,nutriments,countries_tags,categories_tags",
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

/* ---------- NEW: STEP 2c LLM fallback alternatives (brand + title) ---------- */
async function fetchLLMAlternatives({
  brand, title, category, baseKcal, countriesTags, apiKey, log = console.log,
}) {
  const display = [toStr(brand, ""), toStr(title, "")].filter(Boolean).join(" ").trim();
  const market = Array.isArray(countriesTags) && countriesTags.length
    ? countriesTags[0].replace(/^en:/, "")
    : "";

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content:
`You recommend close substitutes for a packaged food.
Prefer SKUs from the SAME brand (e.g., different flavors/variants), then well-known competitors in the same category and market.
Return concise product names like "Brand Product". Estimate calories_diff vs the given product when reasonable (negative means fewer kcal).
If unsure, set calories_diff to null. Return up to 8.
JSON ONLY:
{ "alternatives":[{"name":"string","calories_diff":-40|null}, ...] }`
      },
      { role: "user", content:
`Product: ${display || "(unknown)"} 
Category: ${toStr(category, "")}
Market hint: ${market}
Base calories: ${Number.isFinite(+baseKcal) ? +baseKcal : "unknown"}
Return ONLY JSON.` },
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
    try { parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}"); } catch {}
    const arr = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
    const cleaned = arr
      .map((x) => ({
        name: toStr(x?.name, ""),
        calories_diff: Number.isFinite(+x?.calories_diff) ? Math.round(+x.calories_diff) : null,
      }))
      .filter((x) => x.name);
    log("[LLM-ALTS] parsed:", cleaned);
    return cleaned.slice(0, 8);
  } catch (e) {
    log("[LLM-ALTS] error:", e?.message || String(e));
    return [];
  }
}

/* ---------- STEP 3: Ask OpenAI for ingredients by Brand + Title (+photo) ---------- */
async function fetchIngredientsByNameBrand({
  brand, title, category, countriesTags, imageUrl, apiKey, log = console.log,
}) {
  const display = [toStr(brand, ""), toStr(title, "")]
    .filter(Boolean).join(" ").trim();
  const market = Array.isArray(countriesTags) && countriesTags.length
    ? countriesTags[0].replace(/^en:/, "")
    : "";

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content:
`You return a realistic ingredient list for a packaged food using brand + product name + category
and the package photo. Use visual cues to infer flavor drivers (e.g., chocolate/cocoa/hazelnut).
Return 8–12 simple, lowercase ingredients ordered by typical proportion (largest first).
Avoid nutrition lines and claims. JSON ONLY:
{ "ingredients": ["string", ...] }`
      },
      {
        role: "user",
        content: [
          { type: "text", text:
`brand+name: ${display || "(unknown)"}
category: ${toStr(category, "")}
market hint: ${market}
If the photo suggests chocolate/hazelnut layers, include "cocoa powder" or "chocolate" and "hazelnut paste".
Return only JSON.` },
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
    try { parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}"); } catch {}
    const arr = Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
    const cleaned = arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    log("[LLM-ING] parsed:", cleaned);
    return cleaned;
  } catch (e) {
    log("[LLM-ING] error:", e?.message || String(e));
    return [];
  }
}

/* ---------- STEP 4: Build ingredients breakdown (simple & scaled) ---------- */
function buildIngredientsBreakdownFromList(ingredientsArray, total_kcal) {
  if (!Array.isArray(ingredientsArray) || ingredientsArray.length === 0) return null;

  // take top 6 unique ingredients
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
  return out.map((x) => ({ ...x, icon: safeIconName(x.icon) }));
}

/* ---------------- component ---------------- */
export default forwardRef(function Scan_Barcode_Camera(
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
    markScannedNow, formatScannedAt, setIngredientsBreakdown,
  } = useScanResults();

  // register page
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

  useImperativeHandle(ref, () => ({
    scan: async () => {
      try {
        if (!isS2Open || !isActive || !cameraRef.current) {
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
        setLoading(true);
        log("[BC] scan started");

        // Small hold so AF locks
        await new Promise((r) => setTimeout(r, 900));

        const pic = await cameraRef.current.takePictureAsync({
          quality: 0.9, skipProcessing: true,
        });
        if (!pic?.uri) {
          log("[ERR] No photo captured");
          Alert.alert("Scan failed", "No photo captured.");
          return;
        }

        // Show S3 immediately with photo; DO NOT push data yet
        setImageUrl(pic.uri);
        markScannedNow();
        present?.("s3");
        log("[BC] S3 opened (LoadingPage), stamped:", formatScannedAt?.() || "now");

        // Upload
        log("[BC] uploading to Firebase…");
        const downloadUrl = await uploadImageToStorage({
          fileUri: pic.uri, uid: userId || "anon",
        });
        setCloudUrl(downloadUrl);
        log("[BC] upload done:", downloadUrl);

        // OCR digits with OpenAI (robust)
        log("[BC] OCR (OpenAI) …");
        const ean13 = await readDigitsFromImage({
          imageUrl: downloadUrl, apiKey: EFFECTIVE_OPENAI_KEY, log,
        });
        log("[BC] OCR result (ean13):", ean13);

        if (!ean13) {
          log("[BC] OCR failed → keep LoadingPage until we set a clean 'unknown' payload");
          const unknown = {
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
          await pushFinalPayload({
            analyzed: unknown, pic, downloadUrl, userId,
          });
          return;
        }

        // OFF lookup
        log("[BC] OFF lookup …");
        let off = await fetchOFFProduct(ean13, log);
        if (!off) {
          log("[BC] OFF miss → return 'barcode-only' unknown payload");
          off = {
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
          // well-known alternatives (popularity + category/country awareness)
          off.alternatives = await fetchOFFAlternatives({
            barcode: off.barcode,
            category: off.category,
            categoryTag: off.category_tag,
            countriesTags: off.countries_tags,
            baseKcal: off.calories_kcal_total,
          }, log);

          // 🔁 Fallback to LLM if OFF gives too few
          if (!off.alternatives || off.alternatives.length < 3) {
            const llmAlts = await fetchLLMAlternatives({
              brand: off.brand,
              title: off.title,
              category: off.category,
              baseKcal: off.calories_kcal_total,
              countriesTags: off.countries_tags,
              apiKey: (typeof openAiApiKey === "string" && openAiApiKey) || EFFECTIVE_OPENAI_KEY,
              log,
            });

            // merge + dedupe by name
            const merged = [...(off.alternatives || []), ...llmAlts];
            const seen = new Set();
            off.alternatives = merged.filter((a) => {
              const key = String(a?.name || "").toLowerCase().trim();
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            }).slice(0, 8);
            log("[ALTS] merged:", off.alternatives);
          }
        }

        await pushFinalPayload({
          analyzed: off, pic, downloadUrl, userId,
        });
      } catch (e) {
        log("[ERR] flow:", e?.message || String(e));
        Alert.alert("Barcode flow failed", e?.message || String(e));
      } finally {
        setLoading(false); // camera overlay only
        log("[BC] scan finished");
      }
    },
  }));

  const pushFinalPayload = async ({ analyzed, pic, downloadUrl, userId }) => {
    const clean = (v) => (v === "string" ? "" : v);
    analyzed.title = clean(toStr(analyzed.title, ""));
    analyzed.brand = clean(toStr(analyzed.brand, ""));
    analyzed.size = clean(toStr(analyzed.size, ""));
    analyzed.category = clean(toStr(analyzed.category, "unknown"));

    // Now (and only now) push to context — LoadingPage will flip after this
    setResult(analyzed);
    setRaw(JSON.stringify(analyzed));

    const titleSafe = toStr(analyzed?.title, "Scanned product");
    const kcalSafe  = toNum(analyzed?.calories_kcal_total, null);
    const protein   = toNum(analyzed?.protein_g, 0);
    const fat       = toNum(analyzed?.fat_g, 0);
    const sugar     = toNum(analyzed?.sugar_g, 0);
    const carbs     = toNum(analyzed?.carbs_g, 0);
    const fiber     = toNum(analyzed?.fiber_g, 0);
    const sodium    = toNum(analyzed?.sodium_mg, 0);
    let   health    = toNum(analyzed?.health_score, 0);
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

    /* === INGREDIENTS via OFF OR LLM (Brand+Title + Photo) === */
    const looksBad = (t) => (String(t || "").replace(/[^A-Za-zÄäÖöÜüßÀ-ÿ]/g, "").length < 3);
    let ingList = Array.isArray(analyzed?.ingredients_list) ? analyzed.ingredients_list : [];
    if (ingList.length < 2 || ingList.every(i => looksBad(i?.text))) {
      const llmIngredients = await fetchIngredientsByNameBrand({
        brand: analyzed?.brand,
        title: analyzed?.title,
        category: analyzed?.category,
        countriesTags: analyzed?.countries_tags,
        imageUrl: downloadUrl, // let LLM see the package (helps detect chocolate/hazelnut etc.)
        apiKey: (typeof (openAiApiKey || "") === "string" ? openAiApiKey : "") || (typeof EFFECTIVE_OPENAI_KEY === "string" ? EFFECTIVE_OPENAI_KEY : ""),
        log: mkLogger(addLog),
      });
      if (llmIngredients.length) {
        ingList = llmIngredients.map((t) => ({ text: t }));
        analyzed.ingredients_text = llmIngredients.join(", ");
        analyzed.ingredients_list = ingList;
      }
    }

    // Build & save breakdown (evenly across top 6; scaled to total kcal)
    const arr = (ingList || []).map((i) => toStr(i?.text, "")).filter(Boolean);
    const ingredientsBreakdown = buildIngredientsBreakdownFromList(arr, Number.isFinite(kcalSafe) ? kcalSafe : null);
    setIngredientsBreakdown?.(ingredientsBreakdown);

    // Items list
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
        calories_kcal: Number.isFinite(kcalSafe) ? kcalSafe : 0,
        icon: "Utensils",
      });
    }
    setList?.(itemsSafe);

    const alts = Array.isArray(analyzed?.alternatives) ? analyzed.alternatives : [];
    setAlternatives?.(alts);

    // Firestore save (non-blocking)
    try {
      const db = getFirestore();
      const colRef = collection(db, "users", userId || "anon", "RecentlyEaten");
      await addDoc(colRef, {
        barcode: toStr(analyzed?.barcode, ""),
        title: titleSafe,
        calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
        protein_g: protein, fat_g: fat, sugar_g: sugar, carbs_g: carbs,
        fiber_g: fiber, sodium_mg: sodium, health_score: health,
        items: itemsSafe, alternatives: alts,
        image_local_uri: pic?.uri || null, image_cloud_url: downloadUrl || null,
        scanned_at_pretty: formatScannedAt?.() || null, created_at: serverTimestamp(),
        raw: JSON.stringify(analyzed), result: analyzed,
      });
      console.log("[BC] saved to Firestore");
      addLog?.("[BC] saved to Firestore");
    } catch (err) {
      console.log("[ERR] Firestore save:", err?.message || err);
      addLog?.(`[ERR] Firestore save: ${err?.message || err}`);
    }

    console.log("[SCANNED PRODUCT]", analyzed?.barcode, analyzed?.brand, analyzed?.title);
    addLog?.(`[SCANNED PRODUCT] ${analyzed?.barcode} ${analyzed?.brand} ${analyzed?.title}`);

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
              onCameraReady={() => mkLogger(addLog)("Camera ready")}
            />
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
});
