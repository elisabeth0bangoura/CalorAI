// ./Cameras/Scan_Food_Camera.js
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { height, width } from "react-native-responsive-sizes";
import PageAfterScan_Add_To_Inventory from "../PageAfterScan/PageAfterScan_Add_To_Inventory/PageAfterScan_Add_To_Inventory";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
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

/* ----------------- helpers ----------------- */
const toNum = (n, d = 0) => (Number.isFinite(+n) ? +n : d);
const toStr = (s, d = "Scanned item") =>
  typeof s === "string" && s.trim().length ? s.trim() : d;

const allZeroish = (a) => {
  if (!a) return true;
  const nums = [
    a?.calories_kcal_total,
    a?.protein_g,
    a?.fat_g,
    a?.sugar_g,
    a?.carbs_g,
    a?.fiber_g,
    a?.sodium_mg,
  ].map((x) => toNum(x, 0));
  const itemsEmpty = !Array.isArray(a?.items) || a.items.length === 0;
  return nums.every((x) => x === 0) && itemsEmpty;
};

// extract “16 pads”, “x16”, “20 tea bags”, …
function fallbackUnitsFromText(txt = "") {
  const t = String(txt).toLowerCase();
  const m =
    t.match(
      /(\d{1,3})\s*(?:x|×)?\s*(coffee\s*pads?|pads?|teebeutel|tea\s*bags?|pcs|pieces?|stück|stueck|sachets?|sticks?|pods?|kapseln?|bars?|beutel|portionen|servings?)/i
    ) || t.match(/(?:x|×)\s*(\d{1,3})/i);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  if (!Number.isFinite(count)) return null;
  const label = (m[2] || "pieces").trim();
  return { units_per_pack: count, unit_label: label, unit_count_confidence: "estimated" };
}

// keep icon as-is with small fallback (no static list)
const safeIconName = (s) => {
  const name = typeof s === "string" ? s.trim() : "";
  return name.length ? name.slice(0, 40) : "Utensils";
};

// tiny timeout helper for API calls
const withTimeout = (p, ms, tag = "op") =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${tag} timed out after ${ms}ms`)), ms)
    ),
  ]);

/* ----------------------- HEALTH PROFILE + PROMS ---------------------------- */
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
  if (m.startsWith("low")) return 10;  // g/day
  if (m.startsWith("high")) return 20;
  return 13;                           // default
};

const looksCaffeinated = ({ title, items }) => {
  const hay = [
    String(title || ""),
    ...(Array.isArray(items) ? items.map(i => `${i?.name || ""} ${i?.subtitle || ""}`) : []),
  ].join(" ").toLowerCase();
  return /(coffee|espresso|latte|cappuccino|americano|mocha|cold\s*brew|energy\s*drink|caffeine|mate|yerba|guarana|cola|tea|matcha)/i.test(hay);
};
const buildHealthPrompts = ({ macros, profile, product }) => {
  const lines = [];
  const parts = {};

  // Kidney
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
    parts.kidney = kidney;      // ⟵ no emoji
    lines.push(kidney);         // ⟵ no emoji
  }

  // Heart
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
    parts.heart = heart;        // ⟵ no emoji
    lines.push(heart);          // ⟵ no emoji
  }

  // Diabetes
  if (profile?.diabetesSettings) {
    let diabetes = `Diabetes: `;
    const flags = [];
    if (macros.carbs_g != null && macros.carbs_g >= 45) flags.push(`carbs ${macros.carbs_g} g`);
    if (macros.sugar_g != null && macros.sugar_g >= 15) flags.push(`sugars ${macros.sugar_g} g`);
    if (macros.fiber_g != null && macros.fiber_g < 4)   flags.push(`low fiber (${macros.fiber_g} g)`);
    diabetes += flags.length
      ? flags.join(", ") + ` — pair with lean protein/veg or halve the portion.`
      : `no major flags detected for this serving.`;
    parts.diabetes = diabetes;  // ⟵ no emoji
    lines.push(diabetes);       // ⟵ no emoji
  }

  // Habits
  const caffeinated = looksCaffeinated(product || {});
  if (profile?.habits?.reduceCoffee) {
    let coffee = `Coffee: you're cutting back. `;
    coffee += caffeinated
      ? `This looks caffeinated — try decaf or a smaller size today.`
      : `Nice — this seems caffeine-free.`;
    parts.reduceCoffee = coffee; // ⟵ no emoji
    lines.push(coffee);
  }
  if (profile?.habits?.stopSmoking) {
    let smoke = `Stop smoking: keep momentum. `;
    smoke += caffeinated
      ? `Coffee can be a trigger; swap with water or take a short walk after.`
      : `Use meals as a cue to breathe deeply instead of lighting up.`;
    parts.stopSmoking = smoke;   // ⟵ no emoji
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

/* --------------------- /HEALTH PROFILE + PROMS ---------------------------- */

/* ----------------- component ----------------- */
export default forwardRef(function InventoryCamera(
  { inCarousel = false, isActive = false, onScanResult, onScanList },
  ref
) {
  const { register, present, isS2Open, isS3Open } = useSheets();

  // NOTE: you currently use a hard-coded key here. Consider wiring it from props or secure storage.
  const OPENAI_API_KEY_FALLBACK =
    "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";
  const EFFECTIVE_OPENAI_KEY = OPENAI_API_KEY_FALLBACK;

  // ⚡ speed toggles
  const IMAGE_QUALITY = 0.35;
  const MINI_TIMEOUT_MS = 9000;

  const {
    setImageUrl,
    setCloudUrl,
     imageUrl,
      cloudUrl,
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
    expirationDate,
    expirationDateNote,
    setProms, // 👈 add proms to context/UI
  } = useScanResults();
  const { currentItemId, setCurrentItemId } = useCurrentScannedItemId();

  // register S3 once
  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan_Add_To_Inventory {...props} />);
  }, [register]);


  useEffect(() => {
      console.log("cloudUrl ", cloudUrl)
       console.log("cloudUrl ", cloudUrl)
  }, [cloudUrl])

  const cameraRef = useRef(null);
  const autoOnce = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  const shouldShowCamera = isS2Open && isActive && !isS3Open;

  // ✅ Cleanup camera + staged timers when S2 closes
  useEffect(() => {
    if (!isS2Open) {
      console.log("[Camera] S2 closed → unmounting camera & clearing timers");
      clearStagedTimers();
      cameraRef.current = null;     // drop camera ref
      autoOnce.current = false;     // reset auto trigger
      setLoading(false);            // stop loading spinner
    }
  }, [isS2Open]);

  // staged loader timers (so we can cancel when finishing)
  const stagedTimersRef = useRef([]);
  const clearStagedTimers = () => {
    stagedTimersRef.current.forEach((t) => clearTimeout(t));
    stagedTimersRef.current = [];
  };

  // fast snapshot
  const takeFast = async () => {
    if (!cameraRef.current) return null;
    try {
      return await cameraRef.current.takePictureAsync({
        quality: IMAGE_QUALITY,
        skipProcessing: true,
        base64: true,
        exif: false,
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

  // ---------- OpenAI analysis ----------
  async function analyzeFood({
    imageUrl,
    imageBase64,
    apiKey,
    forceEstimate = false,
    model = "gpt-4o-mini",
    preferSameBrand = true,
    sameBrandOnly = false,
  }) {
    const schema = `
{
  "title": "string",
  "calories_kcal_total": number,
  "protein_g": number,
  "fat_g": number,
  "sugar_g": number,
  "carbs_g": number,
  "fiber_g": number,
  "sodium_mg": number,
  "health_score": number,
  "units_per_pack": number,
  "unit_label": "string",
  "unit_count_confidence": "extracted|estimated|",
  "net_quantity": { "value": number, "unit": "g|kg|ml|l|oz", "text": "string" },
  "serving_size": "string",
  "servings_per_container": number,
  "items": [ { "name": "string", "subtitle": "string", "calories_kcal": number, "icon": "string" } ],
  "alternatives": [ { "name": "string", "calories_diff": number } ],
  "expiration_iso": "",
  "expiration_hint": "",
  "experationDate": "",
  "experationDateNote": ""
}`.trim();

    const brandPolicy = sameBrandOnly
      ? `Alternatives MUST be from the SAME BRAND as the detected product. If the brand cannot be confidently read, provide generic category alternatives WITHOUT brand names.`
      : preferSameBrand
      ? `Prefer SAME-BRAND alternatives when the brand is readable. Include the brand name in the alternative "name".`
      : `Brand is optional; generic alternatives are fine.`;

    const systemPrompt = `
Return ONE JSON object (no prose/markdown).

If PACKAGED PRODUCT:
- Include BRAND in title if visible.
- Extract net contents and piece counts.
- Capture expiration: ISO date if readable, otherwise "" and a helpful location hint.

If COOKED:
- Title = concise dish.
- items = visible components with calories.

Alternatives:
- ${brandPolicy}
- 3–8 options, calories_diff = alt_total_kcal - current_total_kcal.

General:
- Use realistic values; ${forceEstimate ? "estimate if needed" : "avoid all-zeros unless truly none"}.
- Health score [0..10].
- No extra keys.

Schema:
${schema}
`.trim();

    const imgPart = imageUrl
      ? { type: "image_url", image_url: { url: imageUrl } }
      : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

    const body = {
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 360,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: [{ type: "text", text: "Analyze and return ONLY the JSON object." }, imgPart] },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${errText || "request failed"}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || "{}";
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Model returned non-JSON content.");
    }
  }

  // normalize + push to context + save
  const applyFinalResult = async ({ analyzed, uid, cloudUrl, profile }) => {
    // infer units if missing
    if (analyzed && !toNum(analyzed?.units_per_pack, 0)) {
      const fromTxt = fallbackUnitsFromText(
        [
          analyzed?.title,
          analyzed?.net_quantity?.text,
          ...(Array.isArray(analyzed?.items) ? analyzed.items.map(i => `${i?.name} ${i?.subtitle || ""}`) : []),
        ].filter(Boolean).join(" ")
      );
      if (fromTxt) Object.assign(analyzed, fromTxt);
    }

    const titleSafe = toStr(analyzed?.title, "Scanned item");
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

    const items = Array.isArray(analyzed?.items) ? analyzed.items : [];
    const itemsSafe = items.map((it) => ({
      name: toStr(it?.name, "Item"),
      subtitle: toStr(it?.subtitle, ""),
      calories_kcal: toNum(it?.calories_kcal, 0),
      icon: safeIconName(it?.icon),
    }));
    setList?.(itemsSafe);
    onScanList?.(itemsSafe);

    // ✅ Build personalized proms (uses profile)
    const proms = buildHealthPrompts({
      macros: { sodium_mg: sodium, carbs_g: carbs, fat_g: fat, fiber_g: fiber, sugar_g: sugar, protein_g: protein },
      profile,
      product: { title: titleSafe, items: itemsSafe },
    });
    setProms?.(proms);

    const modelAlts = Array.isArray(analyzed?.alternatives) ? analyzed.alternatives : [];
    const alts = new Map();
    modelAlts.forEach((a) => {
      const o = { name: toStr(a?.name, ""), calories_diff: toNum(a?.calories_diff, 0) };
      if (o.name) alts.set(o.name.toLowerCase(), o);
    });
    const finalAlts = Array.from(alts.values()).slice(0, 8);
    setAlternatives?.(finalAlts);

    setTitle(titleSafe);
    setCalories(kcalSafe);
    setProtein(protein);
    setFat(fat);
    setSugar(sugar);
    setCarbs(carbs);
    setFiber(fiber);
    setSodium(sodium);
    setHealthScore(health);

    const resultBlob = {
      ...analyzed,
      items: itemsSafe,
      alternatives: finalAlts,
      expiration_iso: analyzed?.expiration_iso ?? "",
      expiration_hint: analyzed?.expiration_hint ?? "",
      experationDate: analyzed?.experationDate ?? analyzed?.expiration_iso ?? "",
      experationDateNote: analyzed?.experationDateNote ?? analyzed?.expiration_hint ?? "",
      proms,                // 👈 include in UI result blob too
      profile_used: proms?.profile_used || null,
      _ready: true,
    };

    // ✅ Stop any staged timers before flipping to ready
    clearStagedTimers();

    setResult(resultBlob);
    setRaw(JSON.stringify(resultBlob));
    onScanResult?.(resultBlob);

    // save to Firestore
    try {
      const db = getFirestore();
      const colRef = collection(db, "users", uid, "Inventory");
      const docRef = await addDoc(colRef, {
        title: titleSafe,
        calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
        protein_g: protein,
        fat_g: fat,
        sugar_g: sugar,
        carbs_g: carbs,
        fiber_g: fiber,
        sodium_mg: sodium,
        health_score: health,
        items: itemsSafe,
        alternatives: finalAlts,
        units_per_pack: toNum(analyzed?.units_per_pack, 0),
        unit_label: toStr(analyzed?.unit_label, ""),
        unit_count_confidence: toStr(analyzed?.unit_count_confidence, ""),
        net_quantity:
          analyzed?.net_quantity && typeof analyzed.net_quantity === "object"
            ? analyzed.net_quantity
            : { value: 0, unit: "", text: "" },
        serving_size: toStr(analyzed?.serving_size, ""),
        servings_per_container: toNum(analyzed?.servings_per_container, 0),

        // personalized health prompts
        proms,                        // 👈 saved
        profile_used: proms?.profile_used || null, // 👈 saved

        image_local_uri: imageUrl,
        image_cloud_url: cloudUrl,
        scanned_at_pretty: formatScannedAt?.() || null,
        expirationDate:
          (expirationDate && String(expirationDate)) ||
          analyzed?.expiration_iso ||
          analyzed?.experationDate ||
          "",
        expirationDateNote:
          (expirationDateNote && String(expirationDateNote)) ||
          analyzed?.expiration_hint ||
          analyzed?.experationDateNote ||
          "",
        created_at: serverTimestamp(),
        raw: JSON.stringify(resultBlob),
        result: resultBlob,
      });

      // ✅ Save the new doc ID in context
      setCurrentItemId(docRef.id);
      addLog("Saved to Firestore with ID: " + docRef.id);
    } catch (err) {
      addLog(`[ERR] Firestore save: ${err?.message || err}`);
    }
  };

  // Do the scan (exposed + used internally)
  const doScan = async () => {
    try {
      if (!isS2Open || !isActive || !cameraRef.current) {
        console.log("Camera not ready", "Open the camera tab before scanning.");
        return;
      }

      if (!permission?.granted) {
        const req = await requestPermission();
        if (!req?.granted) return;
      }

      const uid = getAuth()?.currentUser?.uid;
      if (!uid) {
        console.log("Not signed in", "Please sign in to save to Inventory.");
        return;
      }

      if (!EFFECTIVE_OPENAI_KEY) {
        console.log("Missing OpenAI API key");
        return;
      }

      // 🔹 Load health profile BEFORE analysis
      const profile = await fetchUserHealthProfile(uid, addLog);

      resetScan();
      addLog("Scan started");
      setLoading(true);

      // 1) SNAPSHOT
      const pic = await takeFast();
      if (!pic?.uri) {
        console.log("Scan failed", "No photo captured.");
        addLog("[ERR] No photo captured");
        setLoading(false);
        return;
      }

      // 2) Show sheet immediately with local preview (LoadingPage)
      clearStagedTimers();
      setResult({ _ready: false, _stage: 0 });  // <- loader starts at 0 and will step forward
      setRaw("");
      setImageUrl(pic.uri);
      markScannedNow();
      present?.("s3");
      setLoading(false);

      // 🟢 Staged progress: 0 → 20 → 80 (no loops). Final 100% happens when _ready=true.
      stagedTimersRef.current.push(
        setTimeout(() => {
          setResult((prev) => (prev && prev._ready === false ? { ...prev, _stage: 20 } : prev));
        }, 700)
      );
      stagedTimersRef.current.push(
        setTimeout(() => {
          setResult((prev) => (prev && prev._ready === false ? { ...prev, _stage: 80 } : prev));
        }, 2200)
      );

      // 3) Upload (start right away)
      addLog("Uploading image…");
      let cloudUrl = null;
      const uploadPromise = (async () => {
        try {
          const url = await withTimeout(
            uploadImageToStorage({ fileUri: pic.uri, uid }),
            15000,
            "upload"
          );
          cloudUrl = url;
          setCloudUrl(url);
          addLog("Upload done.");
          return url;
        } catch (e) {
          addLog(`[ERR] Upload: ${e?.message || e}`);
          return null;
        }
      })();

      // 4) Analyze (mini)
      addLog("Analyzing (mini)…");
      let analyzed = null;
      try {
        analyzed = await withTimeout(
          analyzeFood({
            imageBase64: pic.base64 || "",
            apiKey: EFFECTIVE_OPENAI_KEY,
            model: "gpt-4o-mini",
            preferSameBrand: true,
          }),
          MINI_TIMEOUT_MS,
          "mini-analysis"
        );
      } catch (e) {
        addLog(`[ERR] mini-analysis: ${e?.message || e}`);
      }

      // If mini result is usable -> apply and finish
      if (analyzed && !allZeroish(analyzed)) {
        await uploadPromise; // ensure we have URL for saving
        await applyFinalResult({ analyzed, uid, cloudUrl, profile });
        clearStagedTimers();
        return;
      }

      // Otherwise, refine using best image URL
      addLog("Refining with full model…");
      const urlForRefine = (cloudUrl || (await uploadPromise)) || null;
      try {
        const better = await analyzeFood({
          imageUrl: urlForRefine || undefined,
          imageBase64: urlForRefine ? undefined : (pic.base64 || ""),
          apiKey: EFFECTIVE_OPENAI_KEY,
          forceEstimate: true,
          model: "gpt-4o",
          preferSameBrand: true,
        });

        if (better && !allZeroish(better)) {
          await applyFinalResult({ analyzed: better, uid, cloudUrl, profile });
          clearStagedTimers();
        } else {
          addLog("Vision returned empty; still waiting.");
          setResult((prev) => ({ ...(prev || {}), _ready: false }));
        }
      } catch (e) {
        addLog(`[warn] refine: ${e?.message || e}`);
        setResult((prev) => ({ ...(prev || {}), _ready: false }));
      }
    } catch (e) {
      addLog(`[ERR] flow: ${e?.message || e}`);
      console.log("Failed", e?.message || "Something went wrong.");
    }
  };

  // expose doScan via ref
  useImperativeHandle(ref, () => ({ scan: doScan }));

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
        {shouldShowCamera ? (
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
              onCameraReady={() => addLog("Camera ready")}
            />
          </View>
        ) : null}

        {/* Show overlay only while sheet is NOT open */}
        {loading && !isS3Open && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: "#fff", marginTop: 12, fontWeight: "700" }}>
              Preparing…
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
