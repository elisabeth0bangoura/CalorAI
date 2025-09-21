// ./app/Inventory/RecipesFromInventory.js
import { useAddToInventory } from "@/app/Context/AddToInventoryContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

/* ----------------------- tiny utils ----------------------- */
const toStr = (s, d = "") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;
const toInt = (n, d = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
};
const toDate = (ts) => {
  if (!ts) return new Date(0);
  if (ts?.toDate) return ts.toDate();
  if (typeof ts === "number") return new Date(ts);
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

const slug = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64) || `r-${Math.random().toString(36).slice(2, 8)}`;

/** Build a list of PRODUCT TITLES (primary), with safe fallbacks */
const titlesFromInventory = (docs, max = 60) => {
  const seen = new Set();
  const out = [];

  for (const d of docs) {
    // prefer proper product title; then model-detected; finally brand + serving
    const main =
      toStr(d?.title) ||
      toStr(d?.title_detected) ||
      toStr(
        d?.brand_detected && d?.serving_size
          ? `${d.brand_detected} ${d.serving_size}`
          : ""
      );

    if (main) {
      const key = main.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(main);
      }
    }

    // also include any sub-items names (if enriched)
    if (Array.isArray(d?.items)) {
      for (const it of d.items) {
        const nm = toStr(it?.name);
        if (!nm) continue;
        const key = nm.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(nm);
        }
      }
    }

    if (out.length >= max) break;
  }
  return out.slice(0, max);
};

/* -------------------- ADD: step helpers (no other changes) -------------------- */

// Heuristics to allocate time across text steps
const KEYWORD_WEIGHTS = [
  { re: /bake|roast|oven/i, w: 4 },
  { re: /simmer|braise|reduce/i, w: 3.5 },
  { re: /boil|cook noodles|al dente/i, w: 3 },
  { re: /roux|béchamel|whisk|stir|mix|fold|melt|chop|slice/i, w: 2 },
  { re: /preheat|drain|season|transfer|top|serve|heat oil/i, w: 1.3 },
];

function allocateDurations(steps = [], total = 0) {
  const n = Array.isArray(steps) ? steps.length : 0;
  if (!n) return [];
  if (!Number.isFinite(total) || total <= 0) total = n * 5; // fallback

  const weights = steps.map((s) => {
    let maxW = 1;
    for (const { re, w } of KEYWORD_WEIGHTS) if (re.test(s)) maxW = Math.max(maxW, w);
    return maxW;
  });

  const sumW = weights.reduce((a, b) => a + b, 0) || n;
  const raw = weights.map((w) => (w / sumW) * total);

  // round to ints; ensure >=1; fix rounding drift to match total
  let mins = raw.map((x) => Math.max(1, Math.round(x)));
  let diff = total - mins.reduce((a, b) => a + b, 0);
  const order = [...mins.keys()].sort((a, b) => weights[b] - weights[a]);
  for (const i of order) {
    if (diff === 0) break;
    if (diff > 0) { mins[i] += 1; diff -= 1; }
    else if (mins[i] > 1) { mins[i] -= 1; diff += 1; }
  }
  return mins;
}

function buildStepsObjects(steps = [], durations = []) {
  const out = [];
  const n = steps.length;
  for (let i = 0; i < n; i++) {
    const timer = Number.isFinite(durations[i]) ? durations[i] : 5;
    out.push({ timer, Step: String(steps[i] || "").trim() });
  }
  return out;
}

/* -------------------- ADD: OpenAI image helper -------------------- */
async function generateRecipeImageUrl({ apiKey, title }) {
  try {
    const prompt = `
A delicious and appetizing food photograph of homemade "${title}".
The entire dish is visible in the frame, in a rustic ceramic dish on a wooden table.
Shot from above at a slight angle like a food blog photo.
The food looks fresh and irresistible with rich colors and realistic textures.
Focus is sharp on the whole dish; background softly blurred.
Natural daylight, warm tones, authentic homemade food photography.
No steam. No CGI, no 3D render, no illustration.
No people, no hands, no text, no labels, no extra props.
`.trim();

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        n: 1,
        style: "natural",
        response_format: "url",
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.warn("Image gen failed:", res.status, msg);
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.url || null;
  } catch (e) {
    console.warn("Image gen error:", e?.message || e);
    return null;
  }
}

/** Ask GPT for recipes with time + difficulty */
const fetchRecipesFromGPT = async ({
  productTitles,
  apiKey,
  count = 6,
  model = "gpt-5",
}) => {
const systemPrompt = `
You are a helpful multilingual recipe creator.

Input is a list of real-world PRODUCT or FOOD TITLES (brands / many languages).
Task: propose ${count} realistic recipes that mostly use these items (+ pantry staples like oil/salt/pepper).

Each recipe MUST include:
- "title" (short)
- "ingredients" (6–12 strings)
- "steps" (4–8 concise steps)
- "time_minutes" (integer, 5–180)
- "difficulty" ("easy" or "medium")

Rules:
- Easy recipes: quick (<40 min), simple steps.
- Medium recipes: longer or with more steps.

ADDITIONAL REQUIREMENTS (do not remove anything above):
- Also include "steps_timed": an array of 1–10 objects describing the same process with per-step timers.
- Each object in "steps_timed" MUST include:
  { "index": number (1..N), "title": "string", "instruction": "string", "duration_min": number }
- Include a separate array "step_durations_min": numbers aligned 1:1 with "steps" (same length). Each entry is the duration in minutes for the corresponding step.
- "steps" MUST NOT contain inline durations (no "(~10 min)" etc.). Keep them clean, concise actions.
- "steps_timed" and "step_durations_min" must align with "steps" content (same overall process).
- The sum of all per-step durations (either "steps_timed.*.duration_min" or "step_durations_min") should approximately equal "time_minutes".

NEW (object-per-step shape requested):
- Also include "steps_objects": an array with the same length and order as "steps".
- Each entry MUST be exactly: { "timer": number, "Step": "string" }
  - "timer" = integer minutes for that step
  - "Step"  = the concise instruction text for that step (same wording as in "steps")
- "steps_objects" must align 1:1 with "steps". Do NOT include extra fields.

Return STRICT JSON only:
{ "recipes": [{
  "title":"string",
  "ingredients":["string"],
  "steps":["string"],                             // no inline times here
  "step_durations_min":[number],                  // same length/order as "steps"
  "steps_timed":[{ "index": number, "title":"string", "instruction":"string", "duration_min": number }],
  "steps_objects":[{ "timer": number, "Step": "string" }],   // <-- exact shape you asked for
  "time_minutes": number,
  "difficulty": "easy" | "medium"
}] }
`.trim();


  const userPrompt =
    `My fridge/pantry product titles:\n` +
    productTitles.map((t) => `- ${t}`).join("\n");

  const body = {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`OpenAI error: ${res.status} ${msg}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.recipes)) {
    throw new Error("Model did not return expected JSON schema.");
  }
  return parsed.recipes;
};

/** Save/merge recipes under /users/{uid}/Recipes/{slug(title)} */
const saveRecipesToFirestore = async ({
  recipes,
  productTitles,
  model,
  apiKey,            // 👈 NEW: to allow image generation here
  withImages = true, // 👈 toggle if you want
}) => {
  const uid = getAuth()?.currentUser?.uid;
  if (!uid || !recipes?.length) return;

  const db = getFirestore();
  const col = collection(db, "users", uid, "Recipes");

  const now = serverTimestamp();

  const writes = recipes.map(async (r) => {
    const title = toStr(r?.title, "Recipe");
    const id = slug(title);
    const ref = doc(col, id);

    // ----- compute steps_objects if missing -----
    const steps = Array.isArray(r?.steps) ? r.steps : [];
    const total = toInt(r?.time_minutes, 0);
    const givenDurations = Array.isArray(r?.step_durations_min) ? r.step_durations_min : null;
    const durations =
      givenDurations && givenDurations.length === steps.length
        ? givenDurations.map((n) => toInt(n, 5))
        : allocateDurations(steps, total);

    const steps_objects = Array.isArray(r?.steps_objects) && r.steps_objects.length === steps.length
      ? r.steps_objects.map((o, i) => ({
          timer: toInt(o?.timer, toInt(durations[i], 5)),
          Step: toStr(o?.Step, steps[i] || ""),
        }))
      : buildStepsObjects(steps, durations);

    // ----- NEW: generate image (non-blocking if it fails) -----
    let image_url = null;
    if (withImages && apiKey) {
      image_url = await generateRecipeImageUrl({ apiKey, title });
    }

    const payload = {
      title,
      ingredients: Array.isArray(r?.ingredients) ? r.ingredients : [],
      steps,
      step_durations_min: durations,
      steps_objects,
      steps_timed: Array.isArray(r?.steps_timed) ? r.steps_timed : [],
      time_minutes: toInt(r?.time_minutes, null),
      difficulty: r?.difficulty === "medium" ? "medium" : "easy",
      source: "gpt",
      model: toStr(model, ""),
      based_on: productTitles,
      image_url,               // 👈 saved field
      updated_at: now,
      created_at: now,
    };

    await setDoc(ref, payload, { merge: true });
  });

  await Promise.all(writes);
};

/* ----------------------- component ----------------------- */

export default function RecipesFromInventory({
  model = "gpt-5",
  count = 6,
  auto = true,
  header = "Cook With What You Have",
  horizontal = true,
}) {
  const [invDocs, setInvDocs] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const { present, isS3Open, isS8Open, isS9Open } = useSheets();
  const {
    CurrentReceipeFromInventory, setCurrentReceipeFromInventory,
  } = useAddToInventory()

  // 🔁 We ALWAYS render from Firestore Recipes (not API memory)
  const [recipesDocs, setRecipesDocs] = useState([]);
  const [loadingRecipesColl, setLoadingRecipesColl] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // ⚠️ Your API key (dev only). Move to secure config/env for prod.
  const apiKey =
    "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";

  /* 1) Listen to Inventory */
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) {
      setLoadingInv(false);
      setInvDocs([]);
      return;
    }
    const db = getFirestore();
    const colRef = collection(db, "users", uid, "Inventory");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvDocs(data);
        setLoadingInv(false);
      },
      (err) => {
        console.warn("Inventory listen failed:", err?.message || err);
        setLoadingInv(false);
      }
    );
    return () => unsub();
  }, []);

  /* 2) Listen to Recipes collection (we render from here) */
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) {
      setRecipesDocs([]);
      setLoadingRecipesColl(false);
      return;
    }
    const db = getFirestore();
    const colRef = collection(db, "users", uid, "Recipes");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // sort: newest updated first
          .sort(
            (a, b) => toDate(b.updated_at) - toDate(a.updated_at)
          );
        setRecipesDocs(data);
        setLoadingRecipesColl(false);
      },
      (err) => {
        console.warn("Recipes listen failed:", err?.message || err);
        setLoadingRecipesColl(false);
      }
    );
    return () => unsub();
  }, []);

  /* 3) Titles to feed to GPT */
  const productTitles = useMemo(() => titlesFromInventory(invDocs), [invDocs]);

  /* 4) Generate & save (UI always reads back from Firestore) */
  const inFlight = useRef(false);
  const generate = useCallback(async () => {
    if (!apiKey) {
      setError("Missing OpenAI API key");
      return;
    }
    if (!productTitles.length) {
      setError("No items in your Inventory.");
      return;
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setError("");
    setGenerating(true);
    try {
      const result = await fetchRecipesFromGPT({
        productTitles,
        apiKey,
        count,
        model,
      });

      await saveRecipesToFirestore({
        recipes: result,
        productTitles,
        model,
        apiKey,            // 👈 pass here so images are created & saved
        withImages: true,
      });

      // UI will refresh via the Recipes onSnapshot listener
    } catch (e) {
      setError(e?.message || "Failed to generate recipes");
    } finally {
      setGenerating(false);
      inFlight.current = false;
    }
  }, [apiKey, productTitles, count, model]);

  /* 5) Optional auto-generate on inventory change */
  useEffect(() => {
    if (!auto) return;
    if (!productTitles.length) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productTitles.join("|"), auto]);


  const difficultyColor = (diff) => {
  switch ((diff || "easy").toLowerCase()) {
    case "easy":
      return "#5BC951";
    case "medium":
      return "#FF8C03";
    case "hard":
      return "#FF1B1E";
    default:
      return "#555";
  }
};


  /* ---- Card UI ---- */
 const renderRecipe = ({ item: r }) => (
    <TouchableOpacity onPress={() => {
      setCurrentReceipeFromInventory(r)
      present("Receipes_From_Inventory")
    }}
    activeOpacity={0.8}
      style={{
        backgroundColor: "#fff",
        width: horizontal ? size(170) : "92%",
        marginRight: horizontal ? width(3) : 0,
        marginBottom: horizontal ? 0 : 14,
        padding: 14,
        height: 200,
        borderRadius: 16,
        ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 10 },
        android: { elevation: 6, shadowColor: "#888" },
        }),
      }}
    >
      <Text  style={{ fontWeight: "800", fontSize: size(16), marginTop: height(2), marginBottom: 4 }}>
        {toStr(r?.title, "Recipe")}
      </Text>

     <Text
      style={{
        fontSize: size(15),
        fontWeight: "700",
        marginLeft: width(5),
        position: "absolute",
        bottom: height(6),
        color: difficultyColor(r?.difficulty),
      }}
    >
      {r?.difficulty || "easy"}
    </Text>
      <Text style={{ fontSize: size(12), marginLeft: width(5), color: "#A5AEB8", position: 'absolute', bottom: height(3) }}>
         {r?.time_minutes ? `${r.time_minutes} min` : "—"} · {r?.difficulty || "easy"}
      </Text>

     
    </TouchableOpacity>
  );

  const busy = generating || loadingInv || loadingRecipesColl;




// distance from the start of one pair to the next pair start
const PAIR_WIDTH = (CARD_W + GAP) + (CARD_W + GAP); // 2 cards + 2 gaps



// constants
const CARD_W = size(170);
const GAP = width(3);
const PADDING_H = width(5);

// precompute snap offsets (2 cards per snap)
const snapOffsets = Array.from(
  { length: recipesDocs.length / 2 },
  (_, i) => i * ((CARD_W + GAP) * 2)
);




  return (
    <View style={{ width: "100%" }}>
  

      {/* Status / Errors */}
      {loadingInv ? (
        <View style={{ paddingHorizontal: width(5), marginBottom: 8 }}>
          <ActivityIndicator color="#000" />
        </View>
      ) : !productTitles.length ? (
        <Text style={{ paddingHorizontal: width(5), color: "#555", marginBottom: 8 }}>
          Add some items to your Inventory to get recipe ideas.
        </Text>
      ) : null}

      {!!error && (
        <Text style={{ color: "#C00", paddingHorizontal: width(5), marginBottom: 10 }}>
          {error}
        </Text>
      )}

      {/* Recipes from Firestore */}

<FlatList style={{
  height: height(30)
}}
  horizontal={horizontal}
  showsHorizontalScrollIndicator={false}
  data={recipesDocs}
  keyExtractor={(item) => item.id}
  contentContainerStyle={{
    paddingHorizontal: PADDING_H,
    paddingTop: height(3),
    paddingBottom: height(10),
    paddingBottom: height(15),
  }}
  ListEmptyComponent={
    busy ? (
      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 12,
        }}
      >
        <ActivityIndicator color="#000" />
      </View>
    ) : (
      <Text style={{ paddingHorizontal: width(5), color: "#555" }}>
        No recipes yet.
      </Text>
    )
  }
  renderItem={renderRecipe}
  // 🔽 snapping-by-2 setup
  decelerationRate="fast"
  snapToAlignment="start"
  disableIntervalMomentum
  snapToOffsets={snapOffsets}
/>

    </View>
  );
}
