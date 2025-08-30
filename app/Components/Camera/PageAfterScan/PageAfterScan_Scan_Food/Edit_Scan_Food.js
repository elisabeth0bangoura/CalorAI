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

export default function Edit_Scan_FoodScan() {
  const { title, recalcWithEdits, addLog } = useScanResults();
  const { dismiss } = useSheets();
  const insets = useSafeAreaInsets();

  const { currentItemId } = useCurrentScannedItemId();

  // 🔐 current user id (safe fallback)
  const auth = getAuth();
  const userId = auth?.currentUser?.uid || "anon";

  /* ---------- local UI state ---------- */
  const [details, setDetails] = useState(title || "");
  const [unit, setUnit] = useState("g");           // "g" | "oz" | "ml" | "piece"
  const [quantity, setQuantity] = useState("100"); // numeric string
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [updating] = useState(false);              // UI only (no auto updates)
  const [showGuide, setShowGuide] = useState(false);

  // keep text field in sync when context.title changes
  useEffect(() => {
    if (title) setDetails(title);
  }, [title]);

  const animation = useRef(null);

  const itemsFromText = useMemo(() => parseFreeformToItems(details), [details]);

  // sanitize amount as the user types: keep only digits and .,
  const onChangeQty = (txt) => {
    const cleaned = String(txt).replace(/[^\d.,]/g, "");
    setQuantity(cleaned);
  };

  // robust numeric parse (clamped)
  const qtyNumber = useMemo(() => {
    const n = Number(String(quantity).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;   // invalid -> null
    return Math.max(0, Math.min(5000, n));           // clamp 0..5000
  }, [quantity]);

  // quick example chips based on selected unit
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
      default:
        return [];
    }
  }, [unit]);

  // Prevent redundant calls: remember last overrides hash we sent
  const lastHashRef = useRef("");
  const buildHash = (o) => JSON.stringify(o);

  /* ---------- recalc helper (ONLY called by button) ---------- */
  async function doRecalc() {
    const overrides = {
      title: tc(details || ""),
      items: itemsFromText,
      unit,
      servings,
      request_alternatives: true,
    };
    if (qtyNumber !== null) overrides.quantity = qtyNumber;

    const nextHash = buildHash(overrides);
    if (nextHash === lastHashRef.current) {
      addLog?.("EditSheet: skipped recalculation (same inputs)");
      return;
    }
    lastHashRef.current = nextHash;

    try {
      setLoading(true);
      addLog?.("EditSheet: RECALCULATE pressed");

      const updated = await recalcWithEdits({
        openAiApiKey: OPENAI_API_KEY_FALLBACK,
        overrides,
      });

      if (updated?.title) setDetails(updated.title);

      // 🔥 MERGE the edited+recalculated data back to Firestore
      if (!currentItemId) {
        addLog?.("EditSheet: no currentItemId; cannot save edits.");
      } else {
        const db = getFirestore();
        const ref = doc(db, "users", userId, "RecentlyEaten", currentItemId);

        const payload = {
          // track user edits (useful for audit / UX)
          edited_overrides: {
            title: overrides.title,
            items: overrides.items,
            unit: overrides.unit,
            servings: overrides.servings,
            quantity: qtyNumber !== null ? qtyNumber : null,
          },

          // merge any recalculated nutrition from the AI response
          ...(updated && {
            title: updated.title ?? overrides.title,
            calories_kcal_total:
              Number.isFinite(Number(updated?.calories_kcal_total))
                ? Number(updated.calories_kcal_total)
                : null,
            protein_g: Number(updated?.protein_g) || 0,
            fat_g: Number(updated?.fat_g) || 0,
            sugar_g: Number(updated?.sugar_g) || 0,
            carbs_g: Number(updated?.carbs_g) || 0,
            fiber_g: Number(updated?.fiber_g) || 0,
            sodium_mg: Number(updated?.sodium_mg) || 0,
            health_score: Number(updated?.health_score) || 0,
            items: Array.isArray(updated?.items) ? updated.items : overrides.items || [],
            alternatives: Array.isArray(updated?.alternatives) ? updated.alternatives : [],
            // keep the raw blob if your recalc returns it
            updated_raw: JSON.stringify(updated),
          }),

          updated_at: serverTimestamp(),
        };

        await setDoc(ref, payload, { merge: true });
        addLog?.("EditSheet: Firestore merge saved.");
      }
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
            placeholder="e.g., Feuille de manioc with white rice and beef"
            autoCapitalize="none"
            autoCorrect
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}   // no auto recalc
            style={styles.input}
          />

          {/* unit selector */}
          <View style={styles.row}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.label}>Unit</Text>

              {/* tiny toggle for the guide */}
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
              {["g", "oz", "ml", "piece"].map((u) => {
                const active = unit === u;
                return (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)} // just set, no recalc
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* collapsible, compact guide */}
            {showGuide && (
              <View style={styles.guideCard}>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>Piece</Text> = one whole item (1 sandwich, 1 egg). Use decimals for halves (e.g., <Text style={styles.bold}>0.5</Text> piece).
                </Text>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>g / oz</Text> = foods measured by weight (rice, meats, stews, sauces).
                </Text>
                <Text style={styles.guideLine}>
                  <Text style={styles.bold}>ml</Text> = liquids (drinks, soups, smoothies).
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
                placeholder={unit === "piece" ? "1" : unit === "oz" ? "3.5" : "100"}
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.smallInput}
              />
              <Text style={styles.suffix}>{unit}</Text>
            </View>

            {/* example chips */}
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
