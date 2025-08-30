// app/Context/AddToInventoryContext.js
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

/**
 * Tiny parsers to pull "pieces" count & net weight from noisy text like:
 *  - "16 COFFEE PADS", "x16", "16 Stück", "16 sachets"
 *  - "500 g", "0.75 L", "750ml", "1 kg", "250 g (16x15.6 g)"
 */
const PIECE_WORDS = [
  "pads", "pad", "sachets", "sachet", "sticks", "stick",
  "tassen", "beutel", "beute", "beutel", "capsules", "capsule",
  "stück", "stk", "pcs", "pieces", "packs", "pack", "tabs", "tab",
];
const COUNT_PATTERNS = [
  // e.g., "16 COFFEE PADS", "16 Stück", "16 sachets"
  new RegExp(String.raw`(^|\s)(\d{1,4})\s*(?:${PIECE_WORDS.join("|")})\b`, "i"),
  // e.g., "x16", "×16"
  /[x×]\s?(\d{1,4})\b/i,
  // e.g., "16-pack", "16er"
  /\b(\d{1,4})\s*[-]?\s*(?:pack|er)\b/i,
];

function parsePiecesCount(...texts) {
  for (const raw of texts) {
    const t = String(raw || "");
    if (!t) continue;
    for (const re of COUNT_PATTERNS) {
      const m = t.match(re);
      if (m) {
        const num = Number(m[2] ?? m[1]);
        if (Number.isFinite(num) && num > 0) {
          return { piecesCount: num, piecesText: m[0].trim() };
        }
      }
    }
  }
  return { piecesCount: null, piecesText: "" };
}

const WEIGHT_UNITS = [
  { re: /\b(\d+(?:[.,]\d+)?)\s*(kg)\b/i, multG: 1000 },
  { re: /\b(\d+(?:[.,]\d+)?)\s*(g)\b/i, multG: 1 },
  { re: /\b(\d+(?:[.,]\d+)?)\s*(l)\b/i, multG: 1000 }, // treat 1 L ≈ 1000 g if density ~1
  { re: /\b(\d+(?:[.,]\d+)?)\s*(ml)\b/i, multG: 1 },
];

function parseNetWeight(...texts) {
  for (const raw of texts) {
    const t = String(raw || "");
    if (!t) continue;
    for (const { re, multG } of WEIGHT_UNITS) {
      const m = t.match(re);
      if (m) {
        const val = Number(String(m[1]).replace(",", "."));
        if (Number.isFinite(val)) {
          // also handle patterns like "(16 x 7 g)" — prefer per-piece*count if present
          const multi = t.match(/\b(\d{1,4})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
          if (multi) {
            const c = Number(multi[1]);
            const per = Number(String(multi[2]).replace(",", "."));
            const u = multi[3].toLowerCase();
            const perG = u === "g" ? per : per; // ml≈g
            return {
              netWeightValue: c * per,
              netWeightUnit: u,
              netWeightG: Math.round(c * perG),
              netWeightText: multi[0],
            };
          }
          return {
            netWeightValue: val,
            netWeightUnit: m[2].toLowerCase(),
            netWeightG: Math.round(val * multG),
            netWeightText: m[0],
          };
        }
      }
    }
  }
  return { netWeightValue: null, netWeightUnit: "", netWeightG: null, netWeightText: "" };
}

/** ---------- Context ---------- **/

const AddToInventoryContext = createContext(null);

export function AddToInventoryProvider({ children }) {
  // Parsed / user-editable pack info
  const [piecesCount, setPiecesCount] = useState(null);   // e.g., 16
  const [piecesText, setPiecesText]   = useState("");     // e.g., "16 COFFEE PADS"
  const [netWeightValue, setNetWeightValue] = useState(null); // numeric (as printed)
  const [netWeightUnit, setNetWeightUnit]   = useState("");   // "g" | "kg" | "ml" | "l"
  const [netWeightG, setNetWeightG]   = useState(null);       // normalized to grams/ml≈g
  const [netWeightText, setNetWeightText] = useState("");

  // Optional “servings” semantics if you want them in UI
  const [servingsPerPack, setServingsPerPack] = useState(null); // model/user estimate
  const totalServingsEstimate = useMemo(() => {
    if (Number.isFinite(servingsPerPack)) return servingsPerPack;
    if (Number.isFinite(piecesCount)) return piecesCount;
    // as a last resort, ~1 serving per 250 ml / 250 g:
    if (Number.isFinite(netWeightG)) return Math.max(1, Math.round(netWeightG / 250));
    return null;
  }, [servingsPerPack, piecesCount, netWeightG]);

  // Storage/organization
  const [storageLocation, setStorageLocation] = useState("pantry"); // "pantry" | "fridge" | "freezer"
  const [category, setCategory] = useState("general");
  const [quantityRemaining, setQuantityRemaining] = useState(null); // for partial packs

  // Best-before (can be prefilled from model)
  const [bestBeforeISO, setBestBeforeISO] = useState("");
  const [bestBeforeText, setBestBeforeText] = useState("");

  // Bookkeeping
  const [lastSavedDocId, setLastSavedDocId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Apply model JSON (from your OpenAI step) to populate pack info */
  const applyFromModel = useCallback((model) => {
    const t1 = model?.title || "";
    const t2 = model?.product_title || "";
    const t3 = model?.brand ? `${model.brand} ${model.product_title || ""}` : "";
    const ingText = Array.isArray(model?.allergens) ? model.allergens.join(", ") : "";
    const joined = [t1, t2, t3, model?.serving_size || "", ingText, model?.best_before_text || ""].join("  ");

    const pieces = parsePiecesCount(t1, t2, joined);
    setPiecesCount(pieces.piecesCount);
    setPiecesText(pieces.piecesText);

    const net = parseNetWeight(t1, t2, joined);
    setNetWeightValue(net.netWeightValue);
    setNetWeightUnit(net.netWeightUnit);
    setNetWeightG(net.netWeightG);
    setNetWeightText(net.netWeightText);

    if (model?.best_before_date_iso) setBestBeforeISO(model.best_before_date_iso);
    if (model?.best_before_text) setBestBeforeText(model.best_before_text);
  }, []);

  /** Merge this context’s fields into your Firestore payload just before saving */
  const augmentInventoryPayload = useCallback((payload = {}) => {
    return {
      ...payload,
      pack_meta: {
        pieces_count: Number.isFinite(piecesCount) ? piecesCount : null,
        pieces_text: piecesText || "",
        net_weight_value: Number.isFinite(netWeightValue) ? netWeightValue : null,
        net_weight_unit: netWeightUnit || "",
        net_weight_g: Number.isFinite(netWeightG) ? netWeightG : null,
        net_weight_text: netWeightText || "",
        servings_per_pack: Number.isFinite(servingsPerPack) ? servingsPerPack : null,
        total_servings_estimate: Number.isFinite(totalServingsEstimate) ? totalServingsEstimate : null,
      },
      storage: {
        location: storageLocation,
        category,
        quantity_remaining: Number.isFinite(quantityRemaining) ? quantityRemaining : null,
      },
      best_before_date_iso: payload.best_before_date_iso || bestBeforeISO || "",
      best_before_text: payload.best_before_text || bestBeforeText || "",
    };
  }, [
    piecesCount, piecesText,
    netWeightValue, netWeightUnit, netWeightG, netWeightText,
    servingsPerPack, totalServingsEstimate,
    storageLocation, category, quantityRemaining,
    bestBeforeISO, bestBeforeText,
  ]);

  /** Load from an existing Firestore document */
  const applyFromFirestore = useCallback((docData = {}) => {
    const pack = docData.pack_meta || {};
    setPiecesCount(Number.isFinite(pack.pieces_count) ? pack.pieces_count : null);
    setPiecesText(pack.pieces_text || "");
    setNetWeightValue(Number.isFinite(pack.net_weight_value) ? pack.net_weight_value : null);
    setNetWeightUnit(pack.net_weight_unit || "");
    setNetWeightG(Number.isFinite(pack.net_weight_g) ? pack.net_weight_g : null);
    setNetWeightText(pack.net_weight_text || "");
    setServingsPerPack(Number.isFinite(pack.servings_per_pack) ? pack.servings_per_pack : null);

    const storage = docData.storage || {};
    setStorageLocation(storage.location || "pantry");
    setCategory(storage.category || "general");
    setQuantityRemaining(Number.isFinite(storage.quantity_remaining) ? storage.quantity_remaining : null);

    setBestBeforeISO(docData.best_before_date_iso || "");
    setBestBeforeText(docData.best_before_text || "");
    setLastSavedDocId(docData.__id || null);
  }, []);

  const reset = useCallback(() => {
    setPiecesCount(null);
    setPiecesText("");
    setNetWeightValue(null);
    setNetWeightUnit("");
    setNetWeightG(null);
    setNetWeightText("");
    setServingsPerPack(null);
    setStorageLocation("pantry");
    setCategory("general");
    setQuantityRemaining(null);
    setBestBeforeISO("");
    setBestBeforeText("");
    setLastSavedDocId(null);
    setSaving(false);
    setError("");
  }, []);

  const value = useMemo(
    () => ({
      // state
      piecesCount, setPiecesCount,
      piecesText, setPiecesText,
      netWeightValue, setNetWeightValue,
      netWeightUnit, setNetWeightUnit,
      netWeightG, setNetWeightG,
      netWeightText, setNetWeightText,
      servingsPerPack, setServingsPerPack,
      totalServingsEstimate,
      storageLocation, setStorageLocation,
      category, setCategory,
      quantityRemaining, setQuantityRemaining,
      bestBeforeISO, setBestBeforeISO,
      bestBeforeText, setBestBeforeText,
      lastSavedDocId, setLastSavedDocId,
      saving, setSaving,
      error, setError,

      // helpers
      applyFromModel,
      applyFromFirestore,
      augmentInventoryPayload,
      reset,
    }),
    [
      piecesCount, piecesText,
      netWeightValue, netWeightUnit, netWeightG, netWeightText,
      servingsPerPack, totalServingsEstimate,
      storageLocation, category, quantityRemaining,
      bestBeforeISO, bestBeforeText,
      lastSavedDocId, saving, error,
      applyFromModel, applyFromFirestore, augmentInventoryPayload, reset,
    ]
  );

  return (
    <AddToInventoryContext.Provider value={value}>
      {children}
    </AddToInventoryContext.Provider>
  );
}

export function useAddToInventory() {
  const ctx = useContext(AddToInventoryContext);
  if (!ctx) throw new Error("useAddToInventory must be used inside <AddToInventoryProvider>");
  return ctx;
}
