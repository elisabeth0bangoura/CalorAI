// ./Cameras/Scan_Food_Camera.js
import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
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
import PageAfterScan from "../PageAfterScan/PageAfterScan_Scan_Food/PageAfterScan_Scan_Food";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

/* ----------------- tiny utils ----------------- */
const toNum = (n, d = 0) => {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v : d;
};
const toStr = (s, d = "Scanned meal") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;
const norm = (s = "") => String(s).trim().toLowerCase();

/* ----------------- kcal reconciliation ----------------- */
const categoryOf = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("salt") || n.includes("sodium")) return "salt";
  if (
    n.includes("cracker") ||
    n.includes("noodle") ||
    n.includes("wheat") ||
    n.includes("ramen") ||
    n.includes("pasta") ||
    n.includes("bread")
  )
    return "noodle";
  if (
    n.includes("season") ||
    n.includes("powder") ||
    n.includes("sauce") ||
    n.includes("flavor")
  )
    return "seasoning";
  if (
    n.includes("veg") ||
    n.includes("cabbage") ||
    n.includes("kimchi") ||
    n.includes("onion") ||
    n.includes("garlic") ||
    n.includes("scallion")
  )
    return "veg";
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
        : Number.isFinite(r?.estimated_grams) &&
          Number.isFinite(r?.kcal_per_100g)
        ? (Number(r.estimated_grams) * Number(r.kcal_per_100g)) / 100
        : 0;
    return { ...r, _cat: cat, _base: Math.max(0, base) };
  });

  const target = Number(targetKcal);
  if (!Number.isFinite(target) || target <= 0) {
    return baseRows.map((r) => ({
      ...r,
      estimated_kcal: Math.max(0, Math.round(r._base)),
    }));
  }

  let baseSum = baseRows.reduce((s, r) => s + r._base, 0);

  if (baseSum <= 0.0001) {
    let shares = baseRows.map((r) => {
      if (r._cat === "noodle") return 0.8;
      if (r._cat === "seasoning") return 0.15;
      if (r._cat === "veg") return 0.05;
      return 0;
    });
    if (shares.every((v) => v === 0))
      shares = baseRows.map(() => 1 / baseRows.length);
    const totalShare = shares.reduce((a, b) => a + b, 0) || 1;
    const raw = shares.map((s) => (s / totalShare) * target);
    let out = raw.map((v) => Math.max(0, Math.round(v)));
    let diff = target - out.reduce((a, b) => a + b, 0);
    if (diff !== 0 && out.length) {
      const idxs = baseRows
        .map((r, i) => (r._cat === "noodle" ? i : -1))
        .filter((i) => i >= 0);
      const pool = idxs.length ? idxs : [out.length - 1];
      if (diff > 0) for (let i = 0; i < diff; i++) out[pool[i % pool.length]] += 1;
      else
        for (let i = 0; i < -diff; i++)
          out[pool[i % pool.length]] = Math.max(
            0,
            out[pool[i % pool.length]] - 1
          );
    }
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
    const noodleIdxs = baseRows
      .map((r, i) => (r._cat === "noodle" ? i : -1))
      .filter((i) => i >= 0);
    const pool = noodleIdxs.length ? noodleIdxs : [assigned.length - 1];
    const per = Math.floor(excess / pool.length);
    pool.forEach((i) => (assigned[i] += per));
    let rem = excess - per * pool.length;
    for (let k = 0; k < rem; k++) assigned[pool[k % pool.length]] += 1;
  }

  let sumNow = assigned.reduce((a, b) => a + b, 0);
  let diff = target - sumNow;
  if (diff !== 0 && assigned.length) {
    const noodleIdxs = baseRows
      .map((r, i) => (r._cat === "noodle" ? i : -1))
      .filter((i) => i >= 0);
    const pool = noodleIdxs.length ? noodleIdxs : [assigned.length - 1];
    if (diff > 0) for (let i = 0; i < diff; i++) assigned[pool[i % pool.length]] += 1;
    else
      for (let i = 0; i < -diff; i++)
        assigned[pool[i % pool.length]] = Math.max(
          0,
          assigned[pool[i % pool.length]] - 1
        );
  }

  return baseRows.map((r, i) => ({ ...r, estimated_kcal: assigned[i] }));
};

/* ----------------------- HEALTH PROFILE + PROMS ---------------------------- */
const fetchUserHealthProfile = async (uid, addLog) => {
  try {
    const db = getFirestore();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists) return {};
    const data = snap.data() || {};
    const habitsContainer =
      data.habits && typeof data.habits === "object" ? data.habits : {};
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
    ...(Array.isArray(items)
      ? items.map((i) => `${i?.name || ""} ${i?.subtitle || ""}`)
      : []),
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
/* ----------------------- /HEALTH PROFILE + PROMS --------------------------- */

/* ----------------------- MODEL CALLS --------------------------------------- */
const analyzeFoodUrl = async ({ imageUrl, apiKey }) => {
const systemPrompt = `
You are **Cal Diet AI — Visual Mode**. Identify foods from the image (any cuisine/language), estimate portions, and return STRICT JSON.

What to do
- Detect a short title (e.g., "Apple", "Rice crackers (chili)").
- brand: "" if unknown.
- Estimate portion size and provide calories_kcal_total for the whole visible serving/package.
- Fill protein_g, fat_g, carbs_g, sugar_g, fiber_g, sodium_mg with typical values for this food.
- Build ingredients_full in order of mass. Assign estimated_kcal per ingredient so the sum matches the total; salt = 0 kcal.
- Provide an items array describing each component with a sensible icon (free text icon name; if unsure use "Utensils").
- Always return 8–12 alternatives with calories_per_package_kcal and a bucket vs this product ("lower" ≤ −7%, "similar" within ±7%, "higher" ≥ +7%).
- Also make sure when you see drinks like coffee to check if its with milk and sugar

Container fill/empty detection — IMPORTANT
- For cups, bowls, plates, bottles, boxes, bags, jars: determine if EMPTY, FULL, or PARTIAL and adjust portions and calories accordingly.
- Encode fill via existing fields only:
  - items[].subtitle: include fill estimate, e.g., "mug ~70% full (~350 ml mug ⇒ ~245 ml present)".
  - ingredients_text: append concise note like "(~70% full)".
  - Portion math: calories_kcal_total must reflect the PRESENT contents (0 if empty).

Defaults & thresholds
- Demitasse 60–90 ml; small mug 200–250 ml; large mug 300–400 ml; takeout cup 350–500 ml; bowl 350–600 ml.
- EMPTY ≤5%; PARTIAL 6–90% (nearest 10%); FULL ≥91%.

Coffee (milk + sugar) — IMPORTANT
- Decide if milk and/or sugar are present from visual cues (color/foam/sugar packets). If uncertain, default to coffee with milk + sugar (see typical amounts).
- Compute calories/macros and scale by fill.

PLAIN WATER — CRITICAL
- If the drink is plain water, set calories/macros = 0, and include the PRESENT volume as:
  - water_ml (integer ml) at top level.
  - Also describe volume in items[].subtitle.
- If not plain water, do NOT include water_ml.

COFFEE CUPS — CRITICAL
- If the drink is coffee (any style), include the PRESENT amount as top-level coffee_cups (number of cups).
- Define 1 cup = 240 ml. Compute coffee_cups = present_ml / 240, round to ONE decimal (e.g., 0.5, 1.0, 1.5).
- Also mention cups in items[].subtitle.
- If not coffee, do NOT include coffee_cups.

Output (JSON only; allowed keys only)
{
  "title": "string",
  "brand": "string",
  "calories_kcal_total": number,
  "protein_g": number,
  "fat_g": number,
  "sugar_g": number,
  "carbs_g": number,
  "fiber_g": number,
  "sodium_mg": number,
  "health_score": number,
  "ingredients_full": [
    { "index": number, "name": "string", "estimated_grams": number|null,
      "kcal_per_100g": number|null, "estimated_kcal": number|null, "assumed": boolean }
  ],
  "ingredients_text": "string",
  "items": [
    { "name": "string", "subtitle": "string", "calories_kcal": number, "icon": "string" }
  ],
  "alternatives": [
    { "brand": "string", "name": "string", "flavor_or_variant": "string",
      "calories_per_package_kcal": number, "bucket": "lower|similar|higher" }
  ],
  "water_ml": number|null,
  "coffee_cups": number|null
}

Rules
- JSON only. No markdown.
- Do NOT add any keys other than the ones listed above.
`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this product and return strict JSON only." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return JSON.parse(json?.choices?.[0]?.message?.content || "{}");
};

const analyzeVisualOnly = async ({ imageUrl, apiKey }) => {
  const systemPrompt = `
You are **Cal Diet AI — Visual Mode**. Ignore text. Identify foods visible in the photo.
Return the SAME JSON shape as the OCR tool (estimates allowed). Prefer realistic portion sizes and macros.
`.trim();

  const body = {
    model: "gpt-5",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Detect foods and estimate portions, macros, and total kcal. Return JSON only.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return JSON.parse(json?.choices?.[0]?.message?.content || "{}");
};

const analyzeIngredientsOnly = async ({ imageUrl, apiKey }) => {
  const systemPrompt = `
Extract ONLY the ingredient list from the photo. Return strict JSON:

{
  "ingredients_text": "string",
  "ingredients_full": [
    { "index": number, "name": "string",
      "estimated_grams": number|null, "kcal_per_100g": number|null,
      "estimated_kcal": number|null, "assumed": boolean }
  ]
}
`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Return ingredients_text + ingredients_full only. JSON strictly.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return JSON.parse(json?.choices?.[0]?.message?.content || "{}");
};

const fetchAlternativesFallback = async ({ title, brand, kcal, apiKey }) => {
  const systemPrompt = `
Generate 8–12 realistic alternatives (same brand first if known). Each must include per-package kcal and a bucket vs the base (±7% rule).
Return strict JSON:
{ "alternatives":[{ "brand":"string","name":"string","flavor_or_variant":"string","calories_per_package_kcal":number,"bucket":"lower|similar|higher"}] }
`.trim();

  const userMsg = `
Base product:
- title: ${title || "Unknown product"}
- brand: ${brand || "(none)"}
- kcal per package: ${Number.isFinite(Number(kcal)) ? Number(kcal) : "(unknown)"}
Return JSON only.
`.trim();

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return JSON.parse(json?.choices?.[0]?.message?.content || "{}");
};

/* ----------------------- parse helpers ----------------------- */
const parseIngredientsText = (txt = "") => {
  const t = String(txt || "");
  const cleaned = t
    .replace(
      /^\s*(ingredients?|zutaten|ingredientes|ingr[ée]dients|ingrediënten|ingredienti|inhaltsstoffe|içindekiler|malzemeler|состав|配料|成分|原材料|재료)\s*[:：\-–]\s*/i,
      ""
    )
    .trim();
  if (!cleaned) return [];
  const rawTokens = cleaned
    .split(/[,;•·・●]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  rawTokens.forEach((tok) => {
    const m = tok.match(/^(.*?)\((.*?)\)\s*$/);
    if (m) {
      const head = m[1].trim();
      const inner = m[2]
        .split(/[,;]+/g)
        .map((x) => x.trim())
        .filter(Boolean);
      if (head) out.push(head);
      inner.forEach((x) => out.push(x));
    } else {
      out.push(tok);
    }
  });
  return out.map((name, i) => ({ index: i + 1, name }));
};

/* ----------------------- WATER / COFFEE parsers ----------------------- */
const extractMlFromText = (text = "") => {
  const s = String(text).toLowerCase();
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) {
    const v = Number(mlMatch[1]);
    if (Number.isFinite(v)) return Math.round(v);
  }
  const lMatch = s.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (lMatch) {
    const v = Number(lMatch[1]);
    if (Number.isFinite(v)) return Math.round(v * 1000);
  }
  return null;
};

const detectWaterAndVolume = (analyzed) => {
  const title = String(analyzed?.title || "");
  const looksWater =
    /\bwater\b/i.test(title) &&
    !/\b(sparkling|soda|tonic|flavor|lemon|coconut|juice|mineralized|electrolyte|sports)\b/i.test(
      title
    );
  if (!looksWater) return { isWater: false, ml: null };
  const direct = Number(analyzed?.water_ml);
  if (Number.isFinite(direct) && direct > 0) return { isWater: true, ml: Math.round(direct) };
  let ml = null;
  if (Array.isArray(analyzed?.items)) {
    for (const it of analyzed.items) {
      ml ||= extractMlFromText(it?.subtitle || "");
      ml ||= extractMlFromText(it?.name || "");
      if (ml) break;
    }
  }
  ml ||= extractMlFromText(analyzed?.ingredients_text || "");
  if (!ml) {
    const textBlob = [title, analyzed?.ingredients_text || ""].join(" ").toLowerCase();
    if (/\b(mug|cup|glass)\b/.test(textBlob)) ml = 250;
    if (/\bbottle\b/.test(textBlob)) ml = 500;
  }
  return { isWater: true, ml: ml ? Math.max(50, Math.min(2000, ml)) : 250 };
};

const detectCoffeeCups = (analyzed) => {
  const blob = [
    String(analyzed?.title || ""),
    String(analyzed?.ingredients_text || ""),
    ...(Array.isArray(analyzed?.items) ? analyzed.items.map(i => `${i?.name || ""} ${i?.subtitle || ""}`) : []),
  ].join(" ").toLowerCase();

  const isCoffee = /(coffee|espresso|americano|latte|cappuccino|mocha|cold\s*brew|macchiato|flat\s*white|ristretto|lungo)/i.test(blob);
  if (!isCoffee) return { isCoffee: false, cups: null };

  if (Number.isFinite(Number(analyzed?.coffee_cups))) {
    return { isCoffee: true, cups: Number(analyzed.coffee_cups) };
  }

  let ml = null;
  if (Array.isArray(analyzed?.items)) {
    for (const it of analyzed.items) {
      ml ||= extractMlFromText(it?.subtitle || "");
      ml ||= extractMlFromText(it?.name || "");
      if (ml) break;
    }
  }
  if (!ml) {
    if (/\bdemitasse\b/.test(blob)) ml = 75;
    else if (/\b(large|tall|grande|venti|takeout|to\s*go)\b/.test(blob)) ml = 350;
    else if (/\bsmall\b/.test(blob)) ml = 200;
    else ml = 240;
  }
  const cups = Math.max(0, Math.round((ml / 240) * 10) / 10);
  return { isCoffee: true, cups };
};
/* ----------------------- component ----------------------- */
export default forwardRef(function Scan_Food_Camera(
  { inCarousel = false, isActive = false, onScanResult, onScanList, openAiApiKey },
  ref
) {
  const userId = getAuth().currentUser.uid;
  const { register, present, isS2Open, isS3Open } = useSheets();

  const OPENAI_API_KEY_FALLBACK =
    "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";
  const EFFECTIVE_OPENAI_KEY = openAiApiKey || OPENAI_API_KEY_FALLBACK;

  const {
    setImageUrl, setCloudUrl, setResult, setRaw, addLog, resetScan,
    setTitle, setCalories, setProtein, setFat, setSugar, setCarbs,
    setFiber, setSodium, setHealthScore, setAlternatives, setList,
    setProms, markScannedNow, formatScannedAt, scanBusy, beginScan, endScan,
  } = useScanResults();

  const { setCurrentItemId, setCurrentItem } = useCurrentScannedItemId();

  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan {...props} />);
  }, [register]);

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  const localDateId = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const takeFast = async () => {
    if (!cameraRef.current) return null;
    try {
      return await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
    } catch (e) {
      addLog(`[ERR] takePictureAsync: ${e?.message || e}`);
      return null;
    }
  };

  const uploadImageToStorage = async ({ fileUri, uid = "anon" }) => {
    const path = `scans/${uid}/${Date.now()}.jpg`;
    const ref = storage().ref(path);
    await ref.putFile(fileUri, { contentType: "image/jpeg" });
    return await ref.getDownloadURL();
  };

  useImperativeHandle(ref, () => ({
    scan: async () => {
      let _startedGlobal = false;
      try {
        if (!isS2Open || !isActive || !cameraRef.current) {
          Alert.alert("Camera not ready", "Open the camera tab before scanning.");
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
        resetScan();
        _startedGlobal = true;
        addLog("Scan started");
        setLoading(true);

        const pic = await takeFast();
        if (!pic?.uri) {
          Alert.alert("Scan failed", "No photo captured.");
          addLog("[ERR] No photo captured");
          return;
        }

        setImageUrl(pic.uri);
        markScannedNow();
        addLog(`Stamped scan time: ${formatScannedAt?.() || "now"}`);
        present?.("s3");

        let downloadUrl = null;
        try {
          addLog("Uploading to Firebase…");
          downloadUrl = await uploadImageToStorage({
            fileUri: pic.uri,
            uid: userId,
          });
          setCloudUrl(downloadUrl);
          addLog("Upload done");
        } catch (e) {
          addLog(`[ERR] Upload: ${e?.message || e}`);
          Alert.alert("Upload failed", e?.message || "Could not upload image.");
          return;
        }

        const profile = await fetchUserHealthProfile(userId, addLog);

        try {
          addLog("Analyzing (OCR+nutrition) with OpenAI…");
          const analyzed = await analyzeFoodUrl({
            imageUrl: downloadUrl,
            apiKey: EFFECTIVE_OPENAI_KEY,
          });

          setResult(analyzed);
          setRaw(JSON.stringify(analyzed));

          let titleSafe = toStr(analyzed?.title);
          let baseBrand = toStr(analyzed?.brand, "");
          let kcalSafe = toNum(analyzed?.calories_kcal_total);
          let protein = toNum(analyzed?.protein_g);
          let fat = toNum(analyzed?.fat_g);
          let sugar = toNum(analyzed?.sugar_g);
          let carbs = toNum(analyzed?.carbs_g);
          let fiber = toNum(analyzed?.fiber_g);
          let sodium = toNum(analyzed?.sodium_mg);
          let health = toNum(analyzed?.health_score);
          if (health < 0) health = 0;
          if (health > 10) health = 10;

          let items = Array.isArray(analyzed?.items) ? analyzed.items : [];
          let ingredientsFull = Array.isArray(analyzed?.ingredients_full)
            ? analyzed.ingredients_full
            : [];

          if (
            (!ingredientsFull || ingredientsFull.length === 0) &&
            analyzed?.ingredients_text
          ) {
            ingredientsFull = parseIngredientsText(analyzed.ingredients_text);
          }

          const needVisual =
            (!titleSafe || titleSafe.toLowerCase() === "scanned meal") ||
            !(kcalSafe > 0) ||
            (items.length === 0 &&
              (!ingredientsFull || ingredientsFull.length === 0));

          if (needVisual) {
            addLog("Analyzing (Visual-only) with OpenAI…");
            try {
              const visual = await analyzeVisualOnly({
                imageUrl: downloadUrl,
                apiKey: EFFECTIVE_OPENAI_KEY,
              });
              if (!titleSafe && visual?.title)
                titleSafe = toStr(visual.title, "Scanned meal");
              if (!baseBrand && typeof visual?.brand === "string")
                baseBrand = toStr(visual.brand, "");
              if (!(kcalSafe > 0) && toNum(visual?.calories_kcal_total, null) > 0) {
                kcalSafe = toNum(visual.calories_kcal_total, null);
              }
              if ((!items || !items.length) && Array.isArray(visual?.items))
                items = visual.items;

              protein ||= toNum(visual?.protein_g, 0);
              fat ||= toNum(visual?.fat_g, 0);
              carbs ||= toNum(visual?.carbs_g, 0);
              sugar ||= toNum(visual?.sugar_g, 0);
              fiber ||= toNum(visual?.fiber_g, 0);
              sodium ||= toNum(visual?.sodium_mg, 0);

              if (
                (!ingredientsFull || !ingredientsFull.length) &&
                Array.isArray(visual?.ingredients_full)
              ) {
                ingredientsFull = visual.ingredients_full;
              }
            } catch (e) {
              addLog(`[Visual analyze failed] ${e?.message || e}`);
            }
          }

          if (!ingredientsFull || ingredientsFull.length < 3) {
            addLog("Ingredients sparse — running ingredients-only OCR…");
            try {
              const ingOnly = await analyzeIngredientsOnly({
                imageUrl: downloadUrl,
                apiKey: EFFECTIVE_OPENAI_KEY,
              });
              if (
                Array.isArray(ingOnly?.ingredients_full) &&
                ingOnly.ingredients_full.length > (ingredientsFull?.length || 0)
              ) {
                ingredientsFull = ingOnly.ingredients_full;
              }
              if (
                ingOnly?.ingredients_text &&
                (!analyzed?.ingredients_text ||
                  ingOnly.ingredients_text.length >
                    analyzed.ingredients_text.length)
              ) {
                analyzed.ingredients_text = ingOnly.ingredients_text;
              }
            } catch (e) {
              addLog(`[Ingredients-only OCR failed] ${e?.message || e}`);
            }
          }

          ingredientsFull = (ingredientsFull || [])
            .map((row, i) => {
              const idx = toNum(row?.index, i + 1);
              const name = toStr(row?.name, "");
              const grams = Number.isFinite(toNum(row?.estimated_grams, NaN))
                ? toNum(row?.estimated_grams, NaN)
                : null;
              const per100 = Number.isFinite(toNum(row?.kcal_per_100g, NaN))
                ? toNum(row?.kcal_per_100g, NaN)
                : null;
              let kcal = Number.isFinite(toNum(row?.estimated_kcal, NaN))
                ? toNum(row?.estimated_kcal, NaN)
                : null;
              if (kcal == null && Number.isFinite(grams) && Number.isFinite(per100)) {
                kcal = Math.round((grams * per100) / 100);
              }
              const assumed = !!row?.assumed;
              return {
                index: idx,
                name,
                estimated_grams: Number.isFinite(grams) ? grams : null,
                kcal_per_100g: Number.isFinite(per100) ? per100 : null,
                estimated_kcal: Number.isFinite(kcal) ? Math.round(kcal) : null,
                assumed,
              };
            })
            .filter((r) => r.name.length > 0)
            .sort((a, b) => a.index - b.index);

          const reconciledIngredients = reconcileIngredientsToTotal(
            ingredientsFull,
            kcalSafe
          );

          const ingredientCards = reconciledIngredients.map((ing) => ({
            label: ing.name,
            amt: Number.isFinite(ing.estimated_kcal)
              ? `+${ing.estimated_kcal} cal`
              : "+0 cal",
            icon: "Utensils",
            IconCOlor: "#1E67FF",
            iconColorBg: "#EEF3FF",
            color: "#FFFFFF",
          }));
          setList?.(ingredientCards);
          onScanList?.(ingredientCards);

          const itemsSafe = (items || []).map((it) => ({
            name: toStr(it?.name, "Item"),
            subtitle: toStr(it?.subtitle, ""),
            calories_kcal: toNum(it?.calories_kcal, 0),
            icon:
              it?.icon && String(it.icon).trim().length
                ? String(it.icon).trim()
                : "Utensils",
          }));

          const waterInfo = detectWaterAndVolume(analyzed);
          if (waterInfo.isWater) {
            kcalSafe = 0;
            protein = 0;
            fat = 0;
            sugar = 0;
            carbs = 0;
            fiber = 0;
            sodium = 0;

            if (itemsSafe.length === 0) {
              itemsSafe.push({
                name: "Water",
                subtitle: `${waterInfo.ml} ml`,
                calories_kcal: 0,
                icon: "GlassWater",
              });
            } else {
              const hasMl = itemsSafe.some(
                (it) => extractMlFromText(it.subtitle) != null
              );
              if (!hasMl) {
                itemsSafe[0] = {
                  ...itemsSafe[0],
                  subtitle:
                    (itemsSafe[0].subtitle ? itemsSafe[0].subtitle + " · " : "") +
                    `${waterInfo.ml} ml`,
                };
              }
            }
          }

          const coffeeInfo = detectCoffeeCups(analyzed);
          if (coffeeInfo.isCoffee) {
            const hasCupsText = itemsSafe.some((it) =>
              /\b\d+(\.\d+)?\s*cups?\b/i.test(it.subtitle)
            );
            if (!hasCupsText && itemsSafe.length) {
              itemsSafe[0] = {
                ...itemsSafe[0],
                subtitle:
                  (itemsSafe[0].subtitle ? itemsSafe[0].subtitle + " · " : "") +
                  `${coffeeInfo.cups} cup${coffeeInfo.cups === 1 ? "" : "s"}`,
              };
            }
          }

          let rawAlts = Array.isArray(analyzed?.alternatives)
            ? analyzed.alternatives
            : [];
          if (!rawAlts || rawAlts.length < 6) {
            try {
              const altFallback = await fetchAlternativesFallback({
                title: titleSafe || "Food",
                brand: baseBrand || "",
                kcal: kcalSafe || null,
                apiKey: EFFECTIVE_OPENAI_KEY,
              });
              if (Array.isArray(altFallback?.alternatives))
                rawAlts = rawAlts.concat(altFallback.alternatives);
            } catch (e) {
              addLog(`[Alts fallback failed] ${e?.message || e}`);
            }
          }

          const normalizeBucket = (b) => {
            const s = norm(b);
            if (s.startsWith("low") || s === "less" || s === "lower") return "lower";
            if (s.startsWith("high") || s === "more" || s === "higher") return "higher";
            if (s.startsWith("sim") || s === "same") return "similar";
            return null;
          };
          const deriveBucket = (altKcal, baseKcal) => {
            const a = Number(altKcal),
              b = Number(baseKcal);
            if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0)
              return "similar";
            const diff = (a - b) / b;
            if (diff <= -0.07) return "lower";
            if (diff >= 0.07) return "higher";
            return "similar";
          };

          const sameBrand = [];
          const otherBrands = [];
          for (const a of rawAlts) {
            const brand = toStr(a?.brand, "");
            const name = toStr(a?.name, "");
            const variant = toStr(a?.flavor_or_variant || "", "");
            const akcal = toNum(a?.calories_per_package_kcal, NaN);
            const bucket = normalizeBucket(a?.bucket) ?? deriveBucket(akcal, kcalSafe);
            const normalized = {
              brand: brand || null,
              name,
              flavor_or_variant: variant || null,
              calories_per_package_kcal: Number.isFinite(akcal) ? Math.round(akcal) : null,
              bucket,
            };
            if (baseBrand && norm(brand) === norm(baseBrand)) sameBrand.push(normalized);
            else otherBrands.push(normalized);
          }
          const ALL_ALTS = [...sameBrand, ...otherBrands];

          const lessAlts = ALL_ALTS.filter((a) => a.bucket === "lower").slice(0, 5);
          const simAlts = ALL_ALTS.filter((a) => a.bucket === "similar").slice(0, 2);
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

          if (!titleSafe) titleSafe = "Scanned meal";

          setTitle(titleSafe);
          setCalories(Number.isFinite(kcalSafe) ? kcalSafe : null);
          setProtein(Number.isFinite(protein) ? protein : null);
          setFat(Number.isFinite(fat) ? fat : null);
          setSugar(Number.isFinite(sugar) ? sugar : null);
          setCarbs(Number.isFinite(carbs) ? carbs : null);
          setFiber(Number.isFinite(fiber) ? fiber : null);
          setSodium(Number.isFinite(sodium) ? sodium : null);
          setHealthScore(Number.isFinite(health) ? health : null);

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

          const payload = {
            title: titleSafe,
            brand: baseBrand || null,
            calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
            protein_g: Number.isFinite(protein) ? protein : null,
            fat_g: Number.isFinite(fat) ? fat : null,
            sugar_g: Number.isFinite(sugar) ? sugar : null,
            carbs_g: Number.isFinite(carbs) ? carbs : null,
            fiber_g: Number.isFinite(fiber) ? fiber : null,
            sodium_mg: Number.isFinite(sodium) ? sodium : null,
            health_score: Number.isFinite(health) ? health : null,

            water_ml: waterInfo.isWater ? waterInfo.ml : null,
            coffee_cups: coffeeInfo.isCoffee ? coffeeInfo.cups : null,

            items: itemsSafe,
            ingredients_full: reconciledIngredients,
            ingredients_kcal_list: reconciledIngredients.map((r) => ({
              name: r.name,
              kcal: Number(r.estimated_kcal) || 0,
            })),
            ingredients_kcal_map: Object.fromEntries(
              reconciledIngredients.map((r) => [norm(r.name), Number(r.estimated_kcal) || 0])
            ),

            alternatives: {
              base_brand: baseBrand || null,
              same_brand: sameBrand,
              other_brands: otherBrands,
              summary_by_bucket: {
                lower: lessAlts.length,
                similar: simAlts.length,
                higher: moreAlts.length,
                total: ALL_ALTS.length,
              },
            },
            alternatives_flat: flatCards,

            proms,
            profile_used: proms.profile_used || null,

            image_local_uri: pic.uri || null,
            image_cloud_url: downloadUrl || null,
            scanned_at_pretty: formatScannedAt?.() || null,
            created_at: serverTimestamp(),

            raw: JSON.stringify(analyzed),
            result: analyzed,
          };

          let createdDocId;

          try {
            const db = getFirestore();
            const colRef = collection(db, "users", userId, "RecentlyEaten");
            const docRef = await addDoc(colRef, payload);
            createdDocId = docRef.id;
            setCurrentItemId(docRef.id);
            setCurrentItem(payload);
            addLog(`Saved scan to Firestore [RecentlyEaten/${docRef.id}]`);
          } catch (err) {
            addLog(`[ERR] Firestore save (RecentlyEaten): ${err?.message || err}`);
          }

          try {
            const db = getFirestore();
            const dateId = localDateId();
            const todayRef = doc(db, "users", userId, "Today", dateId, "List", createdDocId);
            await setDoc(todayRef, payload);
            addLog(`Saved scan to Firestore [Today/${dateId}/List]`);
          } catch (err) {
            addLog(`[ERR] Firestore save (Today): ${err?.message || err}`);
          }

          try {
            const db = getFirestore();
            const allTimeRef = doc(db, "users", userId, "AllTimeLineScan", createdDocId);
            await setDoc(allTimeRef, payload);
            addLog(`Saved scan to Firestore [AllTimeLineScan]`);
          } catch (err) {
            addLog(`[ERR] Firestore save (AllTimeLineScan): ${err?.message || err}`);
          }

          onScanResult?.(analyzed);
          addLog("Analysis done");
        } catch (e) {
          addLog(`[ERR] OpenAI: ${e?.message || e}`);
          Alert.alert("Analysis failed", e?.message || "Could not analyze image.");
        }
      } finally {
        setLoading(false);
        if (_startedGlobal) endScan();
        addLog("Scan finished");
      }
    },
  }));

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
      <View
        style={{ height: height(100), width: width(100), backgroundColor: "#000" }}
      >
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
            onCameraReady={() => console.log("Camera ready")}
          />
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
