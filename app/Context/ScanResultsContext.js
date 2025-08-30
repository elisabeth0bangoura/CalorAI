// app/Context/ScanResultsContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ScanResultsContext = createContext(null);

/* ---------- Lucide icon safety (names we allow from the model) ---------- */
const LUCIDE_SAFE = new Set([
  "Utensils",
  "Apple",
  "Banana",
  "Bread",
  "Cheese",
  "Cookie",
  "Candy",
  "Coffee",
  "Egg",
  "Fish",
  "Milk",
  "Pizza",
  "Sandwich",
  "Salad",
  "Carrot",
  "Drumstick",
  "CupSoda",
  "Avocado",
  "IceCream",
]);
const safeIconName = (s) =>
  typeof s === "string" && LUCIDE_SAFE.has(s.trim()) ? s.trim() : "Utensils";

/* ---------- tiny helpers ---------- */
const num = (n, d = 0) => {
  if (n && typeof n === "object") {
    const low = Number(n.low);
    const high = Number(n.high);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2);
    }
  }
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v : d;
};
const str = (s, d = "") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;

/* ---------- deterministic client-side scaling fallback ---------- */
function scaleByServings(model, servings) {
  const mult = Number.isFinite(servings) && servings > 0 ? servings : 1;
  if (!model || typeof model !== "object" || mult === 1) return model;

  const clone = { ...model };

  const keys = [
    "calories_kcal_total",
    "protein_g",
    "fat_g",
    "sugar_g",
    "carbs_g",
    "fiber_g",
    "sodium_mg",
  ];
  keys.forEach((k) => {
    if (clone[k] != null) clone[k] = Math.round(num(clone[k], 0) * mult);
  });

  if (Array.isArray(clone.items)) {
    clone.items = clone.items.map((it) => ({
      ...it,
      calories_kcal: Math.round(num(it?.calories_kcal, 0) * mult),
    }));
  }

  return clone;
}

/* ---------- simple fallback alternatives (always fewer kcal) ---------- */
const FRUIT_KCAL = {
  apple: 95,
  banana: 105,
  mango: 200,
  orange: 62,
  peach: 58,
  pear: 101,
  strawberries: 53,
  watermelon: 46,
};
function pickBaseFruitFromTitle(title = "") {
  const t = title.toLowerCase();
  for (const k of Object.keys(FRUIT_KCAL)) {
    if (t.includes(k)) return k;
  }
  if (t.includes("fruit")) return "apple";
  return null;
}
function fallbackAlternatives(title = "", totalKcal = 0) {
  const base = pickBaseFruitFromTitle(title) || "apple";
  const baseKcal =
    Number.isFinite(totalKcal) && totalKcal > 0 ? totalKcal : FRUIT_KCAL[base] || 95;

  const candidates = [
    "banana",
    "mango",
    "orange",
    "peach",
    "pear",
    "strawberries",
    "watermelon",
    "apple",
  ];

  const seen = new Set();
  const list = [];
  for (const name of candidates) {
    if (seen.has(name)) continue;
    seen.add(name);
    const kcal = FRUIT_KCAL[name];
    if (!kcal) continue;
    const pretty = name.charAt(0).toUpperCase() + name.slice(1);
    const diff = Math.round(kcal - baseKcal);
    if (diff < 0) list.push({ name: pretty, calories_diff: diff });
  }

  list.sort((a, b) => Math.abs(a.calories_diff) - Math.abs(b.calories_diff));
  return list.slice(0, 6);
}

/* ---------- best-before parsing & note helpers ---------- */

// Parse common date strings into ISO "YYYY-MM-DD"
function parseBestBeforeToISO(text = "") {
  const s = String(text);

  // 19.02.2026 or 19-02-2026 or 19/02/2026  -> DMY
  let m = s.match(/(\b\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    const pad = (n) => String(n).padStart(2, "0");
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
  }

  // 2026-02-19  -> ISO already
  m = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m) return m[0];

  return null;
}

// Simple brand/package hints
const BRAND_HINTS = [
  {
    test: (t) => /nongshim|shin ramyun|ramen|noodles?/i.test(t),
    note:
      "Tip: Best-before is ink-jet printed on an edge or near the importer text. Look for “Best before / MHD / BBD / EXP” or Italian “DA CONSUMARSI PREFERIBILMENTE ENTRO IL”. Capture that corner in the photo.",
  },
  {
    test: (t) => /yogurt|milk|dairy|joghurt|yoghurt/i.test(t),
    note:
      "Tip: Date is usually stamped on the lid or top rim. Look for “MHD / Use by / Exp”.",
  },
  {
    test: (t) => /bread|rolls?|buns?|bakery/i.test(t),
    note:
      "Tip: Date is often on a small tag or sticker on the bag’s clip, sometimes on the bag seam.",
  },
  {
    test: (t) => /canned|tin|beans|tomato|soup/i.test(t),
    note:
      "Tip: Find the laser-etched date on the can’s bottom or near the top rim (EXP/BBD).",
  },
];

// Fallback if no brand rule matched
const DEFAULT_EXP_NOTE =
  "Tip: Look for “Best before / MHD / BBD / EXP” printed on an edge, the back near the barcode, or the bottom. Please include the date area in the photo.";

// Choose a note from title/brand keywords
function makeExpirationNote(title = "") {
  const t = String(title || "").toLowerCase();
  for (const r of BRAND_HINTS) {
    if (r.test(t)) return r.note;
  }
  return DEFAULT_EXP_NOTE;
}

/* Trim previous result to keep requests small & stable */
function trimModelForPrompt(prevResult, prevItems) {
  const base = prevResult && typeof prevResult === "object" ? prevResult : {};
  const items = Array.isArray(base.items)
    ? base.items
    : Array.isArray(prevItems)
    ? prevItems
    : [];

  return {
    title: str(base.title, ""),
    calories_kcal_total: num(base.calories_kcal_total, 0),
    protein_g: num(base.protein_g, 0),
    fat_g: num(base.fat_g, 0),
    sugar_g: num(base.sugar_g, 0),
    carbs_g: num(base.carbs_g, 0),
    fiber_g: num(base.fiber_g, 0),
    sodium_mg: num(base.sodium_mg, 0),
    health_score: num(base.health_score, 0),
    items: items.map((it) => ({
      name: str(it?.name, ""),
      subtitle: str(it?.subtitle, ""),
      calories_kcal: num(it?.calories_kcal, 0),
      icon: safeIconName(it?.icon),
    })),
  };
}

/* ---------- NEW: macro → kcal split helper (EU fiber ~2 kcal/g) ---------- */
function computeKcalSplit({ fat_g = 0, carbs_g = 0, protein_g = 0, fiber_g = 0, scheme = "EU" }) {
  const fatK = num(fat_g, 0) * 9;
  const carbK = num(carbs_g, 0) * 4;
  const protK = num(protein_g, 0) * 4;
  const fiberK = scheme === "EU" ? num(fiber_g, 0) * 2 : 0;
  const total = fatK + carbK + protK + fiberK;
  const pct = total
    ? {
        fat: (fatK / total) * 100,
        carbs: (carbK / total) * 100,
        protein: (protK / total) * 100,
        fiber: (fiberK / total) * 100,
      }
    : { fat: 0, carbs: 0, protein: 0, fiber: 0 };
  return {
    fatK: Math.round(fatK),
    carbK: Math.round(carbK),
    protK: Math.round(protK),
    fiberK: Math.round(fiberK),
    total: Math.round(total),
    pct,
  };
}

export function ScanResultsProvider({ children }) {
  // camera + networking
  const [imageUrl, setImageUrl] = useState(null); // local file:// from camera
  const [cloudUrl, setCloudUrl] = useState(null); // Firebase download URL
  const [result, setResult] = useState(null); // full parsed JSON from OpenAI / OFF
  const [raw, setRaw] = useState(null); // raw model content text
  const [logs, setLogs] = useState([]); // string[] timeline for debug

  // time the scan happened (ISO string, local device time)
  const [scannedAt, setScannedAt] = useState(null);

  // per-ingredient items for the FlatList: [{ name, subtitle, calories_kcal, icon }]
  const [list, setList] = useState([]);

  
  // extracted nutrition fields
  const [title, setTitle] = useState(null);
  const [calories, setCalories] = useState(null);
  const [protein, setProtein] = useState(null);
  const [fat, setFat] = useState(null);
  const [sugar, setSugar] = useState(null);
  const [carbs, setCarbs] = useState(null);
  const [fiber, setFiber] = useState(null);
  const [sodium, setSodium] = useState(null);
  const [healthScore, setHealthScore] = useState(null);

  // alternatives (only fewer calories): [{ name, calories_diff }]
  const [alternatives, setAlternatives] = useState([]);
 const [scanBusy, setScanBusy] = useState(false);

  // NEW: macro→kcal split and ingredients breakdown (layer list with grams/kcal)
  const [kcalSplit, setKcalSplit] = useState(null);
  const [ingredientsBreakdown, setIngredientsBreakdown] = useState(null);
  // expected structure:
  // {
  //   serving_g: number,
  //   total_kcal_label: number,
  //   ingredients: [{ name, pct, grams, kcal }]
  // }

  // NEW: expiration date & note
  const [expirationDate, setExpirationDate] = useState(null); // "YYYY-MM-DD" or null
  const [expirationDateNote, setExpirationDateNote] = useState("");

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev, `${new Date().toISOString()}  ${msg}`]);
  }, []);

  // Stamp time when a new image is set (first time only)
  useEffect(() => {
    if (imageUrl && !scannedAt) setScannedAt(new Date().toISOString());
  }, [imageUrl, scannedAt]);

  const markScannedNow = useCallback(() => {
    setScannedAt(new Date().toISOString());
  }, []);

  // Locale-aware formatter (German by default, with “Uhr”)
  const formatScannedAt = useCallback(
    (opts = {}) => {
      if (!scannedAt) return "";
      const {
        locale = "de-DE",
        hour12 = false,
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
        appendUhr = locale.startsWith("de"),
      } = opts;
      const d = new Date(scannedAt);
      const s = new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12,
        timeZone,
      })
        .format(d)
        .replace(/,\s?/, " ");
      return appendUhr ? `${s} Uhr` : s;
    },
    [scannedAt]
  );


   const beginScan = () => setScanBusy(true);
 const endScan   = () => setScanBusy(false);

  const resetScan = useCallback(() => {
    setImageUrl(null);
    setCloudUrl(null);
    setResult(null);
    setRaw(null);
    setLogs([]);
    setList([]);
    setTitle(null);
    setCalories(null);
    setProtein(null);
    setFat(null);
    setSugar(null);
    setCarbs(null);
    setFiber(null);
    setSodium(null);
    setHealthScore(null);
    setAlternatives([]);
    setScannedAt(null);
    // reset expiration helpers
    setExpirationDate(null);
    setExpirationDateNote("");
    // reset breakdowns
    setKcalSplit(null);
    setIngredientsBreakdown(null);
  }, []);

  /* ---------- apply a model JSON into state (with guaranteed alternatives) ---------- */
  const applyModelResult = useCallback(
    (model) => {
      if (!model || typeof model !== "object") return;

      const titleSafe = str(model.title, "Scanned meal");
      const kcalSafe = num(model.calories_kcal_total, null);
      const proteinV = num(model.protein_g, 0);
      const fatV = num(model.fat_g, 0);
      const sugarV = num(model.sugar_g, 0);
      const carbsV = num(model.carbs_g, 0);
      const fiberV = num(model.fiber_g, 0);
      const sodiumV = num(model.sodium_mg, 0);
      let healthV = num(model.health_score, 0);
      if (healthV < 0) healthV = 0;
      if (healthV > 10) healthV = 10;

      setTitle(titleSafe);
      setCalories(kcalSafe);
      setProtein(proteinV);
      setFat(fatV);
      setSugar(sugarV);
      setCarbs(carbsV);
      setFiber(fiberV);
      setSodium(sodiumV);
      setHealthScore(healthV);

      // items with safe icons
      const items = Array.isArray(model.items) ? model.items : [];
      const itemsSafe = items.map((it) => ({
        name: str(it?.name, "Item"),
        subtitle: str(it?.subtitle, ""),
        calories_kcal: num(it?.calories_kcal, 0),
        icon: safeIconName(it?.icon),
      }));
      setList(itemsSafe);

      // alternatives — ensure at least some valid negative diffs
      const alts = Array.isArray(model.alternatives) ? model.alternatives : [];
      let altsSafe = alts
        .map((a) => ({
          name: str(a?.name, ""),
          calories_diff: num(a?.calories_diff, 0),
        }))
        .filter((a) => a.name && a.calories_diff < 0);

      if (!altsSafe.length) {
        altsSafe = fallbackAlternatives(
          titleSafe,
          num(model.calories_kcal_total, 0)
        );
      }
      setAlternatives(altsSafe);

      // NEW: macro→kcal split (prefer model.kcal_split; else compute)
      const modelSplit = model?.kcal_split;
      if (modelSplit && typeof modelSplit === "object") {
        setKcalSplit(modelSplit);
      } else {
        setKcalSplit(
          computeKcalSplit({
            fat_g: fatV,
            carbs_g: carbsV,
            protein_g: proteinV,
            fiber_g: fiberV,
            scheme: "EU",
          })
        );
      }

      // NEW: ingredients breakdown/layers (prefer model.layer_breakdown)
      const lb = model?.layer_breakdown;
      setIngredientsBreakdown(
        lb && typeof lb === "object" ? lb : null
      );

      // NEW: set a context note to help the user capture the printed date
      setExpirationDateNote(makeExpirationNote(titleSafe));

      // keep original timestamp; if none yet (first ever apply), set it now
      if (!scannedAt) setScannedAt(new Date().toISOString());
    },
    [scannedAt]
  );

  /* ---- request control: cancel previous + dedupe identical payloads ---- */
  const inFlightRef = useRef(null); // AbortController
  const lastHashRef = useRef(""); // string

  const hashOverrides = (o) => {
    const slim = {
      title: o?.title ?? null,
      items: Array.isArray(o?.items)
        ? o.items.map((it) => ({
            name: str(it?.name, ""),
            subtitle: str(it?.subtitle, ""),
          }))
        : null,
      unit: o?.unit ?? null,
      quantity: o?.quantity ?? null,
      servings: o?.servings ?? null,
      request_alternatives: !!o?.request_alternatives,
    };
    return JSON.stringify(slim);
  };

  /* ----------
     Recalculate with user edits using OpenAI
  ---------- */
  const recalcWithEdits = useCallback(
    async ({ openAiApiKey, overrides }) => {
      if (!openAiApiKey) throw new Error("Missing OpenAI API key");

      // Deduplicate
      const h = hashOverrides(overrides || {});
      if (h === lastHashRef.current) {
        addLog("Recalc skipped (same overrides)");
        return result;
      }
      lastHashRef.current = h;

      // Cancel previous request
      try {
        inFlightRef.current?.abort?.();
      } catch {}
      const controller = new AbortController();
      inFlightRef.current = controller;

      addLog("Recalc started");
      try {
        const systemPrompt = `
You are Nutrition Recalc AI.

INPUTS:
- previous_result: last JSON result (same schema as your output), trimmed for size.
- previous_items: current items we display (name, subtitle, calories_kcal, icon).
- image_url: optional original photo URL.
- overrides: user edits.

APPLY EDITS EXACTLY:
1) If overrides.title present, replace the title (do not append).
2) If overrides.items present, treat it as the authoritative list of components (update names/subtitles; estimate calories_kcal & distribute macros accordingly).
   - Keep icons from the allowed set; if unsure, use "Utensils".
3) If overrides.removeItems present, remove those items by name (case-insensitive).
4) If overrides.unit and overrides.quantity present, interpret total quantity of the MEAL:
   - unit: "g" | "oz" | "ml" | "piece".
   - conversions: 1 oz = 28.3495 g; if density unknown, 1 ml ≈ 1 g.
   - if "piece", infer a typical weight per piece; if unknown assume 100 g.
   - Scale calories and macros accordingly.
5) If overrides.servings present (integer >=1), multiply TOTALS and each item's calories_kcal by that number.
6) Alternatives: if overrides.request_alternatives is true, provide AT LEAST 3 alternatives with FEWER total calories than the FINAL edited meal (post-quantity & post-servings).
   - Set "calories_diff" = (alternative_total_kcal - final_meal_total_kcal) which must be NEGATIVE.
   - If you are unsure, propose lower-calorie fruits (e.g., Orange, Strawberries, Watermelon, Peach) with correctly negative diffs.

OUTPUT STRICT JSON ONLY (no prose):
{
  "title": "string",
  "calories_kcal_total": number,
  "protein_g": number,
  "fat_g": number,
  "sugar_g": number,
  "carbs_g": number,
  "fiber_g": number,
  "sodium_mg": number,
  "health_score": number,     // 0..10
  "items": [
    { "name": "string", "subtitle": "string", "calories_kcal": number, "icon": "string" }
  ],
  "alternatives": [
    { "name": "string", "calories_diff": number }  // negative = fewer calories
  ]
}

ALLOWED ICONS: ${Array.from(LUCIDE_SAFE).join(", ")}.
Return ONLY JSON.
`.trim();

        const trimmedPrev = trimModelForPrompt(result, list);

        const userPayload = {
          previous_result: trimmedPrev,
          previous_items: trimmedPrev.items,
          image_url: cloudUrl || null,
          overrides: overrides || {},
        };

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.2,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [{ type: "text", text: JSON.stringify(userPayload) }],
              },
            ],
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`OpenAI ${res.status}: ${t}`);
        }

        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content || "{}";
        let parsed = JSON.parse(text);

        // Fallback: enforce servings scaling on the client if provided
        const s = num(overrides?.servings, 1);
        if (s && s !== 1) {
          parsed = scaleByServings(parsed, s);
        }

        // 👇 Ensure alternatives exist even if the model didn't follow instructions
        const altList = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
        const validNeg = altList.filter(
          (a) => str(a?.name, "") && num(a?.calories_diff, 0) < 0
        );
        if (!validNeg.length) {
          parsed.alternatives = fallbackAlternatives(
            str(parsed?.title, trimmedPrev.title),
            num(parsed?.calories_kcal_total, trimmedPrev.calories_kcal_total)
          );
        }

        setResult(parsed);
        setRaw(JSON.stringify(parsed));
        applyModelResult(parsed);
        addLog("Recalc done");
        return parsed;
      } catch (e) {
        if (e?.name === "AbortError") {
          addLog("Recalc aborted (newer request started)");
          return result;
        }
        addLog(`[ERR] Recalc: ${e?.message || e}`);

        // Optional: local UI feedback when the network dies—scale existing result
        const s = num(overrides?.servings, 1);
        if (s && s !== 1 && result) {
          const locallyScaled = scaleByServings(result, s);
          applyModelResult(locallyScaled);
        }

        throw e;
      } finally {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
      }
    },
    [result, list, cloudUrl, applyModelResult, addLog, setResult, setRaw]
  );

  const value = useMemo(
    () => ({
      // raw/networking
      imageUrl,
      setImageUrl,
      cloudUrl,
      setCloudUrl,
      result,
      setResult,
      raw,
      setRaw,
      logs,
      setLogs,
      addLog,
      scanBusy,
      beginScan,
      endScan,
      // scan time
      scannedAt,
      setScannedAt,
      markScannedNow,
      formatScannedAt,

      // items/ingredients list for FlatList
      list,
      setList,

      // nutrition fields
      title,
      setTitle,
      calories,
      setCalories,
      protein,
      setProtein,
      fat,
      setFat,
      sugar,
      setSugar,
      carbs,
      setCarbs,
      fiber,
      setFiber,
      sodium,
      setSodium,
      healthScore,
      setHealthScore,

      // alternatives
      alternatives,
      setAlternatives,

      // NEW: macro→kcal split + ingredients breakdown
      kcalSplit,
      setKcalSplit,
      ingredientsBreakdown,
      setIngredientsBreakdown,

      // expiration helpers (canonical names)
      expirationDate,
      setExpirationDate,
      expirationDateNote,
      setExpirationDateNote,

      // also expose misspelled aliases to be convenient
      experationDate: expirationDate,
      setExperationDate: setExpirationDate,
      experationDateNote: expirationDateNote,
      setExperationDateNote: setExpirationDateNote,

      // quick utilities
      parseBestBeforeToISO,
      makeExpirationNote,

      // lifecycle
      resetScan,

      // actions
      recalcWithEdits,
    }),
    [
      imageUrl,
      cloudUrl,
      result,
      raw,
      logs,
      addLog,
      scannedAt,
      formatScannedAt,
      list,
      title,
      calories,
      protein,
      fat,
      sugar,
      carbs,
      fiber,
      sodium,
      healthScore,
      alternatives,
      expirationDate,
      setExpirationDate,
      // NEW deps
      kcalSplit,
      ingredientsBreakdown,
      expirationDate,
      expirationDateNote,
      resetScan,
      recalcWithEdits,
      markScannedNow,
    ]
  );

  return (
    <ScanResultsContext.Provider value={value}>
      {children}
    </ScanResultsContext.Provider>
  );
}

export function useScanResults() {
  const ctx = useContext(ScanResultsContext);
  if (!ctx)
    throw new Error("useScanResults must be used inside <ScanResultsProvider>");
  return ctx;
}
