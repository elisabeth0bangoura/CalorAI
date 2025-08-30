// useOpenAIRecipesPrefetch.js
// Fetch up to 20 recipes from OpenAI ONCE, then reveal 5 at a time as user scrolls.
// ⚠️ For prototyping only: do NOT ship your OpenAI key in a mobile app release.

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = { Easy: "#00CE39", Medium: "#FF8C03", Hard: "#FE1B20" };
  const OPENAI_API_KEY =
    "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";

// Keep payload compact for speed
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

/**
 * useOpenAIRecipesPrefetch
 * Calls OpenAI once for up to `totalCount` recipes, then exposes a paged list (pageSize = 5).
 *
 * @param {Object} params
 * @param {Array}   params.items     Firestore inventory array
 * @param {boolean} params.enabled   Start when true (e.g., !loading)
 * @param {number}  [params.totalCount=20]  How many recipes to fetch initially
 * @param {number}  [params.pageSize=5]     How many to reveal per scroll
 * @param {string}  [params.model="o4-mini"] OpenAI model (no temperature with o4-mini)
 * @param {string}  [params.apiKey=process.env.EXPO_PUBLIC_OPENAI_API_KEY] OpenAI key
 */
export default function useOpenAIRecipesPrefetch({
  items,
  enabled,
  totalCount = 20,
  pageSize = 5,
  model = "o4-mini",
  apiKey = OPENAI_API_KEY
}) {
  const [allRecipes, setAllRecipes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(null);

  // derive visible slice
  const ramenRecipes = useMemo(
    () => allRecipes.slice(0, visibleCount),
    [allRecipes, visibleCount]
  );
  const recipesEnd = visibleCount >= allRecipes.length;

  // prevent state updates after unmount
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // Refetch when items change and enabled
  useEffect(() => {
    if (!enabled) return;

    (async () => {
      setRecipesLoading(true);
      setRecipesError(null);

      try {
        const inventory = buildCompactInventory(items);

        const system =
          `Create up to ${totalCount} distinct recipes using ONLY the inventory below ` +
          `(salt, pepper, water, oil allowed). Prefer soon-to-expire items. ` +
          `Return STRICT JSON only:\n` +
          `{"recipes":[{"id":"string","title":"string","description":"string","image":"string|null","servings":1,"cookTime":"20 min","difficulty":{"level":"Easy|Medium|Hard","color":"#hex"},"expirationDate":"YYYY-MM-DD|null"}]}\n` +
          `Difficulty colors: Easy=${COLORS.Easy}, Medium=${COLORS.Medium}, Hard=${COLORS.Hard}.`;

        const user = `INVENTORY:\n${JSON.stringify(inventory)}`;

        const resp = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model, // "o4-mini" -> no temperature param
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          },
          { timeout: 20000, headers: { Authorization: `Bearer ${apiKey}` } }
        );

        if (!aliveRef.current) return;

        const content = resp?.data?.choices?.[0]?.message?.content || "{}";
        let parsed; try { parsed = JSON.parse(content); } catch { parsed = { recipes: [] }; }
        const normalized = normalizeRecipes(parsed.recipes || []);

        setAllRecipes(normalized);
        setVisibleCount(Math.min(pageSize, normalized.length));
      } catch (e) {
        if (!aliveRef.current) return;
        console.error("OpenAI fetch failed:", e?.response?.data || e?.message || e);
        setRecipesError("Couldn’t generate recipes.");
        setAllRecipes([]);
        setVisibleCount(0);
      } finally {
        if (aliveRef.current) setRecipesLoading(false);
      }
    })();
  }, [enabled, items, totalCount, pageSize, model, apiKey]);

  const loadMoreRecipes = useCallback(() => {
    if (recipesEnd) return;
    setVisibleCount((c) => Math.min(c + pageSize, allRecipes.length));
  }, [recipesEnd, pageSize, allRecipes.length]);

  const refreshRecipes = useCallback(() => {
    // trigger by toggling enabled externally or changing items;
    // or you can force by resetting state here if desired
    setVisibleCount(pageSize);
  }, [pageSize]);

  return {
    // what your UI will use:
    ramenRecipes,       // visible slice (5, 10, 15, ...)
    recipesLoading,
    recipesError,
    recipesEnd,

    // keep full set if you need it:
    allRecipes,

    // actions:
    loadMoreRecipes,    // call on scroll end
    refreshRecipes,     // optionally re-show first page
  };
}
