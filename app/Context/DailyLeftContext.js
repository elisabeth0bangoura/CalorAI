// DailyLeftContext.js — RN Firebase v22 modular + optimistic deltas
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  // NEW
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* ---- local date key: YYYY-MM-DD ---- */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// nice human labels without “stuck at 2 L”
const fmtMlOrL = (ml) => {
  const v = n(ml);
  if (v >= 1000) {
    const L = v / 1000;
    const s = L.toFixed(1);
    return s.endsWith('.0') ? `${Math.round(L)} L` : `${s} L`;
  }
  return `${Math.round(v)} ml`;
};

const DailyLeftContext = createContext(null);
export const useDailyLeft = () => useContext(DailyLeftContext);

export default function DailyLeftProvider({ children }) {
  const [entries, setEntries] = useState([]); // raw docs from .../List

  // base aggregated totals from Firestore (no optimistic changes)
  const [baseToday, setBaseToday] = useState({
    caloriesToday: 0,
    carbsToday: 0,
    proteinToday: 0,
    fatToday: 0,
    sugarToday: 0,
    fiberToday: 0,
    sodiumToday: 0,
    waterToday: 0,
    coffeeToday: 0, // cups
    // NEW: cigarettes
    cigarettesToday: 0, // count
  });

  // live, optimistic deltas keyed by an id (e.g. delete-<meal>-<idx>-<ts>)
  const deltasRef = useRef(new Map());

  // exposed combined "today" = baseToday + sum(deltas)
  const today = useMemo(() => {
    const sum = { ...baseToday };
    for (const delta of deltasRef.current.values()) {
      sum.caloriesToday   += n(delta.caloriesToday);
      sum.carbsToday      += n(delta.carbsToday);
      sum.proteinToday    += n(delta.proteinToday);
      sum.fatToday        += n(delta.fatToday);
      sum.sugarToday      += n(delta.sugarToday);
      sum.fiberToday      += n(delta.fiberToday);
      sum.sodiumToday     += n(delta.sodiumToday);
      sum.waterToday      += n(delta.waterToday);
      sum.coffeeToday     += n(delta.coffeeToday);     // cups
      // NEW
      sum.cigarettesToday += n(delta.cigarettesToday); // count
    }
    Object.keys(sum).forEach((k) => (sum[k] = n(sum[k])));
    return sum;
  }, [baseToday]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const auth = getAuth();
  const db = getFirestore();
  const dateKey = useMemo(() => todayKey(), []);

  // derive water goal (cups -> ml) from any entry’s profile_used or default 8 cups
  const waterGoalMl = useMemo(() => {
    const CUP_ML = 240;
    for (const row of entries) {
      const cups =
        row?.profile_used?.kidneySettings?.hydrationGoalCups ??
        row?.profileUsed?.kidneySettings?.hydrationGoalCups;
      if (Number.isFinite(Number(cups)) && Number(cups) > 0) {
        return Number(cups) * CUP_ML;
      }
    }
    return 8 * CUP_ML;
  }, [entries]);

  // derived hydration
  const waterLeftMl     = Math.max(0, waterGoalMl - today.waterToday);
  const waterPercent    = waterGoalMl > 0 ? Math.min(1, today.waterToday / waterGoalMl) : 0;
  const waterLeftLabel  = fmtMlOrL(waterLeftMl);
  const waterTodayLabel = fmtMlOrL(today.waterToday);

  // NEW: derive cigarette goal from any List doc; null if not set
  const cigaretteGoal = useMemo(() => {
    for (const row of entries) {
      const g =
        row?.cigarette_goal ??
        row?.cigarettes_goal ??
        row?.cigGoal ??
        row?.smoking_goal;
      if (Number.isFinite(Number(g)) && Number(g) >= 0) return Number(g);
    }
    return null;
  }, [entries]);

  const cigaretteLeft = cigaretteGoal != null
    ? Math.max(0, cigaretteGoal - (today.cigarettesToday || 0))
    : null;

  const cigarettePercent = cigaretteGoal > 0
    ? Math.min(1, (today.cigarettesToday || 0) / cigaretteGoal)
    : 0;

  useEffect(() => {
    let unsub;
    let cancelled = false;

    (async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not signed in');

        // users/{uid}/Today/{dateKey}/List
        const listRef = collection(db, 'users', uid, 'Today', dateKey, 'List');
        const q = query(listRef, orderBy('created_at', 'desc'));

        unsub = onSnapshot(
          q,
          (snap) => {
            if (cancelled) return;

            const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setEntries(arr);

            // ---- aggregate across all docs in List ----
            const totals = arr.reduce((acc, row) => {
              const hasTop =
                row.calories_kcal_total != null ||
                row.carbs_g != null ||
                row.protein_g != null ||
                row.fat_g != null ||
                row.sugar_g != null ||
                row.fiber_g != null ||
                row.sodium_mg != null ||
                row.water_ml != null ||
                row.coffee_cups != null ||
                // NEW: allow top-level cigarettes fields to short-circuit
                row.cigarettes_today != null ||
                row.cigs_today != null ||
                row.cigarettesToday != null ||
                row.smoked_today != null;

              if (hasTop) {
                acc.caloriesToday   += n(row.calories_kcal_total ?? row.calories_kcal);
                acc.carbsToday      += n(row.carbs_g);
                acc.proteinToday    += n(row.protein_g);
                acc.fatToday        += n(row.fat_g ?? row.fats_g);
                acc.sugarToday      += n(row.sugar_g);
                acc.fiberToday      += n(row.fiber_g);
                acc.sodiumToday     += n(row.sodium_mg);
                acc.waterToday      += n(row.water_ml);
                acc.coffeeToday     += n(row.coffee_cups); // cups
                // NEW
                acc.cigarettesToday += n(
                  row.cigarettes_today ??
                  row.cigs_today ??
                  row.cigarettesToday ??
                  row.smoked_today
                );
              } else if (Array.isArray(row.items)) {
                row.items.forEach((it) => {
                  acc.caloriesToday   += n(it.calories_kcal);
                  acc.carbsToday      += n(it.carbs_g);
                  acc.proteinToday    += n(it.protein_g);
                  acc.fatToday        += n(it.fat_g ?? it.fats_g);
                  acc.sugarToday      += n(it.sugar_g);
                  acc.fiberToday      += n(it.fiber_g);
                  acc.sodiumToday     += n(it.sodium_mg);
                  acc.waterToday      += n(it.water_ml);
                  // coffee_cups is only saved top-level in our scans
                  // NEW per-item cigarettes support (optional)
                  acc.cigarettesToday += n(
                    it.cigarettes_today ??
                    it.cigs_today ??
                    it.cigarettesToday
                  );
                });
              }
              return acc;
            }, {
              caloriesToday: 0,
              carbsToday: 0,
              proteinToday: 0,
              fatToday: 0,
              sugarToday: 0,
              fiberToday: 0,
              sodiumToday: 0,
              waterToday: 0,
              coffeeToday: 0,     // cups
              cigarettesToday: 0, // NEW
            });

            setBaseToday(totals);
            setError(null);
            setLoading(false);
          },
          (e) => {
            if (cancelled) return;
            setError(String(e?.message || e));
            setLoading(false);
          }
        );
      } catch (e) {
        if (!cancelled) {
          setError(String(e?.message || e));
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; if (typeof unsub === 'function') unsub(); };
  }, [auth, db, dateKey]);

  // optional: manual refresh (one-shot)
  const refresh = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');
      const listRef = collection(db, 'users', uid, 'Today', dateKey, 'List');
      const snap = await getDocs(listRef);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEntries(arr);
      const totals = arr.reduce((acc, row) => {
        const hasTop =
          row.calories_kcal_total != null ||
          row.carbs_g != null ||
          row.protein_g != null ||
          row.fat_g != null ||
          row.sugar_g != null ||
          row.fiber_g != null ||
          row.sodium_mg != null ||
          row.water_ml != null ||
          row.coffee_cups != null ||
          // NEW
          row.cigarettes_today != null ||
          row.cigs_today != null ||
          row.cigarettesToday != null ||
          row.smoked_today != null;

        if (hasTop) {
          acc.caloriesToday   += n(row.calories_kcal_total ?? row.calories_kcal);
          acc.carbsToday      += n(row.carbs_g);
          acc.proteinToday    += n(row.protein_g);
          acc.fatToday        += n(row.fat_g ?? row.fats_g);
          acc.sugarToday      += n(row.sugar_g);
          acc.fiberToday      += n(row.fiber_g);
          acc.sodiumToday     += n(row.sodium_mg);
          acc.waterToday      += n(row.water_ml);
          acc.coffeeToday     += n(row.coffee_cups); // cups
          // NEW
          acc.cigarettesToday += n(
            row.cigarettes_today ??
            row.cigs_today ??
            row.cigarettesToday ??
            row.smoked_today
          );
        } else if (Array.isArray(row.items)) {
          row.items.forEach((it) => {
            acc.caloriesToday   += n(it.calories_kcal);
            acc.carbsToday      += n(it.carbs_g);
            acc.proteinToday    += n(it.protein_g);
            acc.fatToday        += n(it.fat_g ?? it.fats_g);
            acc.sugarToday      += n(it.sugar_g);
            acc.fiberToday      += n(it.fiber_g);
            acc.sodiumToday     += n(it.sodium_mg);
            acc.waterToday      += n(it.water_ml);
            // NEW per-item cigarettes
            acc.cigarettesToday += n(
              it.cigarettes_today ??
              it.cigs_today ??
              it.cigarettesToday
            );
          });
        }
        return acc;
      }, {
        caloriesToday: 0,
        carbsToday: 0,
        proteinToday: 0,
        fatToday: 0,
        sugarToday: 0,
        fiberToday: 0,
        sodiumToday: 0,
        waterToday: 0,
        coffeeToday: 0,     // cups
        cigarettesToday: 0, // NEW
      });

      setBaseToday(totals);
      setError(null);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  /* -------- optimistic delta API -------- */
  const applyDelta = (key, delta) => {
    if (!key) return;
    deltasRef.current.set(key, {
      caloriesToday: n(delta?.caloriesToday),
      carbsToday:    n(delta?.carbsToday),
      proteinToday:  n(delta?.proteinToday),
      fatToday:      n(delta?.fatToday),
      sugarToday:    n(delta?.sugarToday),
      fiberToday:    n(delta?.fiberToday),
      sodiumToday:   n(delta?.sodiumToday),
      waterToday:    n(delta?.waterToday),
      coffeeToday:   n(delta?.coffeeToday),      // cups
      // NEW
      cigarettesToday: n(delta?.cigarettesToday) // count
    });
    setBaseToday((t) => ({ ...t })); // force re-render
  };

  const clearDelta = (key) => {
    if (!key) return;
    if (deltasRef.current.has(key)) {
      deltasRef.current.delete(key);
      setBaseToday((t) => ({ ...t }));
    }
  };

  /* -------- cigarettes writers (single doc per day) -------- */
  const smokingDocRef = (uid) =>
    doc(db, 'users', uid, 'Today', dateKey, 'List', 'Smoking');

  /** Set absolute cigarettes for today (optimistic). */
  const setCigarettesToday = async (count) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const next = Math.max(0, n(count));
    const diff = next - n(today.cigarettesToday);

    const key = `cigs:set:${Date.now()}`;
    applyDelta(key, { cigarettesToday: diff });

    try {
      await setDoc(
        smokingDocRef(uid),
        { cigarettes_today: next, updated_at: serverTimestamp() },
        { merge: true }
      );
      clearDelta(key);
    } catch (e) {
      clearDelta(key);
      throw e;
    }
  };

  /** Increment (or decrement with negative n) today’s cigarettes (optimistic). */
  const incCigarettesToday = async (nDelta = 1) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');

    const next = Math.max(0, n(today.cigarettesToday) + n(nDelta));
    const diff = next - n(today.cigarettesToday);

    const key = `cigs:inc:${Date.now()}`;
    applyDelta(key, { cigarettesToday: diff });

    try {
      await setDoc(
        smokingDocRef(uid),
        { cigarettes_today: next, updated_at: serverTimestamp() },
        { merge: true }
      );
      clearDelta(key);
    } catch (e) {
      clearDelta(key);
      throw e;
    }
  };

  /** Set (or change) the daily goal. */
  const setCigaretteGoal = async (goal) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const g = Math.max(0, n(goal));
    await setDoc(
      smokingDocRef(uid),
      { cigarette_goal: g, updated_at: serverTimestamp() },
      { merge: true }
    );
  };

  return (
    <DailyLeftContext.Provider
      value={{
        entries,
        today, // includes waterToday, coffeeToday, cigarettesToday

        // convenience fields
        caloriesToday: today.caloriesToday,
        carbsToday: today.carbsToday,
        proteinToday: today.proteinToday,
        fatToday: today.fatToday,
        sugarToday: today.sugarToday,
        fiberToday: today.fiberToday,
        sodiumToday: today.sodiumToday,
        waterToday: today.waterToday,        // ml
        coffeeToday: today.coffeeToday,      // cups
        cigarettesToday: today.cigarettesToday, // count

        // hydration goal & derived values for UI
        waterGoalMl,
        waterLeftMl,
        waterPercent,
        waterLeftLabel,   // e.g., "1.8 L" or "825 ml"
        waterTodayLabel,  // e.g., "0.2 L"

        // smoking goal & derived values for UI
        cigaretteGoal,    // null if not set
        cigaretteLeft,    // null if no goal
        cigarettePercent, // 0..1 if goal > 0

        loading,
        error,
        dateKey,
        refresh,
        applyDelta,
        clearDelta,

        // writers for cigarettes
        setCigarettesToday,
        incCigarettesToday,
        setCigaretteGoal,
      }}
    >
      {children}
    </DailyLeftContext.Provider>
  );
}
