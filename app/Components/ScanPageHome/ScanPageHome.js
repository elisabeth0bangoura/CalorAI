/* --- RNFirebase v22 migration helpers (optional) --- */
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;
// globalThis.RNFB_MODULAR_DEPRECATION_STRICT_MODE = true;

import * as Haptics from "expo-haptics";
import * as LucideIcons from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { height, size, width } from "react-native-responsive-sizes";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { useDailyLeft } from "@/app/Context/DailyLeftContext"; // ⬅️ context for optimistic totals
import { useSheets } from "@/app/Context/SheetsContext";

/* ---------- RNFirebase v22 modular imports ---------- */
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "@react-native-firebase/firestore";

import { Image } from "expo-image";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

/* ---------- Collapsing header sizes ---------- */
const HEADER_MAX_HEIGHT = height(45);
const HEADER_MIN_HEIGHT = height(2);
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

/* ---------- Helpers ---------- */
const sText = (v, d = "") => (typeof v === "string" ? v : d);
const sNum = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const toLowerKey = (s = "") => String(s).trim().toLowerCase();
const n = (v) => (Number.isFinite(+v) ? +v : 0);

const dayKeyFrom = (rawTs) => {
  const d = rawTs?.toDate ? rawTs.toDate() : new Date(rawTs || Date.now());
  if (isNaN(d)) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// LOCAL today (device timezone) — matches Home.js listener
const getLocalDayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/* ---------- Heuristic macro inference helpers ---------- */
const KCAL_PER = { protein: 4, carbs: 4, fat: 9 };

/* case-insensitive, word-boundary match helper */
const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const includesAny = (name, list) =>
  list.some((w) => new RegExp(`\\b${regexEscape(w)}\\b`, "i").test(name));

/**
 * Category rules:
 *  - synonyms: list of keywords to match (case-insensitive; uses word boundaries)
 *  - macroFrac: share of total kcal by macro (sums ≤ 1; rest ignored)
 *  - sugarOfCarbs: optional share of carbs that are sugars
 */
const CATEGORY_RULES = [
  // PURE/NEAR-PURE FATS
  {
    key: "oils",
    synonyms: [
      "oil", "olive oil", "extra virgin", "evoo", "coconut oil",
      "avocado oil", "peanut oil", "sesame oil", "sunflower oil",
      "canola", "rapeseed", "ghee", "lard", "tallow", "shortening"
    ],
    macroFrac: { fat: 1.0 },
  },
  {
    key: "butter_mayo",
    synonyms: ["butter", "margarine", "mayo", "mayonnaise", "aioli"],
    macroFrac: { fat: 1.0 },
  },

  // MOSTLY CARBS
  {
    key: "bread_grains",
    synonyms: [
      "bread","toast","bagel","bun","roll","pita","tortilla","wrap","naan",
      "chapati","roti","cracker","rice cake","cereal","oat","oats","oatmeal",
      "flour","polenta","cornbread","barley","quinoa","wheat"
    ],
    macroFrac: { carbs: 0.95 },
    sugarOfCarbs: 0.1,
  },
  {
    key: "pasta_noodles",
    synonyms: [
      "pasta","noodle","noodles","spaghetti","penne","fusilli","macaroni",
      "ramen","udon","soba"
    ],
    macroFrac: { carbs: 0.95 },
    sugarOfCarbs: 0.05,
  },
  {
    key: "rice",
    synonyms: ["rice","risotto","sushi rice","jasmine","basmati","brown rice"],
    macroFrac: { carbs: 0.95 },
    sugarOfCarbs: 0.03,
  },
  {
    key: "potato_fries",
    synonyms: ["potato","fries","chips","hash brown","tater tots","mashed"],
    macroFrac: { carbs: 0.9, fat: 0.1 },
    sugarOfCarbs: 0.05,
  },

  // SWEETS / SUGARS / JUICE
  {
    key: "sugary",
    synonyms: ["sugar","soda","juice","syrup","honey","agave","maple","candy","dessert"],
    macroFrac: { carbs: 1.0 },
    sugarOfCarbs: 0.9,
  },

  // FAT-HEAVY PLANT FOODS
  {
    key: "nuts_seeds",
    synonyms: [
      "almond","walnut","cashew","pistachio","peanut","pecan","hazelnut",
      "sunflower seed","pumpkin seed","chia","flax","sesame","tahini","nut butter"
    ],
    macroFrac: { fat: 0.75, protein: 0.12, carbs: 0.13 },
    sugarOfCarbs: 0.1,
  },
  {
    key: "coconut_flakes",
    synonyms: ["coconut rasp","coconut flakes","desiccated coconut","shredded coconut"],
    macroFrac: { fat: 0.70, carbs: 0.25, protein: 0.05 },
    sugarOfCarbs: 0.15,
  },

  // PROTEIN-LEANING
  {
    key: "meat_fish_eggs",
    synonyms: [
      "chicken","beef","pork","turkey","lamb","steak","ground","ham","bacon",
      "fish","salmon","tuna","shrimp","prawn","egg","eggs"
    ],
    macroFrac: { protein: 0.70, fat: 0.30 },
  },
  {
    key: "soy_dairy_protein",
    synonyms: ["tofu","tempeh","seitan","yogurt","greek yogurt","skyr","cottage","ricotta"],
    macroFrac: { protein: 0.45, carbs: 0.25, fat: 0.30 },
    sugarOfCarbs: 0.4,
  },
  {
    key: "cheese",
    synonyms: ["cheese","cheddar","mozzarella","parmesan","feta","brie","gouda"],
    macroFrac: { fat: 0.60, protein: 0.40 },
  },

  // LOW-CAL VEG
  {
    key: "vegetables",
    synonyms: [
      "lettuce","spinach","kale","broccoli","cauliflower","cabbage","pepper",
      "tomato","cucumber","zucchini","eggplant","mushroom","onion","carrot","celery"
    ],
    macroFrac: { carbs: 0.8, protein: 0.2 },
    sugarOfCarbs: 0.2,
  },
];

const matchCategory = (name) => {
  const nm = toLowerKey(name || "");
  return CATEGORY_RULES.find((r) => includesAny(nm, r.synonyms)) || null;
};

const fillMissingMacrosFrom = (remainKcal, missingKeys, fracMap) => {
  if (remainKcal <= 0 || !missingKeys.length) return { protein: 0, carbs: 0, fat: 0 };
  const partial = {};
  const fracSum = missingKeys.reduce((s, k) => s + (fracMap?.[k] || 0), 0) || 0;
  if (fracSum <= 0) return { protein: 0, carbs: 0, fat: 0 };

  missingKeys.forEach((k) => {
    const share = (fracMap?.[k] || 0) / fracSum;
    const kcalForK = remainKcal * share;
    const grams = kcalForK / KCAL_PER[k];
    partial[k] = Math.max(0, Math.round(grams));
  });
  return { protein: partial.protein || 0, carbs: partial.carbs || 0, fat: partial.fat || 0 };
};

/* ---------- Mini ring ---------- */
const MiniRing = React.memo(function MiniRing({
  value = 0,
  color = "#000",
  radius = 40,
  duration = 800,
  maxValue = 200,
  active = true,
  strokeWidth = 12,
  bumpKey,
}) {
  const safeVal = Number.isFinite(+value) ? +value : 0;
  const safeMax = Math.max(1, Number(maxValue) || 1);
  const DIAMETER = radius * 2;
  const ringColor = active ? color : "#E6ECF2";
  const dur = active ? duration : 0;

  return (
    <View style={{ alignSelf: "center", width: DIAMETER, height: DIAMETER, position: "relative" }}>
      <CircularProgressBase
        key={bumpKey}
        value={safeVal}
        maxValue={safeMax}
        radius={radius}
        duration={dur}
        showProgressValue={false}
        activeStrokeColor={ringColor}
        activeStrokeWidth={strokeWidth + 2}
        inActiveStrokeColor="#E6ECF2"
        inActiveStrokeOpacity={0.35}
        inActiveStrokeWidth={strokeWidth}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={styles.ringNumber}>{String(Math.round(safeVal))}</Text>
      </View>
    </View>
  );
});

/* ---------- Shallow gate for snapshot (now includes flags) ---------- */
function changedSubset(a, b) {
  if (!a || !b) return true;
  const keys = [
    "title",
    "brand",
    "image_cloud_url",
    "calories_kcal_total",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "health_score",
  ];
  for (const k of keys) if (a[k] !== b[k]) return true;

  const alA = a?.alternatives?.other_brands?.length ?? 0;
  const alB = b?.alternatives?.other_brands?.length ?? 0;
  if (alA !== alB) return true;

  const ingA = a?.ingredients_full?.length ?? 0;
  const ingB = b?.ingredients_full?.length ?? 0;
  if (ingA !== ingB) return true;

  const aText = a?.profile_used?.text || a?.proms?.text || "";
  const bText = b?.profile_used?.text || b?.proms?.text || "";
  if (aText !== bText) return true;

  const ap = a?.proms?.parts || a?.parts || {};
  const bp = b?.proms?.parts || b?.parts || {};
  for (const key of ["kidney", "heart", "diabetes"]) {
    if ((ap?.[key] || "") !== (bp?.[key] || "")) return true;
  }
  return false;
}

/* ===================== OpenAI classifier (no backend) ===================== */
// Put your key in app config/secrets. EXPO: set EXPO_PUBLIC_OPENAI_API_KEY
const OPENAI_API_KEY = "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";


// Force gpt-5 as you asked (can override via EXPO_PUBLIC_OPENAI_MODEL)
const OPENAI_MODEL =
  process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-5";

const DEBUG_OPENAI = true;

const fetchWithTimeout = (url, options = {}, ms = 20000) =>
  Promise.race([
    fetch(url, options),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);

// Escape helper for regex building
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Try local rules first so we still get the right category if the API fails
function localRuleOrNull(name) {
  const nm = String(name || "");
  const rule = CATEGORY_RULES.find((r) =>
    (r.synonyms || []).some((w) =>
      new RegExp(`\\b${_esc(w)}\\b`, "i").test(nm)
    )
  );
  return rule
    ? { key: rule.key, macroFrac: rule.macroFrac, sugarOfCarbs: rule.sugarOfCarbs ?? null }
    : null;
}

async function classifyIngredientOpenAI(name) {
  const ingName = String(name || "").trim();
  if (DEBUG_OPENAI) console.log("[OpenAI] classify →", { ingName, model: OPENAI_MODEL });

  // ✅ Fast path: local rules (Oil/Noodles/Sugar/etc.)
  const local = localRuleOrNull(ingName);
  if (local) {
    if (DEBUG_OPENAI) console.log("[OpenAI] local match:", local);
    return local;
  }

  try {
    const prompt = `
Return strict JSON only (no prose).
Classify the ingredient name into a nutrition category and macro fractions.
Categories (keys): oils, butter_mayo, bread_grains, pasta_noodles, rice, potato_fries,
sugary, nuts_seeds, coconut_flakes, meat_fish_eggs, soy_dairy_protein, cheese, vegetables.

Rules:
- "macroFrac" = approximate share of total kcal by macro {protein, carbs, fat}, each in [0..1].
- (optional) "sugarOfCarbs" = fraction of carbs that are sugars in [0..1].
- If unknown, pick the closest category. Use case-insensitive matching.

Example:
{"category":"oils","macroFrac":{"protein":0,"carbs":0,"fat":1},"sugarOfCarbs":null}

Ingredient: ${ingName}
`.trim();

    const body = {
      model: OPENAI_MODEL, // ✅ gpt-5
      // ❗ Do NOT send temperature; gpt-5 rejects non-default values
      messages: [
        { role: "system", content: "You are a nutrition classifier. Always answer with JSON only." },
        { role: "user", content: prompt },
      ],
    };
    if (DEBUG_OPENAI) console.log("[OpenAI] request body:", body);

    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (DEBUG_OPENAI) console.log("[OpenAI] status:", res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => "(no body)");
      throw new Error(`OpenAI HTTP ${res.status} — ${errText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (DEBUG_OPENAI) console.log("[OpenAI] raw:", text);

    let j = null;
    try {
      j = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) j = JSON.parse(m[0]);
    }
    if (DEBUG_OPENAI) console.log("[OpenAI] json:", j);

    if (j && j.category) {
      const rule = CATEGORY_RULES.find((r) => r.key === j.category);
      const out = rule
        ? {
            key: rule.key,
            macroFrac: j.macroFrac || rule.macroFrac,
            sugarOfCarbs: Object.prototype.hasOwnProperty.call(j, "sugarOfCarbs")
              ? j.sugarOfCarbs
              : (rule.sugarOfCarbs ?? null),
          }
        : {
            key: j.category,
            macroFrac: j.macroFrac || { protein: 0, carbs: 0, fat: 0 },
            sugarOfCarbs: Object.prototype.hasOwnProperty.call(j, "sugarOfCarbs") ? j.sugarOfCarbs : null,
          };
      if (DEBUG_OPENAI) console.log("[OpenAI] mapped:", out);
      return out;
    }
  } catch (e) {
    console.log("❌ OpenAI classifyIngredientOpenAI failed:", e?.message || e, { ingName });
  }

  // Last-resort fallback
  const fallback = CATEGORY_RULES.find((r) => r.key === "vegetables") || CATEGORY_RULES[0];
  const out = { key: fallback.key, macroFrac: fallback.macroFrac, sugarOfCarbs: fallback.sugarOfCarbs ?? null };
  if (DEBUG_OPENAI) console.log("[OpenAI] fallback:", out);
  return out;
}

function gramsFromKcalAndFracs(kcal, macroFrac, sugarOfCarbs) {
  const f = macroFrac || {};
  const protein_g = Math.round(((f.protein || 0) * (kcal || 0)) / 4);
  const carbs_g   = Math.round(((f.carbs   || 0) * (kcal || 0)) / 4);
  const fat_g     = Math.round(((f.fat     || 0) * (kcal || 0)) / 9);
  const sugar_g   = (sugarOfCarbs != null) ? Math.round(carbs_g * sugarOfCarbs) : 0;
  return { protein_g, carbs_g, fat_g, sugar_g };
}

/* ---------- OpenAI-first delta (updates daily calories + correct macro bucket) ---------- */
async function smartDelta(ing) {
  const kcal = n(ing?.estimated_kcal);

  let protein_g = n(ing?.protein_g);
  let carbs_g   = n(ing?.carbs_g);
  let fat_g     = n(ing?.fat_g ?? ing?.fats_g);
  let fiber_g   = n(ing?.fiber_g);
  let sugar_g   = n(ing?.sugar_g);
  let sodium_mg = n(ing?.sodium_mg);

  console.log("[smartDelta] start:", {
    name: ing?.name, kcal, protein_g, carbs_g, fat_g,
  });

  if (kcal && (!protein_g && !carbs_g && !fat_g)) {
    const cls = await classifyIngredientOpenAI(ing?.name || "");
    const g = gramsFromKcalAndFracs(kcal, cls.macroFrac, cls.sugarOfCarbs);
    protein_g = g.protein_g;
    carbs_g   = g.carbs_g;
    fat_g     = g.fat_g;
    if (!sugar_g) sugar_g = g.sugar_g;
  } else if (kcal) {
    // Partial: allocate remaining kcal by the predicted fractions
    const knownKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
    const remainKcal = Math.max(0, kcal - knownKcal);
    if (remainKcal > 0 && (!protein_g || !carbs_g || !fat_g)) {
      const cls = await classifyIngredientOpenAI(ing?.name || "");
      const f = cls.macroFrac || {};
      const missingSum =
        (!protein_g ? (f.protein || 0) : 0) +
        (!carbs_g   ? (f.carbs   || 0) : 0) +
        (!fat_g     ? (f.fat     || 0) : 0);
      if (missingSum > 0) {
        if (!protein_g && f.protein) protein_g = Math.round((remainKcal * (f.protein / missingSum)) / 4);
        if (!carbs_g   && f.carbs)   carbs_g   = Math.round((remainKcal * (f.carbs   / missingSum)) / 4);
        if (!fat_g     && f.fat)     fat_g     = Math.round((remainKcal * (f.fat     / missingSum)) / 9);
      }
      if (!sugar_g && carbs_g && cls.sugarOfCarbs != null) {
        sugar_g = Math.round(carbs_g * cls.sugarOfCarbs);
      }
    }
  }

  // Literal sugar → most carbs are sugar
  const nm = String(ing?.name || "").toLowerCase();
  if (!sugar_g && nm.includes("sugar") && carbs_g) sugar_g = Math.round(carbs_g * 0.95);

  const out = {
    caloriesToday: n(kcal),
    proteinToday:  n(protein_g),
    carbsToday:    n(carbs_g),
    fatToday:      n(fat_g),
    sugarToday:    n(sugar_g),
    fiberToday:    n(fiber_g),
    sodiumToday:   n(sodium_mg),
  };
  console.log("[smartDelta] out:", out);
  return out;
}


/* =================== PAGE =================== */
function ScanPageHome() {
  const { currentItemId, currentItem, setCurrentItem } = useCurrentScannedItemId();
  const { present, isS8Open, isS9Open } = useSheets();
  const { applyDelta, clearDelta } = useDailyLeft();

  const { width: screenW, height: screenH } = useWindowDimensions();

  const [ringBump, setRingBump] = useState(0);
  const [page, setPage] = useState(0);
  const pagerX = useRef(new Animated.Value(0)).current;

  const [refreshVer, setRefreshVer] = useState(0);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    if (isS8Open) setRingBump((b) => b + 1);
  }, [isS8Open]);

  const p = currentItem?.protein_g ?? 0;
  const c = currentItem?.carbs_g ?? 0;
  const f = currentItem?.fat_g ?? 0;
  const prevVals = useRef({ p, c, f });
  useEffect(() => {
    const changed = p !== prevVals.current.p || c !== prevVals.current.c || f !== prevVals.current.f;
    if (changed && isS8Open) setRingBump((b) => b + 1);
    prevVals.current = { p, c, f };
  }, [p, c, f, isS8Open]);

  /* Collapsing header */
  const scrollY = useRef(new Animated.Value(0)).current;
  const onVerticalScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: "clamp",
  });
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 100],
    extrapolate: "clamp",
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0.9],
    extrapolate: "clamp",
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 0, -8],
    extrapolate: "clamp",
  });

  // gray "Scanned ..." bar animation
  const topBarTranslateY = scrollY.interpolate({
    inputRange: [0, 24, 48],
    outputRange: [-height(6), -height(6), 0],
    extrapolate: "clamp",
  });
  const topBarOpacity = scrollY.interpolate({
    inputRange: [24, 48],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const lastSnapRef = useRef(null);

  // expo-image prefetch
  useEffect(() => {
    const url = currentItem?.image_cloud_url;
    if (url) Image.prefetch(url).catch(() => {});
  }, [currentItem?.image_cloud_url]);

  // map Firestore doc → UI shape
  const shapeFromDoc = (d) => {
    const title = sText(d.title, "Scanned meal");
    const brand = sText(d.brand, "");
    const caloriesTotal = Number.isFinite(sNum(d.calories_kcal_total, NaN)) ? sNum(d.calories_kcal_total, NaN) : null;

    const ingredients = Array.isArray(d.ingredients_full) ? d.ingredients_full : [];
    const ingredientCards = ingredients.map((ing, idx) => {
      const kcal = Math.round(Number.isFinite(sNum(ing?.estimated_kcal, NaN)) ? sNum(ing?.estimated_kcal, 0) : 0);
      return {
        label: sText(ing?.name, ""),
        amt: `+${kcal} cal`,
        icon: "Utensils",
        IconCOlor: "#1E67FF",
        iconColorBg: "#EEF3FF",
        color: "#FFFFFF",
        originalIndex: idx,
        deletable: true,
      };
    });

    const ingredients_kcal_sum = ingredients.reduce(
      (sum, r) => sum + (Number.isFinite(+r?.estimated_kcal) ? +r.estimated_kcal : 0),
      0
    );
    const remainingRaw =
      Number.isFinite(caloriesTotal) && Number.isFinite(ingredients_kcal_sum)
        ? caloriesTotal - ingredients_kcal_sum
        : null;
    const ingredients_kcal_remaining = remainingRaw == null ? null : Math.round(remainingRaw);
    if (Number.isFinite(ingredients_kcal_remaining) && Math.abs(ingredients_kcal_remaining) > 1) {
      ingredientCards.push({
        label: "Other / rounding",
        amt: `${ingredients_kcal_remaining >= 0 ? "+" : ""}${ingredients_kcal_remaining} cal`,
        icon: "Utensils",
        IconCOlor: "#1E67FF",
        iconColorBg: "#EEF3FF",
        color: "#FFFFFF",
        originalIndex: null,
        deletable: false,
      });
    }

    let alternativesCards = [];
    if (Array.isArray(d.alternatives_flat)) {
      alternativesCards = d.alternatives_flat.map((p) => ({
        label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")].filter(Boolean).join(" "),
        amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN)) ? `${sNum(p?.calories_per_package_kcal, 0)}cal` : "—",
        moreOrLess: p?.bucket === "lower" ? "less" : p?.bucket === "higher" ? "more" : "similar",
      }));
    } else if (
      d.alternatives &&
      (Array.isArray(d.alternatives.same_brand) || Array.isArray(d.alternatives.other_brands))
    ) {
      const mix = [
        ...(Array.isArray(d.alternatives.same_brand) ? d.alternatives.same_brand : []),
        ...(Array.isArray(d.alternatives.other_brands) ? d.alternatives.other_brands : []),
      ];
      alternativesCards = mix.map((p) => ({
        label: [sText(p?.brand, ""), sText(p?.name, ""), sText(p?.flavor_or_variant, "")].filter(Boolean).join(" "),
        amt: Number.isFinite(sNum(p?.calories_per_package_kcal, NaN)) ? `${sNum(p?.calories_per_package_kcal, 0)}cal` : "—",
        moreOrLess: p?.bucket === "lower" ? "less" : p?.bucket === "higher" ? "more" : "similar",
      }));
    }

    const items = Array.isArray(d.items) ? d.items : [];
    const itemsSafe = items.map((it) => ({
      name: sText(it?.name, "Item"),
      subtitle: sText(it?.subtitle, ""),
      calories_kcal: sNum(it?.calories_kcal, 0),
      icon: "Utensils",
    }));

    const parts = (d?.proms && d.proms.parts) || d?.parts || {};
    const flagsParts = [];
    if (typeof parts.kidney === "string" && parts.kidney) flagsParts.push({ key: "kidney", icon: "Droplets", color: "#0EA5E9", text: parts.kidney });
    if (typeof parts.heart === "string" && parts.heart) flagsParts.push({ key: "heart", icon: "Heart", color: "#EF4444", text: parts.heart });
    if (typeof parts.diabetes === "string" && parts.diabetes) flagsParts.push({ key: "diabetes", icon: "Syringe", color: "#7C3AED", text: parts.diabetes });
    const flagsText = sText(d?.profile_used?.text || d?.proms?.text || "", "");

    return {
      ...d,
      title,
      brand,
      calories_kcal_total: caloriesTotal,
      ingredientCards,
      alternativesCards,
      items: itemsSafe,
      ingredients_kcal_sum,
      ingredients_kcal_remaining,
      flagsParts,
      flagsText,
    };
  };

  useEffect(() => {
    console.log("currentItemId ", currentItemId);
  }, [currentItemId]);

  /* Firestore live subscription (RecentlyEaten/{currentItemId}) */
  useEffect(() => {
    if (!isS8Open) return;
    const uid = getAuth()?.currentUser?.uid;
    if (!uid || !currentItemId) return;

    const db = getFirestore();
    const refDoc = doc(db, "users", uid, "RecentlyEaten", currentItemId);

    const unsub = onSnapshot(
      refDoc,
      (snap) => {
        if (!snap.exists) {
          setCurrentItem(null);
          lastSnapRef.current = null;
          return;
        }
        const d = snap.data() || {};
        if (lastSnapRef.current && !changedSubset(d, lastSnapRef.current)) return;
        lastSnapRef.current = d;
        setCurrentItem(shapeFromDoc(d));
      },
      (err) => console.log("[onSnapshot] error:", err?.message || err)
    );

    return () => {
      unsub();
      lastSnapRef.current = null;
    };
  }, [isS8Open, currentItemId, setCurrentItem, refreshVer]);

  /* When edit sheet closes -> refresh */
  useEffect(() => {
    if (isS9Open === false) {
      setRingBump((b) => b + 1);
      resetHidden();
      setListKey((k) => k + 1);
      setRefreshVer((v) => v + 1);

      const uid = getAuth()?.currentUser?.uid;
      if (!uid || !currentItemId) return;
      const db = getFirestore();
      getDoc(doc(db, "users", uid, "RecentlyEaten", currentItemId))
        .then((snap) => {
          if (snap.exists) setCurrentItem(shapeFromDoc(snap.data() || {}));
        })
        .catch(() => {});
    }
  }, [isS9Open, currentItemId, setCurrentItem]);

  /* 🔧 Write helpers */
  const mirrorUpdateToToday = async (uid, itemId, payload, createdAt) => {
    const db = getFirestore();
    const dayKey = dayKeyFrom(createdAt);
    const dayDocRef = doc(db, "users", uid, "Today", dayKey);
    await setDoc(
      dayDocRef,
      {
        [itemId]: {
          ...payload,
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const recalcTodayTotalsFromList = async (uid, dayKey) => {
    if (!uid || !dayKey) return;
    const db = getFirestore();
    const listCol = collection(db, "users", uid, "Today", dayKey, "List");
    const snap = await getDocs(listCol);

    let calories = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0,
      sugar = 0,
      sodium = 0;

    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const c = Number(d?.calories_kcal_total ?? d?.items?.[0]?.calories_kcal ?? 0);
      calories += Number.isFinite(c) ? c : 0;
      protein += Number.isFinite(+d?.protein_g) ? +d.protein_g : 0;
      carbs   += Number.isFinite(+d?.carbs_g)   ? +d.carbs_g   : 0;
      fat     += Number.isFinite(+d?.fat_g)     ? +d.fat_g     : 0;
      fiber   += Number.isFinite(+d?.fiber_g)   ? +d.fiber_g   : 0;
      sugar   += Number.isFinite(+d?.sugar_g)   ? +d.sugar_g   : 0;
      sodium  += Number.isFinite(+d?.sodium_mg) ? +d.sodium_mg : 0;
    });

    const todayDocRef = doc(db, "users", uid, "Today", dayKey);
    await setDoc(
      todayDocRef,
      {
        totals: {
          dayKey,
          caloriesToday: Math.round(calories),
          proteinToday: Math.round(protein),
          carbsToday: Math.round(carbs),
          fatToday: Math.round(fat),
          fiberToday: Math.round(fiber),
          sugarToday: Math.round(sugar),
          sodiumToday: Math.round(sodium),
        },
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  };

  /* ===== swipe row state ===== */
  const animX = useRef(new Map()).current;
  const animOp = useRef(new Map()).current;
  const responders = useRef(new Map()).current;
  const openRowRef = useRef(null);
  const panStartX = useRef(new Map()).current;

  const getVal = (map, id, init) => {
    if (!map.has(id)) map.set(id, new Animated.Value(init));
    return map.get(id);
  };

  const [exitingIds, setExitingIds] = useState([]);

  const resetHidden = () => {
    setExitingIds([]);
    animX.clear();
    animOp.clear();
    responders.clear();
    openRowRef.current = null;
    panStartX.clear();
  };

  /* 🔥 Slide out + delete ingredient — write to BOTH day-keys + optimistic totals */
  const slideOut = (id, onAfter) => {
    const x = getVal(animX, id, 0);
    const op = getVal(animOp, id, 1);

    Animated.parallel([
      Animated.timing(x, { toValue: -width(100), duration: 250, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(async () => {
      setExitingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      animX.delete(id);
      animOp.delete(id);
      responders.delete(id);
      if (openRowRef.current === id) openRowRef.current = null;
      panStartX.delete(id);

      let deltaKey;
      try {
        const uid = getAuth()?.currentUser?.uid;
        if (!uid || !currentItemId) return;

        const db = getFirestore();

        // Use the latest raw snapshot to keep indexes aligned
        const latest = lastSnapRef.current || currentItem || {};
        const original = Array.isArray(latest.ingredients_full) ? latest.ingredients_full : [];

        const srcIndex = Number.isFinite(+id) ? +id : -1;
        if (srcIndex < 0 || srcIndex >= original.length) return;

        const removedIng = original[srcIndex];
        const keep = original.filter((_, i) => i !== srcIndex);

        // optimistic delta (negative because we're removing consumed cals/macros)
        const removedDelta = await smartDelta(removedIng);
        deltaKey = `delete-${currentItemId}-${srcIndex}-${Date.now()}`;
        applyDelta(deltaKey, {
          caloriesToday: -removedDelta.caloriesToday,
          proteinToday: -removedDelta.proteinToday,
          carbsToday:   -removedDelta.carbsToday,
          fatToday:     -removedDelta.fatToday,
          sugarToday:   -removedDelta.sugarToday,
          fiberToday:   -removedDelta.fiberToday,
          sodiumToday:  -removedDelta.sodiumToday,
        });

        // ALWAYS recompute calories from keep[]
        const newCalories = keep.reduce(
          (sum, ing) => sum + (Number.isFinite(+ing?.estimated_kcal) ? +ing.estimated_kcal : 0),
          0
        );
        const caloriesRounded = Math.max(0, Math.round(newCalories));

        // best-effort macro sums from keep[] using OpenAI-backed smartDelta
        const keepDeltas = await Promise.all(keep.map((ing) => smartDelta(ing)));
        const summed = keepDeltas.reduce((acc, d) => ({
          calories: acc.calories + d.caloriesToday,
          protein:  acc.protein  + d.proteinToday,
          carbs:    acc.carbs    + d.carbsToday,
          fat:      acc.fat      + d.fatToday,
          fiber:    acc.fiber    + d.fiberToday,
          sugar:    acc.sugar    + d.sugarToday,
          sodium:   acc.sodium   + d.sodiumToday,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

        const newItems0 = { ...(latest.items?.[0] || {}), calories_kcal: caloriesRounded };

        // ✅ ALWAYS overwrite macros (including zeros) to keep contexts in sync
        const macroPatch = {
          protein_g: Math.max(0, Math.round(summed.protein)),
          carbs_g:   Math.max(0, Math.round(summed.carbs)),
          fat_g:     Math.max(0, Math.round(summed.fat)),
          fiber_g:   Math.max(0, Math.round(summed.fiber)),
          sugar_g:   Math.max(0, Math.round(summed.sugar)),
          sodium_mg: Math.max(0, Math.round(summed.sodium)),
        };

        const newDoc = {
          ingredients_full: keep,
          calories_kcal_total: caloriesRounded,
          items: [newItems0],
          updated_at: serverTimestamp(),
          ...macroPatch,
        };

        // day-keys: created_at (historical) and local today (what Home listens to)
        const keyFromCreated = dayKeyFrom(latest?.created_at);
        const keyLocalToday = getLocalDayKey();

        // 1) RecentlyEaten (source of truth for meal)
        const refRE = doc(db, "users", uid, "RecentlyEaten", currentItemId);
        await setDoc(refRE, newDoc, { merge: true });

        // 2) Today/<createdAt>/List and Today/<localToday>/List
        const refs = [
          doc(db, "users", uid, "Today", keyFromCreated, "List", currentItemId),
          ...(keyLocalToday !== keyFromCreated
            ? [doc(db, "users", uid, "Today", keyLocalToday, "List", currentItemId)]
            : []),
        ];
        await Promise.all(refs.map((r) => setDoc(r, newDoc, { merge: true })));

        // 3) Optional flat mirror (if used elsewhere)
        await mirrorUpdateToToday(uid, currentItemId, newDoc, latest?.created_at);

        // 4) Recalc totals for BOTH day-keys
        await Promise.all([
          recalcTodayTotalsFromList(uid, keyFromCreated),
          ...(keyLocalToday !== keyFromCreated ? [recalcTodayTotalsFromList(uid, keyLocalToday)] : []),
        ]);

        // clear optimistic delta once server writes complete
        if (deltaKey) clearDelta(deltaKey);

        // bump UI
        setRingBump((b) => b + 1);
        setRefreshVer((v) => v + 1);
        setListKey((k) => k + 1);
      } catch (err) {
        console.log("❌ Error updating after ingredient delete:", err?.message || err);
        if (deltaKey) clearDelta(deltaKey);
      }

      onAfter && onAfter();
    });
  };


  



  const getPan = (id, x, op, onDelete) => {
  if (responders.has(id)) return responders.get(id);

  const REVEAL_W = width(35);
  const THRESH   = width(12);     // when passed, we “open”
  const OPEN_POS = -REVEAL_W / 2; // half-reveal, no auto-delete

  const r = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,

    onPanResponderGrant: () => {
      let startX = 0;
      try { startX = x.__getValue ? x.__getValue() : 0; } catch {}
      panStartX.set(id, startX);
    },

    onPanResponderMove: (_, g) => {
      const startX = panStartX.get(id) || 0;
      const next = Math.max(-REVEAL_W, Math.min(0, startX + g.dx));
      x.setValue(next);
      const fade = 1 + next / (REVEAL_W * 2);
      op.setValue(Math.max(0.5, fade));
    },

    onPanResponderRelease: (_, g) => {
      const startX = panStartX.get(id) || 0;
      const finalX = startX + g.dx;

      if (finalX <= -THRESH) {
        // close any previously open row
        if (openRowRef.current && openRowRef.current !== id) {
          const prevX = getVal(animX, openRowRef.current, 0);
          Animated.spring(prevX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
        }
        openRowRef.current = id;

        // ✅ snap to half-open, do NOT delete
        Animated.parallel([
          Animated.spring(x, { toValue: OPEN_POS, useNativeDriver: true, bounciness: 0, speed: 20 }),
          Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      } else {
        if (openRowRef.current === id) openRowRef.current = null;
        Animated.parallel([
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }),
          Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }
    },

    onPanResponderTerminate: () => {
      const REOPEN = openRowRef.current === id;
      Animated.parallel([
        Animated.spring(x, { toValue: REOPEN ? OPEN_POS : 0, useNativeDriver: true, bounciness: 0, speed: 20 }),
        Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    },

    // 🚫 no auto-delete on pan end anymore — deletion only via button tap
    onPanResponderEnd: () => {
      const isOpen = openRowRef.current === id;
      Animated.spring(x, { toValue: isOpen ? OPEN_POS : 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
    },
  });

  responders.set(id, r);
  return r;
};





  const stripEmojiPrefix = (s = "") =>
    s.replace(/^\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]+)\s*/u, "").trim();

  const FLAG_ICON = {
    kidney: "Droplet",
    heart: "Heart",
    diabetes: "Syringe",
    reduceCoffee: "Coffee",
    stopSmoking: "Ban",
  };

  const healthFlags = useMemo(() => {
    const parts =
      (currentItem?.proms && currentItem.proms.parts) ||
      currentItem?.parts ||
      {};
    const order = ["kidney", "heart", "diabetes", "reduceCoffee", "stopSmoking"];

    return order
      .map((key) => {
        const raw = typeof parts[key] === "string" ? parts[key] : "";
        if (!raw) return null;
        return {
          key,
          text: stripEmojiPrefix(raw),
          icon: FLAG_ICON[key] || "Info",
        };
      })
      .filter(Boolean);
  }, [currentItem?.proms, currentItem?.parts]);

  const FLAG_COLORS = {
    kidney:       { bg: "#EAF2FF", fg: "#1E67FF" },
    heart:        { bg: "#FFECEF", fg: "#FE1B20" },
    diabetes:     { bg: "#FFF6E6", fg: "#F59E0B" },
    reduceCoffee: { bg: "#F3E8FF", fg: "#7C3AED" },
    stopSmoking:  { bg: "#ECFDF5", fg: "#059669" },
  };

  const animation = useRef(null);
  useEffect(() => {
    // animation.current?.play();
  }, []);

  const CARD_W  = width(80);
  const GAP     = width(5);
  const SNAP    = CARD_W + GAP;

  const lastIndex = useRef(-1);

  const formatCreatedAt = (raw) => {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(d)) return "";
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return isToday
      ? `Today ${time}`
      : `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} ${time}`;
  };

  return (
    <View style={{ height: height(100), backgroundColor: "#fff" }}>
      <Animated.ScrollView
        contentContainerStyle={{
          paddingTop: HEADER_MAX_HEIGHT - 32,
          paddingBottom: height(15),
          minHeight: screenH + HEADER_MAX_HEIGHT,
        }}
        scrollEventThrottle={16}
        onScroll={onVerticalScroll}
        removeClippedSubviews
      >
        {/* Title + Edit */}
        <View style={{ width: "100%" }}>
          <Text style={styles.helperText}>Edit the detected dish or add ingredients — tap Edit.</Text>

          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{currentItem?.title}</Text>

            <TouchableOpacity
              onPress={() => {
                present("s9");
              }}
              style={styles.editBtn}
            >
              <View style={{ flexDirection: "row" }}>
                <LucideIcons.Pencil size={18} color={"#000"} strokeWidth={4} />
                <Text style={styles.editTxt}>Edit</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pager */}
        <View style={{ height: height(45) }} pointerEvents="box-none">
          <Animated.ScrollView
            ref={pagerX /* keep as in your file */}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: pagerX } } }], {
              useNativeDriver: true,
              listener: (e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / screenW);
                if (i !== page) setPage(i);
              },
            })}
            scrollEventThrottle={16}
            removeClippedSubviews
          >
            {/* Page 1 */}
            <View style={{ width: screenW }}>
              <View style={styles.caloriesCard}>
                <Text style={{ marginTop: height(3), marginLeft: width(5), color: "#fff", fontSize: size(18), fontWeight: "800" }}>
                  Calories
                </Text>
                <View style={styles.caloriesRow}>
                  <View style={{ height: size(40), width: size(40), borderRadius: size(40) / 2, justifyContent: "center", alignItems: "center" }}>
                    <LucideIcons.Flame size={38} strokeWidth={3} color={"#fff"} />
                  </View>
                  <Text style={styles.caloriesValue}>{currentItem?.calories_kcal_total}</Text>
                </View>
              </View>

              <View style={styles.ringsRow}>
                <View style={styles.tile3}>
                  <MiniRing
                    value={p}
                    color="#632EFF"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={`protein-${ringBump}`}
                  />
                  <Text style={styles.amtText}>{p}g</Text>
                  <Text style={styles.capText}>Protein</Text>
                </View>

                <View style={styles.tile3}>
                  <MiniRing
                    value={c}
                    color="#F7931A"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={`carbs-${ringBump}`}
                  />
                  <Text style={styles.amtText}>{c}g</Text>
                  <Text style={styles.capText}>Carbs</Text>
                </View>

                <View style={styles.tile3}>
                  <MiniRing
                    value={f}
                    color="#0058FF"
                    strokeWidth={5}
                    radius={40}
                    duration={800}
                    maxValue={200}
                    active={isS8Open}
                    bumpKey={`fat-${ringBump}`}
                  />
                  <Text style={styles.amtText}>{f}g</Text>
                  <Text style={styles.capText}>Fat</Text>
                </View>
              </View>
            </View>

            {/* Page 2 */}
            <View style={{ width: screenW }}>
              <View style={styles.bigMetricCard}>
                <Text style={{ marginTop: height(3), color: "#fff", marginLeft: width(5), fontSize: size(18), fontWeight: "800" }}>
                  Health Score
                </Text>
                <View style={styles.caloriesRow}>
                  <View style={{ height: size(40), width: size(40), borderRadius: size(40) / 2, justifyContent: "center", alignItems: "center" }}>
                    <LucideIcons.Heart size={38} strokeWidth={3} color={"#fff"} />
                  </View>
                  <Text style={styles.caloriesValue}>{sNum(currentItem?.health_score, 0)}</Text>
                  <Text style={{ fontSize: size(20), color: "#fff", fontWeight: "700", marginLeft: width(1) }}>/ 10</Text>
                </View>
              </View>

              <View style={styles.ringsRow}>
                {[
                  { key: "fiber", label: "Fiber", amt: `${sNum(currentItem?.fiber_g, 0)}g`, value: sNum(currentItem?.fiber_g, 0), max: 30, color: "#22C55E" },
                  { key: "sugar", label: "Sugar", amt: `${sNum(currentItem?.sugar_g, 0)}g`, value: sNum(currentItem?.sugar_g, 0), max: 50, color: "#F7931A" },
                  { key: "sodium", label: "Sodium", amt: `${sNum(currentItem?.sodium_mg, 0)}mg`, value: sNum(currentItem?.sodium_mg, 0), max: 2300, color: "#0058FF" },
                ].map((it) => (
                  <View key={it.key} style={styles.tile3}>
                    <MiniRing
                      value={it.value}
                      color={it.color}
                      strokeWidth={5}
                      radius={36}
                      duration={800}
                      maxValue={it.max}
                      active={isS8Open}
                      bumpKey={`little-${it.key}-${ringBump}`}
                    />
                    <Text style={styles.amtText}>{it.amt}</Text>
                    <Text style={styles.capText}>{it.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.ScrollView>

          {/* dots */}
          <View style={{ flexDirection: "row", alignSelf: "center", top: height(3) }}>
            <View style={page === 0 ? styles.activeDot : styles.dot} />
            <View style={[page === 1 ? styles.activeDot : styles.dot, { marginLeft: 8 }]} />
          </View>
        </View>

        {/* Personalized flags */}
        <View style={{ marginTop: height(8) }}>
          <Text style={{ marginBottom: height(1), marginLeft: width(5), fontSize: size(18), fontWeight: "800" }}>
            Personalized health checks
          </Text>
          <FlatList
            horizontal
            data={healthFlags}
            keyExtractor={(it, i) => `${it.key}-${i}`}
            showsHorizontalScrollIndicator={false}
            style={{ height: height(18) }}
            contentContainerStyle={{ paddingLeft: width(5), paddingRight: width(5) }}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={width(80) + width(5)}
            bounces={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / (width(80) + width(5)));
              if (i !== lastIndex.current) {
                lastIndex.current = i;
                Haptics.selectionAsync();
              }
            }}
            ItemSeparatorComponent={() => <View style={{ width: width(5) }} />}
            renderItem={({ item }) => {
              const Icon = LucideIcons[item.icon] || LucideIcons.Info;
              const { bg, fg } = FLAG_COLORS[item.key] || { bg: "#F3F4F6", fg: "#111" };

              return (
                <View
                  style={{
                    width: width(80),
                    marginRight: 0,
                    paddingVertical: 20,
                    height: height(13),
                    alignSelf: "center",
                    backgroundColor: "#fff",
                    borderRadius: 20,
                    paddingHorizontal: width(4),
                    borderWidth: 1,
                    borderColor: "#F1F3F9",
                    ...Platform.select({
                      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10 },
                      android: { elevation: 3, shadowColor: "#00000050" },
                    }),
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View
                      style={{
                        height: 34, width: 34, borderRadius: 17,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: bg, marginRight: width(3),
                      }}
                    >
                      <Icon size={16} color={fg || "#000"} />
                    </View>

                    <Text style={{ flex: 1, fontSize: size(16), lineHeight: height(2.5), color: "#111" }}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>

        {/* Totals */}
        <Text style={styles.totalsHeader}>Total meal calories</Text>

        {/* Ingredients list */}
        <FlatList
          key={`ing-${listKey}`}
          style={{ marginTop: height(4) }}
          data={currentItem?.ingredientCards}
          extraData={`${ringBump}-${refreshVer}-${currentItem?.ingredientCards?.length || 0}`}
          keyExtractor={(_, i) => String(i)}
          removeClippedSubviews
          initialNumToRender={4}
          windowSize={5}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={24}
          scrollEnabled={false}
          contentContainerStyle={{ width: "90%", alignSelf: "center", marginTop: height(1), paddingBottom: height(1) }}
          renderItem={({ item, index }) => {
            const IconComponent = LucideIcons.Utensils;

            const deletable =
              item?.deletable && Number.isInteger(item?.originalIndex) && item.originalIndex >= 0;

            // use originalIndex as id so it always targets the right ingredient
            const id = deletable ? String(item.originalIndex) : `nondeletable-${index}`;
            if (exitingIds.includes(id)) return null;

            const x = getVal(animX, id, 0);
            const op = getVal(animOp, id, 1);

            // SAFE: typeof guard avoids ReferenceError if removeIngredientAt isn't defined
            const onDelete = () => {
              if (!deletable) return;
              if (typeof removeIngredientAt === "function") {
                removeIngredientAt(item.originalIndex);
              }
            };
            const pan = deletable ? getPan(id, x, op, onDelete) : { panHandlers: {} };

            const trashOpacity = x.interpolate({
              inputRange: [-width(18), -width(6), 0],
              outputRange: [1, 0.6, 0],
              extrapolate: "clamp",
            });
            const trashScale = x.interpolate({
              inputRange: [-width(18), 0],
              outputRange: [1, 0.85],
              extrapolate: "clamp",
            });

            return (
              <View style={{ height: size(90), width: "100%" }}>
                {/* Background trash */}
                {deletable && (
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: width(18),
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => slideOut(id, onDelete)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Animated.View
                        style={{
                          backgroundColor: "#FFECEF",
                          borderRadius: 16,
                          padding: size(10),
                          opacity: trashOpacity,
                          transform: [{ scale: trashScale }],
                        }}
                      >
                        <LucideIcons.Trash2 size={20} color={"#FE1B20"} />
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Foreground row */}
                <Animated.View
                  {...pan.panHandlers}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: "100%",
                    opacity: op,
                    transform: [{ translateX: deletable ? x : 0 }],
                    backgroundColor: "transparent",
                  }}
                >
                  <IconComponent style={{ marginLeft: width(5) }} size={16} color={"#000"} />

                  <Text style={{ width: "50%", fontSize: size(16), color: "#000", fontWeight: "800", marginLeft: width(5) }}>
                    {item?.label}
                  </Text>

                  <Text
                    onPress={() => deletable && slideOut(id, onDelete)}
                    style={{
                      color: deletable ? "#000" : "#888",
                      right: width(2),
                      position: "absolute",
                      fontWeight: "800",
                      fontSize: size(16),
                    }}
                  >
                  {
                    / water/i.test(item?.label ?? "")
                    ? ((Number(currentItem?.water_ml) || 0) >= 1000
                        ? `${(((Number(currentItem?.water_ml) || 0) / 1000).toFixed(((Number(currentItem?.water_ml) || 0) % 1000 ? 1 : 0)))} L`
                        : `${Number(currentItem?.water_ml) || 0} ml`
                      )
                    : /coffee/i.test(item?.label ?? "")
                      ? (() => {
                          const cups = Number(currentItem?.coffee_cups) || 0;
                          const v = Number.isInteger(cups) ? cups : Number(cups.toFixed(1));
                          return `${v} ${Math.abs(v) === 1 ? "cup" : "cups"}`;
                        })()
                      : `${(parseFloat(String(item?.amt ?? "0").replace(/[^\d.]/g, "")) || 0)} cal`
                  }

                  </Text>
                </Animated.View>
              </View>
            );
          }}
        />

        {/* Alternatives header */}
        <Text style={[styles.totalsHeader, { marginTop: height(1) }]}>Alternatives</Text>

        <FlatList
          horizontal
          style={{ width: "100%", paddingLeft: width(5), paddingTop: height(4), paddingBottom: height(2) }}
          data={Array.isArray(currentItem?.alternatives?.other_brands) ? currentItem.alternatives.other_brands : []}
          keyExtractor={(item, i) => `alt-${item?.code || item?.name || i}`}
          removeClippedSubviews
          initialNumToRender={4}
          windowSize={5}
          maxToRenderPerBatch={4}
          contentContainerStyle={{ paddingRight: width(5) }}
          updateCellsBatchingPeriod={24}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const altKcal = Number.isFinite(+item?.calories_per_package_kcal) ? Math.round(+item.calories_per_package_kcal) : null;
            const baseKcal = Number.isFinite(+currentItem?.calories_kcal_total) ? Math.round(+currentItem.calories_kcal_total) : null;

            const diff = altKcal != null && baseKcal != null ? altKcal - baseKcal : null;
            const THRESH = 5;
            const bucket = diff == null ? "similar" : diff < -THRESH ? "lower" : diff > THRESH ? "higher" : "similar";

            const color = bucket === "higher" ? "#EF4444" : bucket === "lower" ? "#22C55E" : "#000";

            const label = [sText(item?.brand, ""), sText(item?.name, ""), sText(item?.flavor_or_variant, "")]
              .filter(Boolean)
              .join(" ");

            const sign = bucket === "higher" ? "+" : bucket === "lower" ? "−" : "";
            const amt = altKcal != null ? `${sign}${altKcal}cal` : "—";

            return (
              <View
                style={{
                  backgroundColor: "#fff",
                  width: size(150),
                  marginRight: width(5),
                  height: height(20),
                  marginBottom: 12,
                  borderRadius: 15,
                  ...Platform.select({
                    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 10 },
                    android: { elevation: 6, shadowColor: "#888" },
                  }),
                }}
              >
                <Text
                  numberOfLines={4}
                  style={{ width: "75%", marginLeft: width(5), marginTop: height(2), fontSize: size(16), fontWeight: "800" }}
                >
                  {label}
                </Text>

                <Text
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    color,
                    fontWeight: "800",
                    fontSize: size(18),
                    width: "95%",
                    position: "absolute",
                    marginLeft: width(5),
                    bottom: height(4),
                  }}
                >
                  {amt}
                </Text>
              </View>
            );
          }}
        />
      </Animated.ScrollView>

      {/* Collapsing header image — expo-image */}
      <Animated.View
        style={[
          styles.header,
          { transform: [{ translateY: headerTranslateY }] },
        ]}
        shouldRasterizeIOS={Platform.OS === "ios"}
        renderToHardwareTextureAndroid={Platform.OS === "android"}
      >
        <AnimatedExpoImage
          source={currentItem?.image_cloud_url ? { uri: currentItem.image_cloud_url } : undefined}
          style={[
            styles.headerBackground,
            { opacity: imageOpacity, transform: [{ translateY: imageTranslateY }] },
          ]}
          pointerEvents="none"
          contentFit="cover"
          cachePolicy="disk"
          priority="high"
        />
      </Animated.View>

      {/* Top title over header */}
      <Animated.View
        style={[
          styles.headerTopTitle,
          { transform: [{ translateY: topBarTranslateY }], opacity: topBarOpacity },
        ]}
      >
        <Text style={{ color: "#000", marginTop: height(1), fontWeight: "700", fontSize: size(15) }}>
          Scanned {formatCreatedAt(currentItem?.created_at)}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringNumber: { fontSize: size(18), fontWeight: "800", color: "#000" },

  helperText: {
    fontSize: size(16),
    marginTop: height(8),
    marginBottom: 0,
    marginLeft: width(5),
    color: "#999",
    fontWeight: "800",
    width: "85%",
    lineHeight: height(2.5),
  },
  titleRow: { flexDirection: "row", marginTop: height(4), marginLeft: width(5) },
  titleText: { fontSize: size(30), width: "65%", fontWeight: "700" },
  editBtn: {
    height: size(40),
    top: 0,
    right: width(5),
    position: "absolute",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: size(25),
    marginRight: width(1),
  },
  editTxt: { marginLeft: width(2), fontWeight: "700", fontSize: size(16) },

  dot: { backgroundColor: "rgba(0,0,0,0.18)", width: 8, height: 8, borderRadius: 4 },
  activeDot: { backgroundColor: "#000", width: 40, height: 8, borderRadius: 4 },

  caloriesCard: {
    width: "90%",
    marginTop: height(4),
    borderRadius: 20,
    alignSelf: "center",
    height: height(16),
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#151515",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 5, shadowColor: "#00000050" },
    }),
  },
  bigMetricCard: {
    width: "90%",
    marginTop: height(4),
    borderRadius: 20,
    alignSelf: "center",
    height: height(16),
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#151515",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 5, shadowColor: "#00000050" },
    }),
  },

  caloriesRow: { flexDirection: "row", alignItems: "center", marginTop: height(2), marginLeft: width(5) },
  caloriesValue: { fontSize: size(40), color: "#fff", marginLeft: width(3), fontWeight: "700" },

  ringsRow: {
    flexDirection: "row",
    width: "90%",
    alignSelf: "center",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: height(1),
  },

  tile3: {
    width: "31%",
    height: height(20),
    marginTop: height(2),
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#F1F3F9",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
      android: { elevation: 2, shadowColor: "#00000050" },
    }),
  },

  amtText: { fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" },
  capText: { fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" },

  totalsHeader: { fontSize: size(18), marginTop: height(4), fontWeight: "800", marginLeft: width(5) },

  header: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    width: width(100),
    backgroundColor: "#fff",
    height: HEADER_MAX_HEIGHT,
  },
  headerBackground: {
    position: "absolute",
    width: width(100),
    height: HEADER_MAX_HEIGHT,
  },
  headerTopTitle: {
    marginTop: 0,
    width: width(100),
    height: height(6),
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ScanPageHome;
