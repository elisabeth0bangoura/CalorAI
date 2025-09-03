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
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, width } from "react-native-responsive-sizes";
import PageAfterScan from "../PageAfterScan/PageAfterScan_Scan_Food/PageAfterScan_Scan_Food";

// ✅ RN Firebase Storage (native API)
import storage from "@react-native-firebase/storage";

// ✅ Firestore (v22 modular API) — added for saving results
import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp
} from "@react-native-firebase/firestore";

/* ----------------- helpers ----------------- */
function toNum(n, d = 0) {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v : d;
}
function toStr(s, d = "Scanned meal") {
  return typeof s === "string" && s.trim().length ? s.trim() : d;
}

// 🔎 a small known-safe list of Lucide icon names we’ll accept from the model
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

function safeIconName(s) {
  const name = typeof s === "string" ? s.trim() : "";
  return LUCIDE_SAFE.has(name) ? name : "Utensils";
}

// Approx kcal per medium whole fruit (or common portion)
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
  const keys = Object.keys(FRUIT_KCAL);
  for (const k of keys) {
    if (t.includes(k)) return k;
  }
  if (t.includes("fruit")) return "apple";
  return null;
}

// Build alternatives list vs base fruit (ONLY less calories than scanned item)
function fallbackAlternatives(title = "", totalKcal = 0) {
  const base = pickBaseFruitFromTitle(title) || "apple";
  const baseKcal = totalKcal || FRUIT_KCAL[base] || 95;

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
    if (name === base) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const kcal = FRUIT_KCAL[name];
    if (!kcal) continue;
    const pretty = name.charAt(0).toUpperCase() + name.slice(1);
    const diff = Math.round(kcal - baseKcal);
    if (diff < 0) {
      list.push({ name: pretty, calories_diff: diff }); // negative = fewer
    }
  }
  // sort by most similar (closest negative) first
  list.sort((a, b) => Math.abs(a.calories_diff) - Math.abs(b.calories_diff));
  return list.slice(0, 6);
}

export default forwardRef(function Scan_Food_Camera(
  {
    inCarousel = false,
    isActive = false,
    onScanResult,
    onScanList,
 
    openAiApiKey,
  },
  ref
) {


  const userId = getAuth().currentUser.uid;


  const { register, present, isS2Open, isS3Open } = useSheets();

  // ⚠️ Dev-only fallback; use a secure backend in production.
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
    setList,          // if your context has setList, we’ll fill it (optional)
    markScannedNow,   // ✅ stamp the scan time in context
    formatScannedAt,  // ✅ human-friendly formatter (e.g., “22. Mai 17:20 Uhr”)
     scanBusy, beginScan, endScan,
  } = useScanResults();




  function localDateId(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;           // e.g. "2025-09-03"
}



  // Register s3 content once
  const didRegister = useRef(false);
  useEffect(() => {
    if (!register || didRegister.current) return;
    didRegister.current = true;
    register("s3", (props) => <PageAfterScan {...props} />);
  }, [register]);

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  const takeFast = async () => {
    if (!cameraRef.current) return null;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      return pic;
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

  // --- OpenAI analysis (forces all keys + icons for items) ---
  const analyzeFoodUrl = async ({ imageUrl, apiKey }) => {
    const systemPrompt = `
You are Calorie AI. Detect the food(s) and estimate nutrition.

Return STRICT JSON ONLY with ALL keys present (no prose). If unknown, use 0. Items represent the
main components/ingredients of the meal. For each item, include a short "subtitle" (e.g., "1 bun",
"with ketchup", "1 medium") and a Lucide icon name. If you are unsure about an icon, use "Utensils".

Valid lucide icon names to prefer: ${Array.from(LUCIDE_SAFE).join(", ")}.

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
  "items": [
    {
      "name": "string",
      "subtitle": "string",
      "calories_kcal": number,
      "icon": "string"
    }
  ],
  "alternatives": [
    { "name": "string", "calories_diff": number }
  ]
}
Rules:
- Always include every key above.
- "health_score" must be in 0..10.
- Items should roughly sum near total calories (they can be approximate).
`.trim();

    const body = {
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this meal and return the JSON exactly as specified." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.2,
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
    const text = json?.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text);
  };

  useImperativeHandle(ref, () => ({
    scan: async () => {
      let _startedGlobal = false; // track beginScan/endScan pairing
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
        beginScan();            // 🔴 start global busy
        _startedGlobal = true;

        addLog("Scan started");
        setLoading(true);

        const pic = await takeFast();
        if (!pic?.uri) {
          Alert.alert("Scan failed", "No photo captured.");
          addLog("[ERR] No photo captured");
          return;
        }

        // ✅ Set the image and stamp the scan time right away
        setImageUrl(pic.uri);
        markScannedNow();
        addLog(`Stamped scan time: ${formatScannedAt?.() || "now"}`);

        present?.("s3");
        addLog("Preview shown (S3 opened)");

        let downloadUrl = null;
        try {
          addLog("Uploading to Firebase…");
          downloadUrl = await uploadImageToStorage({ fileUri: pic.uri, uid: userId });
          setCloudUrl(downloadUrl);
          addLog("Upload done");
        } catch (e) {
          addLog(`[ERR] Upload: ${e?.message || e}`);
          Alert.alert("Upload failed", e?.message || "Could not upload image.");
          return;
        }

        try {
          addLog("Analyzing with OpenAI…");
          const analyzed = await analyzeFoodUrl({ imageUrl: downloadUrl, apiKey: EFFECTIVE_OPENAI_KEY });

          setResult(analyzed);
          setRaw(JSON.stringify(analyzed));

          const titleSafe  = toStr(analyzed?.title, "Scanned meal");
          const kcalSafe   = toNum(analyzed?.calories_kcal_total, null);
          const protein    = toNum(analyzed?.protein_g, 0);
          const fat        = toNum(analyzed?.fat_g, 0);
          const sugar      = toNum(analyzed?.sugar_g, 0);
          const carbs      = toNum(analyzed?.carbs_g, 0);
          const fiber      = toNum(analyzed?.fiber_g, 0);
          const sodium     = toNum(analyzed?.sodium_mg, 0);
          let   health     = toNum(analyzed?.health_score, 0);
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

          // ✅ normalize items with icons + push to context (and callback)
          const items = Array.isArray(analyzed?.items) ? analyzed.items : [];
          const itemsSafe = items.map((it) => ({
            name: toStr(it?.name, "Item"),
            subtitle: toStr(it?.subtitle, ""),
            calories_kcal: toNum(it?.calories_kcal, 0),
            icon: safeIconName(it?.icon),
          }));
          setList?.(itemsSafe);
          onScanList?.(itemsSafe);

          // ✅ Alternatives — only fewer calories than scanned item
          const modelAlts = Array.isArray(analyzed?.alternatives) ? analyzed.alternatives : [];
          const altsSafe = modelAlts
            .map(a => ({ name: toStr(a?.name, ""), calories_diff: toNum(a?.calories_diff, 0) }))
            .filter(a => a.name.length > 0 && a.calories_diff < 0);

          const fallbacks = fallbackAlternatives(titleSafe, kcalSafe);

          // merge + dedupe + sort by closest negative first
          const byName = new Map();
          [...altsSafe, ...fallbacks].forEach(a => {
            if (a.calories_diff < 0) {
              const key = a.name.toLowerCase();
              if (!byName.has(key)) byName.set(key, a);
            }
          });
          const finalAlts = Array.from(byName.values())
            .sort((a, b) => Math.abs(a.calories_diff) - Math.abs(b.calories_diff))
            .slice(0, 6);

          setAlternatives?.(finalAlts);

          // ✅ SAVE TO FIRESTORE (stable ID if available)
          try {
            const db = getFirestore();
            const colRef = collection(db, "users", userId, "RecentlyEaten");

            // Prefer a stable document id based on markScannedNow() timestamp if your context exposes it.
            // If your context stores the raw timestamp somewhere accessible, you can tap it here.
            // Since we only have a pretty formatter, we’ll just use addDoc (auto-id).
            addLog("Saving scan to Firestore…");

            const payload = {
              // nutrition
              title: titleSafe,
              calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
              protein_g: protein,
              fat_g: fat,
              sugar_g: sugar,
              carbs_g: carbs,
              fiber_g: fiber,
              sodium_mg: sodium,
              health_score: health,

              // arrays
              items: itemsSafe,
              alternatives: finalAlts,

              // media + time
              image_local_uri: pic.uri || null,
              image_cloud_url: downloadUrl || null,
              scanned_at_pretty: formatScannedAt?.() || null,
              created_at: serverTimestamp(),

              // raw/model
              raw: JSON.stringify(analyzed),
              result: analyzed,
            };

            // If you later expose a stable timestamp (e.g., scannedAt), switch to setDoc(doc(colRef, String(scannedAt)), payload, { merge: true })
            const docRef = await addDoc(colRef, payload);

            addLog(`Saved scan to Firestore [id=${docRef.id}]`);
          } catch (err) {
            const msg = err?.message || String(err);
            addLog(`[ERR] Firestore save: ${msg}`);
            Alert.alert("Firestore save failed", msg);
          }








          try {
            const db = getFirestore();
            const dateId = localDateId();       // only day-month-year (local)

            // ➜ users/{uid}/Today/{dateId}/RecentlyEaten/{autoId}
            const colRef = collection(db, 'users', userId, 'Today', dateId, 'List');

            const payload = {
            title: titleSafe,
            calories_kcal_total: Number.isFinite(kcalSafe) ? kcalSafe : null,
            protein_g: protein,
            fat_g: fat,
            sugar_g: sugar,
            carbs_g: carbs,
            fiber_g: fiber,
            sodium_mg: sodium,
            health_score: health,

            // arrays
            items: itemsSafe,
            alternatives: finalAlts,

            // media + time
            image_local_uri: pic.uri || null,
            image_cloud_url: downloadUrl || null,
            scanned_at_pretty: formatScannedAt?.() || null,
            created_at: serverTimestamp(),

            // raw/model
            raw: JSON.stringify(analyzed),
            result: analyzed,
            };

            const docRef = await addDoc(colRef, payload);
            addLog(`Saved scan to Firestore at Today/${dateId} [id=${docRef.id}]`);
          } catch (err) {
            const msg = err?.message || String(err);
            addLog(`[ERR] Firestore save: ${msg}`);
            Alert.alert('Firestore save failed', msg);
          }






          onScanResult?.(analyzed);
          addLog("Analysis done");
        } catch (e) {
          addLog(`[ERR] OpenAI: ${e?.message || e}`);
          Alert.alert("Analysis failed", e?.message || "Could not analyze image.");
        }
      } finally {
        setLoading(false);
        if (_startedGlobal) endScan(); // 🟢 end global busy
        addLog("Scan finished");
      }
    },
  }));

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text className="primaryText">Grant Permission</Text>
          <Text style={styles.primaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
        {isS2Open && isActive && !isS3Open ? (
          <View style={{ height: "100%", width: "100%" }} pointerEvents={inCarousel ? "none" : "auto"}>
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
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});
