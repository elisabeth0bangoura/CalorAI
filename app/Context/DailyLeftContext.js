// DailyLeftContext.js — RN Firebase v22 modular + optimistic deltas
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
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
  });

  // live, optimistic deltas keyed by an id (e.g. delete-<meal>-<idx>-<ts>)
  const deltasRef = useRef(new Map());

  // exposed combined "today" = baseToday + sum(deltas)
  const today = useMemo(() => {
    const sum = { ...baseToday };
    for (const delta of deltasRef.current.values()) {
      sum.caloriesToday += n(delta.caloriesToday);
      sum.carbsToday    += n(delta.carbsToday);
      sum.proteinToday  += n(delta.proteinToday);
      sum.fatToday      += n(delta.fatToday);
      sum.sugarToday    += n(delta.sugarToday);
      sum.fiberToday    += n(delta.fiberToday);
      sum.sodiumToday   += n(delta.sodiumToday);
    }
    // ensure no NaNs
    Object.keys(sum).forEach((k) => (sum[k] = n(sum[k])));
    return sum;
  }, [baseToday]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const auth = getAuth();
  const db = getFirestore();
  const dateKey = useMemo(() => todayKey(), []);

  useEffect(() => {
    let unsub;
    let cancelled = false;

    (async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not signed in');

        // users/{uid}/Today/{dateKey}/List
        const listRef = collection(db, 'users', uid, 'Today', dateKey, 'List');
        const q = query(listRef, orderBy('created_at', 'desc')); // remove orderBy if some docs lack created_at

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
                row.sodium_mg != null;

              if (hasTop) {
                acc.caloriesToday += n(row.calories_kcal_total ?? row.calories_kcal);
                acc.carbsToday    += n(row.carbs_g);
                acc.proteinToday  += n(row.protein_g);
                acc.fatToday      += n(row.fat_g ?? row.fats_g);
                acc.sugarToday    += n(row.sugar_g);
                acc.fiberToday    += n(row.fiber_g);
                acc.sodiumToday   += n(row.sodium_mg);
              } else if (Array.isArray(row.items)) {
                // fallback: sum per-item values
                row.items.forEach((it) => {
                  acc.caloriesToday += n(it.calories_kcal);
                  acc.carbsToday    += n(it.carbs_g);
                  acc.proteinToday  += n(it.protein_g);
                  acc.fatToday      += n(it.fat_g ?? it.fats_g);
                  acc.sugarToday    += n(it.sugar_g);
                  acc.fiberToday    += n(it.fiber_g);
                  acc.sodiumToday   += n(it.sodium_mg);
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
          row.sodium_mg != null;

        if (hasTop) {
          acc.caloriesToday += n(row.calories_kcal_total ?? row.calories_kcal);
          acc.carbsToday    += n(row.carbs_g);
          acc.proteinToday  += n(row.protein_g);
          acc.fatToday      += n(row.fat_g ?? row.fats_g);
          acc.sugarToday    += n(row.sugar_g);
          acc.fiberToday    += n(row.fiber_g);
          acc.sodiumToday   += n(row.sodium_mg);
        } else if (Array.isArray(row.items)) {
          row.items.forEach((it) => {
            acc.caloriesToday += n(it.calories_kcal);
            acc.carbsToday    += n(it.carbs_g);
            acc.proteinToday  += n(it.protein_g);
            acc.fatToday      += n(it.fat_g ?? it.fats_g);
            acc.sugarToday    += n(it.sugar_g);
            acc.fiberToday    += n(it.fiber_g);
            acc.sodiumToday   += n(it.sodium_mg);
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
      });

      setBaseToday(totals);
      setError(null);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  /* -------- NEW: optimistic delta API used by Scan page -------- */
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
    });
    // force a re-render by touching state (use baseToday no-op set)
    setBaseToday((t) => ({ ...t }));
  };

  const clearDelta = (key) => {
    if (!key) return;
    if (deltasRef.current.has(key)) {
      deltasRef.current.delete(key);
      setBaseToday((t) => ({ ...t }));
    }
  };

  return (
    <DailyLeftContext.Provider
      value={{
        entries,
        today,                         // object with caloriesToday, carbsToday, ...
        // convenience fields if you want direct access:
        caloriesToday: today.caloriesToday,
        carbsToday: today.carbsToday,
        proteinToday: today.proteinToday,
        fatToday: today.fatToday,
        sugarToday: today.sugarToday,
        fiberToday: today.fiberToday,
        sodiumToday: today.sodiumToday,
        loading,
        error,
        dateKey,
        refresh,
        // NEW:
        applyDelta,
        clearDelta,
      }}
    >
      {children}
    </DailyLeftContext.Provider>
  );
}
