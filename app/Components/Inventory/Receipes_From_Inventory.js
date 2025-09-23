// PaywallView.js (Receipes_From_Inventory)

import { useAddToInventory } from "@/app/Context/AddToInventoryContext";
import { useSheets } from "@/app/Context/SheetsContext";

import { ArrowLeft, CookingPot, Timer } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

export default function Receipes_From_Inventory() {
  const { CurrentReceipeFromInventory } = useAddToInventory();

  // ⚠️ move to secure storage / .env in production
  const OPENAI_API_KEY =
    "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";

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null); // kept (unused) to avoid touching your state shape
  const [stepIndex, setStepIndex] = useState(0);
  const { present, dismiss, isS3Open, isS8Open, isS9Open } = useSheets();

  const recipe = CurrentReceipeFromInventory ?? {};
  const {
    title = "Recipe",
    ingredients = [],
    steps = [],
    steps_timed = [],
    steps_objects = [],
    step_durations_min = [],
    time_minutes,
    difficulty,
    servings: recipeServings,
  } = recipe;

  // 🔎 pick the Firestore image URL only (no generation here)
  const heroUrl = useMemo(() => {
    const candidates = [
      recipe?.image_url,
      recipe?.imageUrl,
      recipe?.image,
      recipe?.photo_url,
      recipe?.photo?.url,
    ];
    const firstHttp = candidates.find(
      (u) => typeof u === "string" && /^https?:\/\//i.test(u)
    );
    return firstHttp || null;
  }, [recipe]);

  useEffect(() => {



      console.log("Recipe hero image (from Firestore):", CurrentReceipeFromInventory?.image_url);
    
  }, [heroUrl]);

  // ------------------ NEW: servings & scaling helpers ------------------
  const baseServings = Number.isFinite(recipeServings) && recipeServings > 0 ? recipeServings : 2;
  const [servings, setServings] = useState(baseServings);

  useEffect(() => {
    setServings(baseServings);
    setStepIndex(0);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  const UNICODE_FRAC = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅕": 0.2,
    "⅖": 0.4,
    "⅗": 0.6,
    "⅘": 0.8,
  };

  function parseMixedNumber(str) {
    for (const [ch, val] of Object.entries(UNICODE_FRAC)) {
      if (str.includes(ch)) {
        const m = str.match(new RegExp(`(\\d+)?\\s*${ch}`));
        if (m) {
          const whole = m[1] ? parseFloat(m[1]) : 0;
          return { value: whole + val, matched: m[0] };
        }
      }
    }
    let m = str.match(/(\d+)\s+(\d+)\/(\d+)/);
    if (m) {
      const whole = parseFloat(m[1]);
      const num = parseFloat(m[2]);
      const den = parseFloat(m[3]) || 1;
      return { value: whole + num / den, matched: m[0] };
    }
    m = str.match(/(\d+)\/(\d+)/);
    if (m) {
      const num = parseFloat(m[1]);
      const den = parseFloat(m[2]) || 1;
      return { value: num / den, matched: m[0] };
    }
    m = str.match(/\d+[.,]\d+/);
    if (m) {
      return { value: parseFloat(m[0].replace(",", ".")), matched: m[0] };
    }
    m = str.match(/\d+/);
    if (m) {
      return { value: parseFloat(m[0]), matched: m[0] };
    }
    return null;
  }

  function formatScaled(val, ing) {
    const lower = ing.toLowerCase();
    const isWeightVol =
      /\b(g|gram|grams|ml|milliliter|milliliters|kg|kilogram|l|liter|litre|oz|ounce|lb|pound)\b/.test(
        lower
      );
    const isSpoonCup = /\b(tbsp|tablespoon|tsp|teaspoon|cup|cups)\b/.test(lower);

    if (isWeightVol) return String(Math.round(val));
    if (isSpoonCup) return String(Math.round(val * 10) / 10);
    return Math.abs(val - Math.round(val)) < 0.001 ? String(Math.round(val)) : String(Math.round(val * 10) / 10);
  }

  function scaleIngredient(ing, factor) {
    const found = parseMixedNumber(ing);
    if (!found) return ing;
    const scaled = found.value * factor;
    const pretty = formatScaled(scaled, ing);
    return ing.replace(found.matched, pretty);
  }

  const scaledIngredients = useMemo(() => {
    const factor = servings / baseServings;
    if (!Array.isArray(ingredients) || factor === 1) return ingredients || [];
    return ingredients.map((ing) => scaleIngredient(String(ing || ""), factor));
  }, [ingredients, servings, baseServings]);

  // ---- per-step timer + text sources ----
  const stepsData = useMemo(() => {
    if (Array.isArray(steps_timed) && steps_timed.length) {
      return steps_timed.map((s, i) => ({
        title: s?.title || `Step ${i + 1}`,
        text: s?.instruction || steps?.[i] || "",
        mins: Number.isFinite(s?.duration_min) ? s.duration_min : null,
      }));
    }
    if (Array.isArray(steps_objects) && steps_objects.length) {
      return steps_objects.map((s, i) => ({
        title: `Step ${i + 1}`,
        text: s?.Step || steps?.[i] || "",
        mins: Number.isFinite(s?.timer) ? s.timer : null,
      }));
    }
    return (steps || []).map((st, i) => ({
      title: `Step ${i + 1}`,
      text: st,
      mins:
        Number.isFinite(step_durations_min?.[i]) && step_durations_min[i] > 0
          ? step_durations_min[i]
          : null,
    }));
  }, [steps, steps_timed, steps_objects, step_durations_min]);

  const tools = useMemo(() => {
    const base = ["knife", "cutting board", "bowl"];
    if (steps?.some((s) => /bake|oven/i.test(s))) base.push("baking dish", "oven");
    if (steps?.some((s) => /saucepan|simmer|sauce pan/i.test(s))) base.push("saucepan");
    if (steps?.some((s) => /pan|skillet|nonstick/i.test(s))) base.push("nonstick pan");
    return Array.from(new Set(base));
  }, [steps]);

  const stepsAnchorRef = useRef(null);
  const scrollRef = useRef(null);

  const progress = stepsData?.length ? (stepIndex + 1) / stepsData.length : 0;

  const diffColor =
    (difficulty || "easy").toLowerCase() === "medium" ? "#FF8C03" : "#5BC951";

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ height: height(100), width: "100%", backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: height(30) }}
      >
        {/* HERO IMAGE */}
        <View style={{ width: "100%", height: height(45), backgroundColor: "#eee" }}>
          {heroUrl ? (
            <Image
              key={heroUrl} // force refresh if url changes
              source={{ uri: heroUrl }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f4f4f4",
              }}
            >
              {loading ? (
                <ActivityIndicator size="large" />
              ) : (
                <Text style={{ color: "#999" }}>Image will appear here</Text>
              )}
            </View>
          )}

          {/* Top overlay actions like the screenshot */}
          <View
            style={{
              position: "absolute",
              top: height(2.2),
              left: width(4),
              right: width(4),
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
            <Pressable
              onPress={() => {}}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16 }}>🔗</Text>
            </Pressable>
          </View>
        </View>

        {/* TITLE & BADGES */}
        <View style={{ paddingHorizontal: width(5), paddingTop: height(5) }}>
          <Text style={{ fontSize: size(22), fontWeight: "800", marginBottom: 8 }}>
            {title}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: height(3), marginBottom: height(1.5) }}>
            {typeof time_minutes === "number" && <Badge text={`${time_minutes} min`} />}
            {difficulty && <Badge text={difficulty} color={diffColor} />}
          </View>
        </View>

        {/* INGREDIENTS SECTION */}
        <View style={{ paddingHorizontal: width(5),   marginTop: height(2), paddingTop: height(1.5) }}>
          <Text style={{ fontSize: size(18), fontWeight: "800", marginBottom: 12 }}>
            Ingredients
          </Text>

          {/* Servings row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: height(3),
            }}
          >
            <Text style={{ fontSize: size(14), color: "#444" }}>
              {servings} Servings
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StepperButton  onPress={() => setServings((s) => Math.max(1, s - 1))} label="−" />
              <View
                style={{
                  width:  size(35),
                  height:  size(35),
                  borderRadius: 10,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: size(16), fontWeight: "700" }}>{servings}</Text>
              </View>
              <StepperButton onPress={() => setServings((s) => Math.min(12, s + 1))} label="+" />
            </View>
          </View>

          {/* Ingredients list (scaled) */}
          <View style={{ marginBottom: 16 }}>
            {scaledIngredients?.map((ing, i) => (
              <View
                key={`${i}-${ing}`}
                style={{ flexDirection: "row", marginTop: height(2), alignItems: "flex-start", marginBottom: 6 }}
              >
                <Text style={{ width: 10, }}>•</Text>
                <Text style={{ flex: 1, fontSize: size(14), color: "#222" }}>{ing}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* UTENSILS */}
        <InfoRow icon={<CookingPot size={20} />} label={tools.join(" • ")} />

        {/* STEPS SECTION */}
        <View ref={stepsAnchorRef} style={{ paddingHorizontal: width(5), paddingTop: height(3) }}>
          <Text style={{ fontSize: size(18), fontWeight: "800", marginBottom: height(2) }}>Steps</Text>

          {/* Step content with timer */}
          {stepsData?.length ? (
            <>
              <Text style={{ fontSize: size(15), marginBottom: height(2), lineHeight: size(22), color: "#333" }}>
                {stepsData[stepIndex]?.text}
              </Text>

              {Number.isFinite(stepsData[stepIndex]?.mins) && (
                <View style={{ flexDirection: "row", marginBottom: height(2), alignItems: 'center' }}>
                  <Timer size={20} />
                  <Text
                    style={{
                      fontWeight: "800",
                      marginLeft: width(2),
                      color: "#151515",
                      fontSize: size(14),
                    }}
                  >
                    {stepsData[stepIndex].mins} min
                  </Text>
                </View>
              )}

              {/* progress bar */}
              <View
                style={{
                  height: 6,
                  backgroundColor: "#eee",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginTop: height(2),
                  marginBottom: height(1.5),
                }}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: "100%",
                    backgroundColor: "#151515",
                  }}
                />
              </View>

              {/* index tabs */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: height(3),
                }}
              >
                {stepsData.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setStepIndex(i)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: height(5.2),
                      backgroundColor: i === stepIndex ? "#151515" : "#eaeaea",
                      marginHorizontal: 4,
                      borderRadius: 6,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: i === stepIndex ? "#fff" : "#444",
                        fontWeight: "700",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={{ color: "#666" }}>No steps available.</Text>
          )}
        </View>
      </ScrollView>

      {/* prev/next controls */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
          width: "90%",
          alignSelf: 'center',
          position: 'absolute',
          bottom: height(4),
        }}
      >
        <Pressable
          onPress={() => {
            dismiss("Receipes_From_Inventory")
          }}
          style={{
            position: "absolute",
            backgroundColor: "#151515",
            height: size(60),
            paddingHorizontal: size(30),
            left: width(1),
            flexDirection: 'row',
            width: "auto",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            bottom: height(10),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.32,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <ArrowLeft size={20} color={"#fff"} />
          <Text style={{ color: "#fff", marginLeft: width(2), fontWeight: "700" }}>
            Back
          </Text>
        </Pressable>
      </View>
    </>
  );
}

/* ---------- small presentational helpers ---------- */

function Badge({ text, color = "#f2f2f2" }) {
  const isTextOnly = color === "#f2f2f2";
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: isTextOnly ? "#f2f2f2" : `${color}22`,
        borderRadius: 14,
      }}
    >
      <Text style={{ fontWeight: "700", color: isTextOnly ? "#333" : color }}>
        {text}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label }) {
  return (
    <View
      style={{
        paddingHorizontal: width(5),
        paddingVertical: height(1.8),
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#eee",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: height(1),
      }}
    >
      <Text style={{ fontSize: size(18) }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: size(14), color: "#333", lineHeight: size(20) }}>
        {label}
      </Text>
    </View>
  );
}

function StepperButton({ onPress, label }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: size(35),
        height: size(35),
        borderRadius: 10,
        backgroundColor: "#151515",
        alignItems: "center",
        justifyContent: "center",
      }} 
    >
      <Text style={{ fontSize: size(18), color: "#fff", fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function NavButton({ label, onPress, disabled, primary }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        height: height(6),
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled ? "#ddd" : primary ? "#151515" : "#f2f2f2",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.32,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <Text style={{ color: disabled ? "#999" : primary ? "#fff" : "#333", fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
