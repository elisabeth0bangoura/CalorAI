// ./Cameras/Edit_Scan_FoodScan.js
import { ArrowLeft, ChevronDown, ChevronUp, Info, Minus, Plus } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import LottieView from "lottie-react-native";

// ✅ Current item id context (so Edit_Scan can know which doc to load)
import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";

// ✅ Firestore/Auth (v22 modular) for saving merged edits
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "@react-native-firebase/firestore";

/* ---------------- helpers ---------------- */
const tc = (s = "") =>
  String(s).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const sText = (v, d = "") => (typeof v === "string" ? v : d);
const sNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const localDateId = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const isNEA = (a) => Array.isArray(a) && a.length > 0;
const nn = (v) => v !== null && v !== undefined;

function parseFreeformToItems(text) {
  if (!text) return [];
  let s = String(text).trim();
  const parts = s
    .split(/(?:\bwith\b|\band\b|\+|,)/gi)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const main = parts[0];
  const rest = parts.slice(1);
  const names = [main, ...rest]
    .map(tc)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set();
  const unique = names.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
  return unique.map((name) => ({ name, subtitle: "" }));
}

/* ⚠️ dev only; use your secure backend in prod (same as camera) */
const OPENAI_API_KEY_FALLBACK =
  "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";

/* ---------- SAME base prompt as camera, with edit merge overlay ---------- */
const basePrompt = `
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
- Use visual cues:
  - Liquid level vs container height; meniscus/foam line; latte art/crema height.
  - Transparency: visible bottom/sides ⇒ low fill; opaque band at mid-height ⇒ partial; up to rim ⇒ full.
  - Residue/stains/crumbs ⇒ almost empty (≤10%).
  - Package deformation: flat/air only ⇒ empty; bulging/structured contents ⇒ partial/full.
- Encode fill in allowed fields (NO new keys):
  - \`items[].subtitle\`: include fill estimate, e.g., "mug ~70% full (~350 ml mug ⇒ ~245 ml present)".
  - \`ingredients_text\`: append concise note like "(~70% full)".
  - Portion math: scale estimated_grams/ml in \`ingredients_full\` to the PRESENT amount only; \`calories_kcal_total\` must reflect the present contents (0 if empty).
- Default vessel sizes when uncertain (override with clear cues):
  - Demitasse 60–90 ml; small mug 200–250 ml; large mug 300–400 ml; takeout cup 350–500 ml; bowl 350–600 ml; plate serving 250–400 g.
- Thresholds:
  - EMPTY: ≤5% present ⇒ treat as 0 kcal, subtitle "empty".
  - PARTIAL: 6–90% ⇒ estimate nearest 10% (e.g., 30%, 50%, 70%).
  - FULL: ≥91% ⇒ "full" (100%).

Coffee (milk + sugar) — IMPORTANT
- When you see coffee (espresso, americano, latte, cappuccino, iced coffee, etc.), DO NOT assume 2–30 kcal.
- Use visual cues to decide if milk and/or sugar are present:
  - Color/opacity: tan/beige or foamy microfoam ⇒ milk present; near-black and transparent ⇒ likely black.
  - Foam and latte art ⇒ steamed milk present.
  - Sugar packets, crystals, syrups, stir sticks nearby ⇒ sugar likely added.
  - Cup size: demitasse (~60–90 ml), small mug (~200–250 ml), large mug (~300–400 ml), takeout (~350–500 ml).
- If uncertain, DEFAULT TO "coffee with milk and sugar" rather than black coffee:
  - Small (~240 ml): assume 60 ml whole milk + 2 tsp sugar (≈8 g).
  - Large (~350 ml): assume 90 ml whole milk + 3 tsp sugar (≈12 g).
- Only treat as black coffee (≤5 kcal) if clearly near-black with no milk whiteness/foam and no sugar cues.
- Compute calories/macros from ingredients and SCALE by fill level detected above:
  - Brewed coffee: 0 kcal (0/0/0), sodium ~5 mg per 240 ml (use 0–10 mg).
  - Whole milk (3–3.8% fat): ~61–64 kcal/100 ml; protein ~3.2 g/100 ml; fat ~3.5 g/100 ml; carbs/sugar ~4.8 g/100 ml.
    - Very light color may imply semi-skim (≈46 kcal/100 ml) or skim (~34 kcal/100 ml).
  - White sugar: ~387 kcal/100 g; 1 tsp ≈ 4 g.
- Reflect these as separate entries in ingredients_full (brewed coffee, milk, sugar) with estimated_grams/ml and estimated_kcal that sum to the total.
- The title should indicate additions if present (e.g., "Coffee (milk + sugar)").
- Items entry should name the drink and per-cup calories; icon can be "Coffee".

Output (NO extra keys, NO markdown)
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
  ]
}

Rules
- JSON only. No markdown.
- If unsure about an icon, use "Utensils".
`.trim();

// 👇 Edit-overlay: STRICTLY keep title/brand; only add ingredients and update totals/macros
const editOverlay = `
EDIT MERGE RULES (VERY IMPORTANT)
- PURPOSE: The user is adding ingredients (e.g., "2 spoons vanilla sugar") to an EXISTING item.
- DO NOT change "title" or "brand". Keep them EXACTLY as in existing_result.
- You receive:
  - existing_result: previous JSON for this item (may include ingredients_full/items/macros)
  - existing_ingredients_full: the current ingredients list
  - existing_items: the current items array
  - add_ingredients: [{ name, unit: "g"|"oz"|"ml"|"piece"|"spoon", quantity:number, servings:number }]
- TASK:
  1) Merge without deleting. Keep all existing ingredients/items and APPEND the new ones in logical order.
  2) Recalculate calories_kcal_total and macros (protein_g, fat_g, carbs_g, sugar_g, fiber_g, sodium_mg) by ADDING the contributions of the new ingredients.
  3) If unit is "spoon", treat as teaspoon by default (~5 ml).
     Typical densities: white sugar ≈ 4 g/tsp, table salt ≈ 6 g/tsp, olive oil ≈ 4.5 g/tsp (≈ 15 g/tbsp).
     Use reasonable estimates if brand/label unknown.
  4) Output the SAME JSON SHAPE as camera pass. Do not introduce new keys.
- Never drop existing ingredients/items; if unsure about an icon, use "Utensils".
`.trim();

const systemPrompt = `${basePrompt}

${editOverlay}
`;

/* ---------- component ---------- */
export default function Edit_ScanpageHome() {
  const { title, recalcWithEdits, addLog } = useScanResults();
  const { dismiss } = useSheets();
  const insets = useSafeAreaInsets();

  const { currentItemId, currentItem, setCurrentItem } = useCurrentScannedItemId();

  // 🔐 current user id (safe fallback)
  const auth = getAuth();
  const userId = auth?.currentUser?.uid || "anon";

  /* ---------- local UI state ---------- */
  const [details, setDetails] = useState(title || "");
  const [unit, setUnit] = useState("g");           // "g" | "oz" | "ml" | "piece" | "spoon"
  const [quantity, setQuantity] = useState("100"); // numeric string
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [updating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (title) setDetails(title);
  }, [title]);

  const animation = useRef(null);

  const itemsFromText = useMemo(() => parseFreeformToItems(details), [details]);

  const onChangeQty = (txt) => {
    const cleaned = String(txt).replace(/[^\d.,]/g, "");
    setQuantity(cleaned);
  };

  const qtyNumber = useMemo(() => {
    const n = Number(String(quantity).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.max(0, Math.min(5000, n));
  }, [quantity]);

  const exampleChips = useMemo(() => {
    switch (unit) {
      case "piece":
        return [
          { label: "½ piece", value: "0.5" },
          { label: "1 piece", value: "1" },
          { label: "2 pieces", value: "2" },
        ];
      case "g":
        return [
          { label: "100 g", value: "100" },
          { label: "250 g", value: "250" },
          { label: "500 g", value: "500" },
        ];
      case "ml":
        return [
          { label: "150 ml", value: "150" },
          { label: "250 ml", value: "250" },
          { label: "330 ml", value: "330" },
        ];
      case "oz":
        return [
          { label: "3.5 oz", value: "3.5" },
          { label: "8 oz", value: "8" },
          { label: "12 oz", value: "12" },
        ];
      case "spoon":
        return [
          { label: "½ spoon", value: "0.5" },
          { label: "1 spoon", value: "1" },
          { label: "2 spoons", value: "2" },
        ];
      default:
        return [];
    }
  }, [unit]);

  // Prevent redundant calls
  const lastHashRef = useRef("");
  const buildHash = (o) => JSON.stringify(o);

  /* --------- merge helpers (arrays & objects) ---------- */
  const mergeIngredients = (oldArr = [], newArr = []) => {
    const byKey = (x) => norm(x?.name || "");
    const map = new Map();
    (oldArr || []).forEach((r) => map.set(byKey(r), { ...r }));
    (newArr || []).forEach((r) => {
      const k = byKey(r);
      if (!k) return;
      const prev = map.get(k) || {};
      map.set(k, {
        ...prev,
        name: sText(r?.name, prev?.name || ""),
        estimated_grams: nn(r?.estimated_grams) ? r.estimated_grams : prev?.estimated_grams ?? null,
        kcal_per_100g: nn(r?.kcal_per_100g) ? r.kcal_per_100g : prev?.kcal_per_100g ?? null,
        estimated_kcal: nn(r?.estimated_kcal) ? r.estimated_kcal : prev?.estimated_kcal ?? null,
        assumed: nn(r?.assumed) ? !!r.assumed : !!prev?.assumed,
      });
    });
    const seen = new Set((oldArr || []).map((r) => byKey(r)));
    const ordered = [
      ...(oldArr || []).map((r) => map.get(byKey(r))),
      ...(newArr || []).filter((r) => !seen.has(byKey(r))).map((r) => map.get(byKey(r))),
    ].filter(Boolean);
    return ordered.map((r, i) => ({ ...r, index: i + 1 }));
  };

  const unionAlternatives = (oldObj = {}, newObj = {}) => {
    const oldSame = Array.isArray(oldObj.same_brand) ? oldObj.same_brand : [];
    const oldOther = Array.isArray(oldObj.other_brands) ? oldObj.other_brands : [];
    const newSame = Array.isArray(newObj.same_brand) ? newObj.same_brand : [];
    const newOther = Array.isArray(newObj.other_brands) ? newObj.other_brands : [];
    const key = (a) => [sText(a?.brand, ""), sText(a?.name, ""), sText(a?.flavor_or_variant, "")].map(norm).join("|");
    const put = (arr, map) => arr.forEach((a) => {
      const k = key(a); if (!k) return;
      const prev = map.get(k) || {};
      map.set(k, {
        ...prev,
        brand: sText(a?.brand, prev.brand || ""),
        name: sText(a?.name, prev.name || ""),
        flavor_or_variant: sText(a?.flavor_or_variant, prev.flavor_or_variant || ""),
        calories_per_package_kcal: Number.isFinite(+a?.calories_per_package_kcal) ? +a.calories_per_package_kcal : (Number.isFinite(+prev.calories_per_package_kcal) ? +prev.calories_per_package_kcal : null),
        bucket: ["lower", "similar", "higher"].includes(a?.bucket) ? a.bucket : (prev.bucket || "similar"),
      });
    });
    const m1 = new Map(), m2 = new Map();
    put(oldSame, m1); put(newSame, m1); put(oldOther, m2); put(newOther, m2);
    const same_brand = Array.from(m1.values());
    const other_brands = Array.from(m2.values());
    return {
      base_brand: sText(newObj?.base_brand, oldObj?.base_brand || ""),
      same_brand,
      other_brands,
      summary_by_bucket: {
        lower: [...same_brand, ...other_brands].filter((x) => x.bucket === "lower").length,
        similar: [...same_brand, ...other_brands].filter((x) => x.bucket === "similar").length,
        higher: [...same_brand, ...other_brands].filter((x) => x.bucket === "higher").length,
        total: same_brand.length + other_brands.length,
      },
    };
  };

  const dedupeAltFlat = (oldArr = [], newArr = []) => {
    const key = (p) => [sText(p?.label, ""), sText(p?.amt, ""), sText(p?.moreOrLess, "")].map(norm).join("|");
    const map = new Map();
    (oldArr || []).forEach((p) => map.set(key(p), p));
    (newArr || []).forEach((p) => map.set(key(p), p));
    return Array.from(map.values());
  };

  /* ---------- fallbacks to create ingredient rows if model forgot ---------- */
  const tsp = 5; // ml
  const makeSyntheticIngredientRow = (add, updatedItems = []) => {
    const name = tc(sText(add?.name, "Added ingredient"));
    const n = norm(name);
    const qty = Number(add?.quantity) || 1;
    const serv = Number(add?.servings) || 1;
    const amount = qty * serv;

    // 1) Prefer model's item calories if present
    const item = (updatedItems || []).find((it) => norm(it?.name) === n);
    const itemKcal = Number.isFinite(+item?.calories_kcal) ? Math.round(+item.calories_kcal) : null;
    if (itemKcal != null) {
      return {
        index: 999,
        name,
        estimated_grams: null,
        kcal_per_100g: null,
        estimated_kcal: itemKcal,
        assumed: true,
      };
    }

    // 2) Lightweight heuristics
    let estimated_grams = null;
    let kcal_per_100g = null;
    let estimated_kcal = null;

    const setFrom = (grams, kcal100) => {
      estimated_grams = grams;
      kcal_per_100g = kcal100;
      estimated_kcal = Math.round((grams * kcal100) / 100);
    };

    switch (add?.unit) {
      case "spoon": {
        // teaspoon defaults
        if (n.includes("sugar")) setFrom(4 * amount, 387);
        else if (n.includes("oil")) setFrom(4.5 * amount, 884);
        else if (n.includes("butter") || n.includes("ghee")) setFrom(4.7 * amount, 717);
        else setFrom(5 * amount, 250); // generic sweetener/syrup-ish
        break;
      }
      case "piece": {
        if (n.includes("egg")) {
          estimated_grams = 50 * amount;
          estimated_kcal = Math.round(70 * amount);
          kcal_per_100g = Math.round((estimated_kcal / estimated_grams) * 100); // ~140
        } else {
          // generic piece ~100 kcal if unknown
          estimated_grams = null;
          kcal_per_100g = null;
          estimated_kcal = Math.round(100 * amount);
        }
        break;
      }
      case "ml": {
        if (n.includes("milk")) setFrom(amount, 62);
        else if (n.includes("cream")) setFrom(amount, 340);
        else setFrom(amount, 50);
        break;
      }
      case "g": {
        if (n.includes("sugar")) setFrom(amount, 387);
        else if (n.includes("oil")) setFrom(amount, 884);
        else setFrom(amount, 250);
        break;
      }
      case "oz": {
        const grams = amount * 28.3495;
        if (n.includes("sugar")) setFrom(grams, 387);
        else if (n.includes("oil")) setFrom(grams, 884);
        else setFrom(grams, 250);
        break;
      }
      default: {
        estimated_grams = null;
        kcal_per_100g = null;
        estimated_kcal = Math.round(100 * amount);
      }
    }

    return {
      index: 999,
      name,
      estimated_grams: Number.isFinite(+estimated_grams) ? +estimated_grams : null,
      kcal_per_100g: Number.isFinite(+kcal_per_100g) ? +kcal_per_100g : null,
      estimated_kcal: Number.isFinite(+estimated_kcal) ? +estimated_kcal : null,
      assumed: true,
    };
  };

  const ensureAddedIngredientsInArray = (baseArr, upArr, additions, updatedItems) => {
    const have = new Set(
      [...(baseArr || []), ...(upArr || [])].map((r) => norm(r?.name || ""))
    );
    const missingRows = (additions || [])
      .filter((a) => !have.has(norm(a?.name || "")))
      .map((a) => makeSyntheticIngredientRow(a, updatedItems));
    return [...(upArr || []), ...missingRows];
  };

  /* ---------- recalc helper (ONLY called by button) ---------- */
  async function doRecalc() {
    const additions = (itemsFromText.length ? itemsFromText : [{ name: tc(details || "") }]).map((it) => ({
      name: sText(it?.name, "Item"),
      unit,
      quantity: qtyNumber !== null ? qtyNumber : 1,
      servings,
    }));

    const overrides = {
      // IMPORTANT: we DO NOT pass a new title here. We only pass additions.
      add_ingredients: additions,
      request_alternatives: true,
      unit,
      servings,
      // Provide current state to the model so it can add on top
      existing_result: currentItem?.result || null,
      existing_ingredients_full: Array.isArray(currentItem?.ingredients_full) ? currentItem.ingredients_full : [],
      existing_items: Array.isArray(currentItem?.items) ? currentItem.items : [],
    };

    const nextHash = buildHash(overrides);
    if (nextHash === lastHashRef.current) {
      addLog?.("EditSheet: skipped recalculation (same inputs)");
      return;
    }
    lastHashRef.current = nextHash;

    try {
      setLoading(true);
      addLog?.("EditSheet: RECALCULATE pressed");

      if (!currentItemId || !currentItem) {
        Alert.alert("No item", "Nothing to update. Try scanning again.");
        return;
      }

      // 1) Model call with explicit merge context (same prompt as camera + overlay)
      const updated = await recalcWithEdits({
        openAiApiKey: OPENAI_API_KEY_FALLBACK,
        systemPrompt, // base + editOverlay
        overrides,
      });

      // We DO NOT change title/brand in UI.
      // if (updated?.title) setDetails(updated.title); // ← intentionally omitted

      // 2) Normalize arrays from model (ingredients only)
      const upIngredients = Array.isArray(updated?.ingredients_full)
        ? updated.ingredients_full.map((r, i) => ({
            index: Number.isFinite(+r?.index) ? +r.index : i + 1,
            name: sText(r?.name, ""),
            estimated_grams: nn(r?.estimated_grams) ? +r.estimated_grams : null,
            kcal_per_100g: nn(r?.kcal_per_100g) ? +r.kcal_per_100g : null,
            estimated_kcal: nn(r?.estimated_kcal) ? +r.estimated_kcal : null,
            assumed: !!r?.assumed,
          }))
        : [];

      // 🔥 Ensure every user-added ingredient is present even if the model forgot it
      const upIngredientsPlus = ensureAddedIngredientsInArray(
        currentItem?.ingredients_full || [],
        upIngredients,
        additions,
        Array.isArray(updated?.items) ? updated.items : []
      );

      // 3) MERGE with existing (do not wipe anything)
      const base = currentItem || {};
      const mergedIngredients = mergeIngredients(base?.ingredients_full || [], upIngredientsPlus);

      const ingredients_kcal_list = mergedIngredients.map((r) => ({
        name: r.name,
        kcal: Number(r.estimated_kcal) || 0,
      }));
      const ingredients_kcal_map = Object.fromEntries(
        mergedIngredients.map((r) => [norm(r.name), Number(r.estimated_kcal) || 0])
      );

      // 4) Build patch (macros + totals from model, but keep title/brand/items)
      const patch = {};
      const maybeNum = (n) => (Number.isFinite(+n) ? +n : undefined);

      // NEVER set patch.title or patch.brand — locked.

      const cals = maybeNum(updated?.calories_kcal_total);
      if (Number.isFinite(cals)) patch.calories_kcal_total = cals;
      const prot = maybeNum(updated?.protein_g);  if (Number.isFinite(prot)) patch.protein_g = prot;
      const fat  = maybeNum(updated?.fat_g);      if (Number.isFinite(fat))  patch.fat_g = fat;
      const sug  = maybeNum(updated?.sugar_g);    if (Number.isFinite(sug))  patch.sugar_g = sug;
      const carb = maybeNum(updated?.carbs_g);    if (Number.isFinite(carb)) patch.carbs_g = carb;
      const fib  = maybeNum(updated?.fiber_g);    if (Number.isFinite(fib))  patch.fiber_g = fib;
      const sod  = maybeNum(updated?.sodium_mg);  if (Number.isFinite(sod))  patch.sodium_mg = sod;
      const hs   = maybeNum(updated?.health_score); if (Number.isFinite(hs)) patch.health_score = hs;

      if (isNEA(mergedIngredients)) {
        patch.ingredients_full = mergedIngredients;
        patch.ingredients_kcal_list = ingredients_kcal_list;
        patch.ingredients_kcal_map = ingredients_kcal_map;
      }

      // Keep items unchanged during edits
      // patch.items NOT set on purpose

      // Merge alternatives safely (optional)
      const upAltsObj = Array.isArray(updated?.alternatives)
        ? { same_brand: [], other_brands: updated.alternatives }
        : (updated?.alternatives || {});
      const mergedAlts = unionAlternatives(base?.alternatives || {}, upAltsObj);
      if (mergedAlts && (isNEA(mergedAlts.same_brand) || isNEA(mergedAlts.other_brands))) {
        patch.alternatives = mergedAlts;
      }

      patch.edited_overrides = {
        // store what user entered (for audit/debug)
        items: itemsFromText,
        unit,
        servings,
        quantity: qtyNumber !== null ? qtyNumber : null,
      };

      if (updated && Object.keys(updated).length) {
        patch.updated_raw = JSON.stringify(updated);
        patch.result = {
          ...(base.result || {}),
          ...updated,
          title: base.title,          // lock
          brand: base.brand ?? "",    // lock
          ingredients_full: mergedIngredients, // keep result aligned with saved merge
        };
      }
      patch.updated_at = serverTimestamp();

      const db = getFirestore();

      // 5) Save patch to all three places (merge)
      try {
        await setDoc(doc(db, "users", userId, "RecentlyEaten", currentItemId), patch, { merge: true });
        addLog?.(`EditSheet: merged → RecentlyEaten/${currentItemId}`);
      } catch (err) {
        addLog?.(`[ERR] Firestore merge (RecentlyEaten): ${err?.message || err}`);
      }

      try {
        const dateId = localDateId();
        await setDoc(doc(db, "users", userId, "Today", dateId, "List", currentItemId), patch, { merge: true });
        addLog?.(`EditSheet: merged → Today/${dateId}/List/${currentItemId}`);
      } catch (err) {
        addLog?.(`[ERR] Firestore merge (Today): ${err?.message || err}`);
      }

      try {
        await setDoc(doc(db, "users", userId, "AllTimeLineScan", currentItemId), patch, { merge: true });
        addLog?.("EditSheet: merged → AllTimeLineScan/{currentItemId}");
      } catch (err) {
        addLog?.(`[ERR] Firestore merge (AllTimeLineScan): ${err?.message || err}`);
      }

      // 6) Update local context copy so UI shows merged result immediately
      const mergedForState = {
        ...(base || {}),
        ...patch,
        // explicitly keep existing title/brand/items
        title: base.title,
        brand: base.brand,
        items: base.items,
      };
      setCurrentItem?.(mergedForState);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Network request failed/i.test(msg)) {
        Alert.alert("Network error", "Couldn’t reach the nutrition service. Please try again.");
      } else {
        Alert.alert("Recalculate failed", msg);
      }
      addLog?.(`[ERR] EditSheet recalc/save: ${msg}`);
    } finally {
      setLoading(false);
      dismiss?.("s6");
    }
  }

  /* ---------- servings +/- DO NOT trigger recalc ---------- */
  const dec = () => setServings((s) => Math.max(1, s - 1));
  const inc = () => setServings((s) => Math.min(99, s + 1));

  /* ---------- UI ---------- */
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ height: height(100), width: "100%", backgroundColor: "#fff" }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: height(28) + (insets?.bottom ?? 0) }}
          bounces
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>Edit Scan</Text>

          {/* freeform description */}
          <Text style={styles.labelTop}>Enter detailed version of your food</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="e.g., add 2 spoon vanilla sugar"
            autoCapitalize="none"
            autoCorrect
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={styles.input}
          />

          {/* unit selector */}
          <View style={styles.row}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.label}>Unit</Text>
              <TouchableOpacity
                onPress={() => setShowGuide((v) => !v)}
                style={styles.guideToggle}
                activeOpacity={0.8}
              >
                <Info size={14} color="#111" />
                <Text style={styles.guideToggleText}>How units work</Text>
                {showGuide ? <ChevronUp size={14} color="#111" /> : <ChevronDown size={14} color="#111" />}
              </TouchableOpacity>
            </View>

            <View style={styles.chipsWrap}>
              {["g", "oz", "ml", "piece", "spoon"].map((u) => {
                const active = unit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {showGuide && (
              <View style={styles.guideCard}>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>Piece</Text> = one whole item (1 sandwich, 1 egg). Use decimals for halves (e.g., <Text style={styles.bold}>0.5</Text> piece).
                </Text>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>g / oz</Text> = foods measured by weight.
                </Text>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>ml</Text> = liquids (drinks, soups, smoothies).
                </Text>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>spoon</Text> = teaspoon by default (~5 ml). Typical: sugar ≈ 4 g/tsp.
                </Text>
              </View>
            )}
          </View>

          {/* quantity + quick examples */}
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TextInput
                value={quantity}
                onChangeText={onChangeQty}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "number-pad"}
                placeholder={unit === "piece" ? "1" : unit === "oz" ? "3.5" : unit === "spoon" ? "1" : "100"}
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.smallInput}
              />
              <Text style={styles.suffix}>
                {unit === "piece" || unit === "spoon" ? (Number(quantity) === 1 ? unit : `${unit}s`) : unit}
              </Text>
            </View>

            <View style={styles.examplesWrap}>
              {exampleChips.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => setQuantity(c.value)}
                  style={styles.exampleChip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exampleChipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {qtyNumber === null && (
              <Text style={{ marginTop: 6, color: "#EF4444" }}>
                Please enter a valid number (e.g., 500 or 3.5).
              </Text>
            )}
          </View>

          {/* servings stepper */}
          <View style={styles.row}>
            <Text style={styles.label}>Servings</Text>

            <View style={styles.stepper}>
              <TouchableOpacity onPress={dec} disabled={updating} style={styles.stepperBtn}>
                <Minus size={16} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.stepperCount}>{servings}</Text>

              <TouchableOpacity
                onPress={inc}
                disabled={updating}
                style={[styles.stepperBtn, styles.stepperBtnLight]}
              >
                <Plus size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && (
            <LottieView
              autoPlay
              ref={animation}
              loop
              style={{ width: 200, height: 200, alignSelf: "center", marginTop: height(2) }}
              source={require("../../../../../assets/Loading_Lottie/Loading_2.json")}
            />
          )}
        </ScrollView>

        {/* CTA */}
        <TouchableOpacity
          disabled={loading}
          onPress={() => {
            Keyboard.dismiss();
            doRecalc();
          }}
          style={[
            styles.primaryCta,
            { opacity: loading ? 0.65 : 1, bottom: height(11) + (insets?.bottom ?? 0) },
          ]}
        >
          {loading ? (
            <LottieView
              autoPlay
              ref={animation}
              loop
              style={{ width: size(55), height: size(55) }}
              source={require("../../../../../assets/Loading_Lottie/Loading_2.json")}
            />
          ) : (
            <Text style={styles.primaryCtaText}>Recalculate</Text>
          )}
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            dismiss?.("s6");
          }}
          style={[styles.backPill, { bottom: height(11) + (insets?.bottom ?? 0) }]}
        >
          <ArrowLeft size={20} color={"#fff"} style={{ marginRight: width(2) }} />
          <Text style={{ color: "#fff", fontSize: size(17), fontWeight: "bold" }}>Back</Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  header: {
    fontSize: size(30),
    fontWeight: "700",
    marginLeft: width(5),
    marginTop: height(5),
  },
  labelTop: {
    marginLeft: width(5),
    marginTop: height(5),
    marginBottom: height(2),
    fontWeight: "700",
    fontSize: size(15),
  },
  input: {
    height: size(50),
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    width: "90%",
    alignSelf: "center",
    borderColor: "#E5EAF0",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1, shadowColor: "#00000030" },
    }),
  },

  row: {
    width: "90%",
    alignSelf: "center",
    marginTop: height(3),
    marginBottom: height(1),
  },
  label: {
    fontWeight: "700",
    fontSize: size(14),
    marginBottom: 8,
  },

  chipsWrap: { flexDirection: "row", gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: height(1),
    marginBottom: height(1),
    borderWidth: 1,
    borderColor: "#E5EAF0",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontWeight: "700", color: "#111" },
  chipTextActive: { color: "#fff" },

  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F7FB",
  },
  guideToggleText: { fontSize: size(12), fontWeight: "700", color: "#111" },

  guideCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAEFF5",
    backgroundColor: "#F5F7FB",
    gap: 6,
  },
  guideLine: { color: "#4B5563", lineHeight: 20 },
  bold: { fontWeight: "700", color: "#111" },

  smallInput: {
    height: size(46),
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    width: "45%",
    borderColor: "#E5EAF0",
    backgroundColor: "#fff",
  },
  suffix: {
    fontSize: size(16),
    marginLeft: width(3),
    color: "#6B7280",
  },

  examplesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: height(2),
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F7FB",
    borderWidth: 1,
    borderColor: "#E5EAF0",
  },
  exampleChipText: { fontWeight: "700", color: "#111" },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  stepperBtn: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnLight: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111",
  },
  stepperCount: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },

  primaryCta: {
    position: "absolute",
    right: width(5),
    alignSelf: "flex-end",
    height: size(58),
    borderRadius: 18,
    backgroundColor: "#000",
    width: width(40),
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6.65,
    elevation: 12,
    zIndex: 1000,
  },
  primaryCtaText: { color: "#fff", fontSize: size(17), fontWeight: "bold" },

  backPill: {
    position: "absolute",
    left: width(5),
    alignSelf: "flex-end",
    height: size(58),
    width: width(40),
    borderRadius: 18,
    backgroundColor: "#151515",
    paddingHorizontal: size(40),
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6.65,
    elevation: 12,
    zIndex: 1000,
  },
});
