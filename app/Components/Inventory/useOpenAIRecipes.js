// useOpenAIRecipesPrefetch.js
// Prefetch up to N recipes once, then reveal pageSize at a time as user scrolls.
// ⚠️ Do NOT ship your OpenAI key in a production client app.
// For production, proxy this request via your server and omit apiKey here.

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
  const apiKey =
    "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";

const COLORS = { Easy: "#00CE39", Medium: "#FF8C03", Hard: "#FE1B20" };

// ---- helpers --------------------------------------------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Build a compact representation of inventory so prompts are small & stable.
function buildCompactInventory(items = []) {
  const now = Date.now();
  return (items || []).map((it) => {
    const title = (it.title || it.name || "").toString().trim().slice(0, 60);
    const qty = Number.isFinite(it.quantity) ? it.quantity : 1;
    const unit = it.unit || null;
    let days = null;
    const exp = it.expirationDate || it.expires_at || null;
    if (exp) {
      const d = new Date(exp);
      if (!isNaN(d)) days = Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
    }
    return { title, qty, unit, daysToExpiry: days };
  });
}

// Simple fast hash for cache keys (djb2)
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function normalizeRecipes(arr = []) {
  return arr.map((r, i) => {
    const lvl = ["Easy", "Medium", "Hard"].includes(r?.difficulty?.level)
      ? r.difficulty.level
      : "Easy";
    return {
      id: r?.id || String(i + 1),
      title: r?.title || "Untitled Recipe",
      description: r?.description || "",
      image: r?.image ?? null,
      servings: Number.isInteger(r?.servings) ? r.servings : 1,
      cookTime: r?.cookTime || "20 min",
      difficulty: { level: lvl, color: COLORS[lvl] },
      expirationDate: r?.expirationDate || null,
    };
  });
}

async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writeCache(key, val) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ---- hook -----------------------------------------------------------------
/**
 * useOpenAIRecipesPrefetch
 * Calls OpenAI once for up to `totalCount` recipes, caches them, and exposes a paged list.
 *
 * @param {Object} params
 * @param {Array}   params.items                 Firestore inventory array
 * @param {boolean} params.enabled               Start when true (e.g., !loading)
 * @param {number}  [params.totalCount=20]       How many recipes to fetch initially
 * @param {number}  [params.pageSize=5]          How many to reveal per scroll
 * @param {string}  [params.model="o4-mini"]     OpenAI model
 * @param {string}  [params.apiKey]              OpenAI key (prefer server proxy in prod)
 * @param {number}  [params.revalidateMs=21600000]  Cache staleness window (default 6h)
 * @param {string}  [params.cacheKeyPrefix="recipes-v1"]  Cache namespace
 * @param {string}  [params.apiBase="https://api.openai.com"]  Override for proxy/base
 */
export default function useOpenAIRecipesPrefetch({
  items,
  enabled,
  totalCount = 20,
  pageSize = 5,
  model = "o4-mini",
  revalidateMs = 6 * 60 * 60 * 1000,
  cacheKeyPrefix = "recipes-v1",
  apiBase = "https://api.openai.com",
}) {
  const [allRecipes, setAllRecipes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(null);

  // Derived visible slice
  const ramenRecipes = useMemo(
    () => allRecipes.slice(0, visibleCount),
    [allRecipes, visibleCount]
  );
  const recipesEnd = visibleCount >= allRecipes.length;

  const aliveRef = useRef(true);
  const isFetchingRef = useRef(false);
  const abortRef = useRef(null);
  const lastHashRef = useRef(null);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Build stable hash of compact inventory; refetch only if it changes
  const invCompact = useMemo(() => buildCompactInventory(items), [items]);
  const invJson = useMemo(() => JSON.stringify(invCompact), [invCompact]);
  const invHash = useMemo(() => hashString(invJson), [invJson]);
  const cacheKey = `${cacheKeyPrefix}:${invHash}:${totalCount}:${pageSize}:${model}`;

  const setRecipesSafe = useCallback((list) => {
    if (!aliveRef.current) return;
    setAllRecipes(list);
    setVisibleCount((c) => clamp(Math.min(pageSize, list.length), 0, list.length));
  }, [pageSize]);

  const fetchFromOpenAI = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setRecipesLoading(true);
    setRecipesError(null);

    // abort previous if any
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const system =
        `Create up to ${totalCount} distinct recipes using ONLY the inventory below ` +
        `(salt, pepper, water, oil allowed). Prefer soon-to-expire items. ` +
        `Return STRICT JSON only in the schema:\n` +
        `{"recipes":[{"id":"string","title":"string","description":"string","image":"string|null","servings":1,"cookTime":"20 min","difficulty":{"level":"Easy|Medium|Hard","color":"#hex"},"expirationDate":"YYYY-MM-DD|null"}]}\n` +
        `Use these difficulty colors exactly: Easy=${COLORS.Easy}, Medium=${COLORS.Medium}, Hard=${COLORS.Hard}.`;

      const user = `INVENTORY:\n${invJson}`;

      // Prefer proxy in production:
      // const url = "https://<your-api>/recipes";
      const url = `${apiBase}/v1/chat/completions`;

      const headers = apiBase.includes("openai.com")
        ? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" }; // proxy handles auth

      const resp = await axios.post(
        url,
        {
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { timeout: 20000, headers, signal: controller.signal }
      );

      if (!aliveRef.current) return;

      const content = resp?.data?.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { recipes: [] };
      }
      const normalized = normalizeRecipes(parsed.recipes || []);

      // Cache result with timestamp + the inventory hash it corresponds to
      const payload = { ts: Date.now(), hash: invHash, data: normalized };
      writeCache(cacheKey, payload);

      setRecipesSafe(normalized);
      lastHashRef.current = invHash;
    } catch (e) {
      if (!aliveRef.current) return;
      // If aborted, quietly exit
      if (axios.isCancel?.(e) || e?.name === "CanceledError" || e?.message === "canceled") {
        return;
      }
      console.warn("OpenAI fetch failed:", e?.response?.data || e?.message || e);
      setRecipesError("Couldn’t generate recipes.");
      setAllRecipes([]);
      setVisibleCount(0);
    } finally {
      if (aliveRef.current) setRecipesLoading(false);
      isFetchingRef.current = false;
    }
  }, [apiBase, apiKey, cacheKey, invHash, invJson, model, setRecipesSafe, totalCount]);

  // Main effect: load from cache fast, then revalidate if stale or hash changed.
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      // If inventory hash unchanged and we already have data, skip everything
      if (lastHashRef.current === invHash && allRecipes.length > 0) return;

      // 1) Try cache (fast path)
      const cached = await readCache(cacheKey);
      if (cancelled) return;

      const now = Date.now();
      const isValid =
        cached &&
        Array.isArray(cached.data) &&
        cached.hash === invHash &&
        now - Number(cached.ts || 0) < revalidateMs;

      if (isValid) {
        setRecipesSafe(cached.data);
        lastHashRef.current = invHash;
        // No network needed if fresh
        return;
      }

      // 2) If cache exists but stale, show it immediately (stale-while-revalidate)
      if (cached && Array.isArray(cached.data)) {
        setRecipesSafe(cached.data);
      }

      // 3) Revalidate from network
      await fetchFromOpenAI();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, invHash, cacheKey, revalidateMs]); // (fetch deps are stable via useCallback)

  // Public actions
  const loadMoreRecipes = useCallback(() => {
    if (recipesEnd) return;
    setVisibleCount((c) => clamp(c + pageSize, 0, allRecipes.length));
  }, [recipesEnd, pageSize, allRecipes.length]);

  const refreshRecipes = useCallback(async () => {
    // Force a network refresh; keep current cache while revalidating.
    await fetchFromOpenAI();
  }, [fetchFromOpenAI]);

  const clearRecipesCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(cacheKey);
      // Don’t mutate lastHashRef; let next effect re-evaluate.
    } catch {}
  }, [cacheKey]);

  return {
    // visible slice (5, 10, 15, ...)
    ramenRecipes,
    recipesLoading,
    recipesError,
    recipesEnd,

    // full set
    allRecipes,

    // actions
    loadMoreRecipes,
    refreshRecipes,
    clearRecipesCache,
  };
}
