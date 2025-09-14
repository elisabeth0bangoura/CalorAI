// RecipesScreen.js
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
// React Native Firebase v22 (modular)
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "@react-native-firebase/firestore";

// Optional: silence RNFB v22 warnings (set before Firebase init)
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// ── OpenAI config ────────────────────────────────────────────────────────────
const API_BASE = "https://api.openai.com";
const API_KEY  =  "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"; // ⚠️ Don’t ship real keys in prod

const MODEL   = "gpt-5"; // or "gpt-4o-mini", etc.
const COLORS  = { Easy: "#00CE39", Medium: "#FF8C03", Hard: "#FE1B20" };
const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ── helpers: stable hashing (no Date.now()) ──────────────────────────────────
function buildInventoryForHash(items = []) {
  return (items || []).map((it) => {
    const title = (it.title || it.name || "").toString().trim().slice(0, 60);
    const qty   = Number.isFinite(it.quantity) ? it.quantity : 1;
    const unit  = it.unit || null;
    const exp   = it.expirationDate || it.expires_at || null;
    const iso   = exp ? new Date(exp).toISOString().slice(0, 10) : null;
    return { title, qty, unit, expirationDate: iso };
  });
}
function buildInventoryForPrompt(items = []) {
  const now = Date.now();
  return (items || []).map((it) => {
    const title = (it.title || it.name || "").toString().trim().slice(0, 60);
    const qty   = Number.isFinite(it.quantity) ? it.quantity : 1;
    const unit  = it.unit || null;
    let days = null;
    const exp = it.expirationDate || it.expires_at || null;
    if (exp) {
      const d = new Date(exp);
      if (!isNaN(d)) days = Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
    }
    return { title, qty, unit, daysToExpiry: days };
  });
}
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
      id: String(r?.id || i + 1),
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

// ── UI card ──────────────────────────────────────────────────────────────────
const RecipeCard = ({ recipe }) => (
  <View style={styles.card}>
    {recipe.image ? (
      <Image source={{ uri: recipe.image }} style={styles.image} />
    ) : (
      <View style={[styles.image, styles.imagePlaceholder]}>
        <Text style={{ color: "#888" }}>No image</Text>
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>{recipe.title}</Text>
      {!!recipe.description && <Text numberOfLines={2} style={styles.desc}>{recipe.description}</Text>}
      <View style={styles.row}>
        <Text style={styles.badge}>👥 {recipe.servings}</Text>
        <Text style={styles.badge}>⏱ {recipe.cookTime}</Text>
        <View style={[styles.diff, { backgroundColor: recipe.difficulty?.color || COLORS.Easy }]}>
          <Text style={styles.diffText}>{recipe.difficulty?.level || "Easy"}</Text>
        </View>
      </View>
    </View>
  </View>
);

// ── Screen (auto-regenerate on Inventory changes) ────────────────────────────
export default function RecipesScreen({
  userId,          // REQUIRED: Firestore path users/{userId}/Inventory
  totalCount = 24,
  pageSize = 6,
}) {
  const db = useMemo(() => getFirestore(), []);

  const [inventory, setInventory] = useState([]);
  const [invLoading, setInvLoading] = useState(true);

  const [recipes, setRecipes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [loading, setLoading] = useState(false); // for recipe gen/load
  const [error, setError] = useState(null);

  const generatingRef = useRef(false);            // guard against loops
  const attemptedHashesRef = useRef(new Set());   // don’t retry failed hash immediately
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  // 1) Live-listen to Inventory
  useEffect(() => {
    if (!userId) { setInventory([]); setInvLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "users", userId, "Inventory"),
      (snap) => {
        const items = [];
        snap.forEach((d) => items.push(d.data()));
        setInventory(items);
        setInvLoading(false);
      },
      (err) => {
        console.warn("Inventory onSnapshot error:", err?.message || err);
        setInventory([]);
        setInvLoading(false);
      }
    );
    return () => unsub();
  }, [db, userId]);

  // Stable hash of inventory
  const invForHash = useMemo(() => buildInventoryForHash(inventory), [inventory]);
  const invHash = useMemo(() => (invForHash.length ? hashString(JSON.stringify(invForHash)) : "no-items"), [invForHash]);

  const invPromptJson = useMemo(() => JSON.stringify(buildInventoryForPrompt(inventory)), [inventory]);

  // Read recipe cache for user/hash
  const readCache = useCallback(async () => {
    if (!userId) return [];
    const col = collection(db, "users", userId, "recipeCaches", invHash, "recipes");
    const snap = await getDocs(col);
    const out = [];
    snap.forEach((d) => out.push(d.data()));
    return normalizeRecipes(out);
  }, [db, userId, invHash]);

  // Write cache
  const writeCache = useCallback(async (normalized) => {
    if (!userId) return;
    const batch = writeBatch(db);
    const meta = doc(db, "users", userId, "recipeCaches", invHash);
    batch.set(meta, {
      userId, hash: invHash, totalCount: normalized.length,
      updatedAt: serverTimestamp(), inventorySnapshot: invForHash,
    });
    const col = collection(db, "users", userId, "recipeCaches", invHash, "recipes");
    normalized.forEach((r) => batch.set(doc(col, r.id), r));
    await batch.commit();
  }, [db, userId, invHash, invForHash]);

  const setRecipesPaged = useCallback((list) => {
    if (!aliveRef.current) return;
    setRecipes(list);
    setVisibleCount((c) => clamp(Math.min(pageSize, list.length), 0, list.length));
  }, [pageSize]);

  // Generate (guarded)
  const generate = useCallback(async () => {
    if (!userId) return;
    if (!inventory || inventory.length === 0) return; // don’t generate for empty inventory
    if (generatingRef.current) return;
    if (attemptedHashesRef.current.has(invHash)) return; // avoid quick retry loops

    generatingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const system =
        `Create up to ${totalCount} distinct recipes using ONLY the inventory below ` +
        `(salt, pepper, water, oil allowed). Prefer soon-to-expire items. ` +
        `Return STRICT JSON only in the schema:\n` +
        `{"recipes":[{"id":"string","title":"string","description":"string","image":"string|null","servings":1,"cookTime":"20 min","difficulty":{"level":"Easy|Medium|Hard","color":"#hex"},"expirationDate":"YYYY-MM-DD|null"}]}\n` +
        `Use these difficulty colors exactly: Easy=${COLORS.Easy}, Medium=${COLORS.Medium}, Hard=${COLORS.Hard}.`;

      const headers = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
      const resp = await axios.post(
        `${API_BASE}/v1/chat/completions`,
        {
          model: MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: `INVENTORY:\n${invPromptJson}` },
          ],
        },
        { timeout: 20000, headers }
      );

      const content = resp?.data?.choices?.[0]?.message?.content || "{}";
      let parsed;
      try { parsed = JSON.parse(content); } catch { parsed = { recipes: [] }; }
      const normalized = normalizeRecipes(parsed.recipes || []);

      await writeCache(normalized);
      setRecipesPaged(normalized);
    } catch (e) {
      console.warn("Generate error:", e?.response?.data || e?.message || e);
      setError("OpenAI network error. Pull to refresh to retry.");
      attemptedHashesRef.current.add(invHash);
    } finally {
      generatingRef.current = false;
      setLoading(false);
    }
  }, [userId, inventory, invHash, invPromptJson, totalCount, writeCache, setRecipesPaged]);

  // Auto-load whenever inventory (hash) changes:
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const cached = await readCache();
        if (cancelled) return;

        if (cached.length > 0) {
          setRecipesPaged(cached);
        } else {
          await generate(); // only runs if inventory has items
        }
      } catch (e) {
        console.warn("Cache load error:", e?.message || e);
        setError("Failed to load recipes.");
        setRecipesPaged([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, invHash, readCache, generate, setRecipesPaged]);

  // UI actions
  const loadMore = useCallback(() => {
    setVisibleCount((c) => clamp(c + pageSize, 0, recipes.length));
  }, [recipes.length, pageSize]);

  const onRefresh = useCallback(async () => {
    // manual regenerate (clears attempted-flag so we can retry)
    attemptedHashesRef.current.delete(invHash);
    await generate();
  }, [invHash, generate]);

  const noItems = !invLoading && inventory.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipes</Text>
      
      </View>

      {invLoading && recipes.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: "#666" }}>Loading inventory…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: "crimson", textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.refreshBtn, { marginTop: 12 }]}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : noItems ? (
        <View style={styles.center}>
          <Text style={{ color: "#555", textAlign: "center", paddingHorizontal: 24 }}>
            No items in your fridge yet. Add items to users/{userId}/Inventory to get recipes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes.slice(0, visibleCount)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (visibleCount < recipes.length) loadMore();
          }}
          ListFooterComponent={
            visibleCount < recipes.length ? null : (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <Text style={{ color: "#777" }}>{recipes.length ? "No more recipes" : "No recipes yet"}</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl refreshing={loading && recipes.length > 0} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingTop: 14, paddingBottom: 10, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  refreshBtn: { backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  card: {
    flexDirection: "row", gap: 12, padding: 12, marginBottom: 12,
    backgroundColor: "#fff", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#eee", elevation: 1,
  },
  image: { width: 88, height: 88, borderRadius: 10, backgroundColor: "#f5f5f5" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 13, color: "#555", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  badge: { fontSize: 12, color: "#333", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#F3F4F6", borderRadius: 8 },
  diff: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
