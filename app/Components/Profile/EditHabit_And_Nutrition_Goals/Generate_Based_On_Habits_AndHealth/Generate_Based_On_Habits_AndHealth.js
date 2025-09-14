// Generate_Based_On_Habits_And_Health.js
import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MoveLeft, MoveRight } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AccomplishGoalsPage from "./AccomplishGoalsPage";
import AppBlurBottom from "./AppBlurBottom";
import DesiredWeightPage from "./DesiredWeight";
import HeightWeightPage from "./HeightWeightPage";
import HowFastReachingGoalPage from "./HowFastReachingGoalPage";
import HowManyWorkOutsPage from "./HowManyWorkOutsPage";
import ProgressLine from "./ProgressLine";

/* ================= OpenAI & category helpers ================= */

// ⚠️ If possible, move this to env. Keeping your current value so it runs as-is.
const OPENAI_API_KEY = "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";

// Decision space limited to the 7 defaults only
const ALLOWED_CATEGORIES = [
  "calories","protein","carbs","fat","fiber","sugar","sodium"
];

// 🔧 Use `calories` key (not `cal`)
const COLORS = {
  bg: '#ffffff',
  card: '#F4F5F7',
  text: '#0F0F12',
  sub: '#7B7F87',
  divider: '#ECEEF1',
  calories: '#111111',
  protein: '#632EFF',
  carbs: '#F7931A',
  fat: '#FCDB2A',
  fiber: '#A87DD8',
  sugar: '#FF89A0',
  sodium: '#D7A44A',
  // extras (not used in decision; kept for UI)
  coffee: "#C15217",
  cigarette: "#F7931A"
};

// Rule-based fallback (restricted to the 7 defaults)
function pickFallbackCategory(user, data) {
  try {
    const selected = new Set(user?.selectedConditions || []);
    const goal = user?.goal;

    // Diabetes focus
    if (selected.has("diabetesPlan")) {
      if ((data?.carbs?.current ?? 0) > (data?.carbs?.goal ?? Infinity)) return "carbs";
      if ((data?.sugar?.current ?? 0) > (data?.sugar?.goal ?? Infinity)) return "sugar";
    }

    // Kidney/Heart -> sodium
    if (selected.has("kidneyPlan") || selected.has("heartPlan")) {
      if ((data?.sodium?.current ?? 0) >= (data?.sodium?.goal ?? Infinity)) return "sodium";
    }

    // Weight goal -> calories first, then macros needing attention
    if (goal === "lose" || goal === "gain" || goal === "maintain") {
      if ((data?.calories?.current ?? 0) > (data?.calories?.goal ?? Infinity)) return "calories";

      const macroOrder = ["protein","carbs","fat","fiber","sugar"];
      for (const m of macroOrder) {
        const cur = data?.[m]?.current ?? 0;
        const tgt = data?.[m]?.goal ?? 0;
        if (m === "sugar") {
          if (cur > tgt) return "sugar";
        } else {
          if (cur < tgt) return m;
        }
      }
    }

    return "calories";
  } catch {
    return "calories";
  }
}

async function decideWithOpenAI({ user, data }) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key missing.");

  const system = `
You are a health coach. Choose ONE focus category from exactly:
${ALLOWED_CATEGORIES.join(", ")}.

Use goals, conditions (diabetes -> carbs/sugar; kidney/heart -> sodium),
and current vs goal in 'data'.
Return strict JSON: {"category":"<one>","reason":"<short>"}.
`;

  const userMsg = {
    role: "user",
    content: JSON.stringify({ firestoreUser: user, todayData: data, allowed: ALLOWED_CATEGORIES }),
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5", // as requested
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system.trim() },
        userMsg,
      ],
      // GPT-5 only supports default temperature; do not send it.
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${t}`);
  }
  const json = await resp.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  const parsed = raw ? JSON.parse(raw) : null;

  const category = parsed?.category;
  const reason = parsed?.reason || "Model decision";
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error("OpenAI returned invalid category");
  }
  return { category, reason };
}

/* ================= component ================= */

export default function Generate_Based_On_Habits_AndHealth() {
  const router = useRouter();

  const {
    register, present, dismiss, dismissAll,
    isS2Open, setIsS2Open,
    isS3Open, setIsS3Open,
    isS4Open, setIsS4Open,
    isS5Open, setIsS5Open,
    isS6Open, setIsS6Open,
    isS7Open, setIsS7Open,
    isS8Open, setIsS8Open,
    isS9Open, setIsS9Open,
    isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
    isTargetWeightOpen, setIsTargetWeightOpen,
    isCurrentWeightOpen, setIsCurrentWeightOpen,
    isHeightComponentOpen, setIsHeightComponentOpen,
    isBirthDayComponentOpen, setIsBirthDayComponentOpen,
    isDailyStepsComponentOpen, setIsDailyStepsComponentOpen,
    isEditNutritionGoalsComponentOpen, setIsEditNutritionGoalsComponentOpen,
    isGenerate_Based_On_Habits_And_Health, setIsGenerate_Based_On_Habits_And_Health,
  } = useSheets();

  const {
    gender, setGender,
    workouts, setWorkouts,
    unitSystem, setUnitSystem,
    weightUnit, setWeightUnit,

    // goal weight selected on the ruler page
    goalWeightKg, setGoalWeightKg,
    goalWeightLb, setGoalWeightLb,
    goalWeightUnit, setGoalWeightUnit,
    HowFast, setHowFast,

    AccomplishGoal, setAccomplishGoal,
 
    // helpers
    years,
  } = useEditNutrition();

  // ---- STEP STATE (1-based) ----
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Which circular is open locally (kept for your UI)
  const [openCategory, setOpenCategory] = useState(false);

  const steps = useMemo(
    () => [
      <HowManyWorkOutsPage key="one" />,
      <HeightWeightPage key="two" />,
      <AccomplishGoalsPage key="three" />,
      <DesiredWeightPage key="four" />,
      <HowFastReachingGoalPage key="five" />,
    ],
    []
  );
  const total = steps.length;

  const goNext = () => {
    if (step >= total) return;
    setStep((s) => Math.min(total, s + 1));
  };

  const goBack = () => {
    if (step <= 1) return;
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSave = useCallback(async () => {
    if (saving) return; // prevent double taps
    setSaving(true);
    console.log("[Finish] pressed. Starting save…");
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        console.log("Not signed in", "Please log in first.");
        setSaving(false);
        return;
      }
      const db = getFirestore();
      const ref = doc(db, "users", uid);

      // 1) Save the basic payload
      const payload = {
        gender,
        workouts,
        weightUnit,
        unitSystem,
        HowFast: HowFast,
        goalWeight: {
          kg: goalWeightKg ?? null,
          lb: goalWeightLb ?? null,
          unit: goalWeightUnit ?? null,
        },
        AccomplishGoal: AccomplishGoal,
      };
      await setDoc(ref, payload, { merge: true });
      console.log("[Finish] basic profile saved.");

      // 2) Fetch fresh user doc
      const snap = await getDoc(ref);
      const userDoc = snap.exists() ? snap.data() : {};
      console.log("[Finish] fetched user doc.");

      // 3) Today's numbers (replace with live values if you have them)
      const data = {
        calories: { current: 1074, goal: 2200, unit: 'kcal' },
        protein:  { current: 104,  goal: 150,  unit: 'g' },
        carbs:    { current: 97,   goal: 250,  unit: 'g' },
        fat:      { current: 29,   goal: 70,   unit: 'g' },
        fiber:    { current: 25,   goal: 30,   unit: 'g' },
        sugar:    { current: 40,   goal: 50,   unit: 'g' },
        sodium:   { current: 2300, goal: 2300, unit: 'mg' },
      };

      // 4) Decide ONE category among the 7 defaults (non-fatal if fails)
      let decision = null;
      try {
        decision = await decideWithOpenAI({ user: userDoc, data });
        console.log("[Finish] OpenAI decision:", decision);
      } catch (err) {
        console.warn("[Finish] OpenAI failed, using fallback:", err?.message);
        const category = pickFallbackCategory(userDoc, data);
        decision = { category, reason: "Fallback rule-based decision" };
      }

      // 5) Build "enabled" map:
      //    - 7 defaults ON
      //    - coffee ON if AccomplishGoal === "reduce_caffeine"
      //    - cigarette ON if AccomplishGoal === "quit_smoking"
      const enabled = {
        calories:  true,
        protein:   true,
        carbs:     true,
        fat:       true,
        fiber:     true,
        sugar:     true,
        sodium:    true,
        coffee:    AccomplishGoal === "reduce_caffeine",
        cigarette: AccomplishGoal === "quit_smoking",
      };

      // 6) Store enabled + focus + COLORS to users/$uid/AllNeeds/current (non-fatal)
      try {
        const needsRef = doc(db, "users", uid, "AllNeeds", "current");
        await setDoc(
          needsRef,
          {
            enabled,
            focus: decision.category, // which circular to open/highlight
            colors: {
              ...COLORS,
              // ensure defaults exist
              calories: COLORS.calories ?? "#111111",
              protein: COLORS.protein ?? "#632EFF",
              carbs: COLORS.carbs ?? "#F7931A",
              fat: COLORS.fat ?? "#FCDB2A",
              fiber: COLORS.fiber ?? "#A87DD8",
              sugar: COLORS.sugar ?? "#FF89A0",
              sodium: COLORS.sodium ?? "#D7A44A",
            },
            decidedAt: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("[Finish] AllNeeds/current saved (enabled + focus).");
          dismiss("Generate_Based_On_Habits_AndHealth");
      } catch (err) {
        console.warn("[Finish] Failed to write AllNeeds/current:", err?.message);
      }

      // 7) Update local UI
      setOpenCategory(decision.category);

      // 8) Close the sheet
      console.log("[Finish] dismissing sheet.");
    
    } catch (e) {
      console.error("[Finish] Save failed:", e);
      Alert.alert("Save failed", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    gender,
    workouts,
    weightUnit,
    unitSystem,
    HowFast,
    goalWeightKg,
    goalWeightLb,
    goalWeightUnit,
    AccomplishGoal,
    dismiss,
  ]);

  // strict equality so you only finish on the last step
  const isFinish = step === total;

  return (
    <>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ minWidth: 60 }} />
        </View>

        {/* Progress */}
        <ProgressLine step={step} total={total} />

        {/* Body */}
        <View style={{ flex: 1 }}>{steps[step - 1]}</View>

        {/* Footer / Next */}
        <View style={{ padding: 16, zIndex: 1000, position: "absolute" }}>
          <TouchableOpacity
            onPress={() => (isFinish ? handleSave() : goNext())}
            disabled={saving}
            hitSlop={8}
            style={{
              top: height(80),
              paddingVertical: 14,
              flexDirection: "row",
              width: size(140),
              left: width(60),
              height: size(50),
              paddingHorizontal: 20,
              alignItems: "center",
              position: "absolute",
              borderRadius: 15,
              backgroundColor: saving ? "#2b2b2b" : "#000",
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 2, height: 1 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                },
                android: { elevation: 4, shadowColor: "#ccc" },
              }),
              opacity: saving ? 0.8 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {saving ? "Saving…" : isFinish ? "Finish" : "Next"}
            </Text>

            {!isFinish && !saving ? (
              <MoveRight size={18} color="#fff" style={{ position: "absolute", right: width(5) }} />
            ) : null}
          </TouchableOpacity>

          {/* Left: Back (hidden on step 1) */}
          {step > 1 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              style={{
                top: height(80),
                paddingVertical: 14,
                flexDirection: "row",
                width: size(60),
                left: width(5),
                height: size(50),
                paddingHorizontal: 20,
                alignItems: "center",
                position: "absolute",
                borderRadius: 15,
                backgroundColor: "#EDEFF1",
              }}
            >
              <MoveLeft size={25} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                dismiss("Generate_Based_On_Habits_And_Health");
              }}
              hitSlop={10}
              style={{
                top: height(80),
                paddingVertical: 14,
                flexDirection: "row",
                width: size(60),
                left: width(5),
                height: size(50),
                paddingHorizontal: 20,
                alignItems: "center",
                position: "absolute",
                borderRadius: 15,
                backgroundColor: "#EDEFF1",
              }}
            >
              <MoveLeft size={25} />
            </Pressable>
          )}
        </View>
      </View>

      <AppBlurBottom />
    </>
  );
}