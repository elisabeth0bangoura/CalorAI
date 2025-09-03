// DailyLeftContext.js — plain JS, RN Firebase v22 modular
import { getAuth } from '@react-native-firebase/auth';
import {
    collection,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
} from '@react-native-firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  const [entries, setEntries] = useState([]);            // raw docs from .../List
  const [today, setToday] = useState({                   // <-- your requested names
    caloriesToday: 0,
    carbsToday: 0,
    proteinToday: 0,
    fatToday: 0,
    sugarToday: 0,
    fiberToday: 0,
    sodiumToday: 0,
  });
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
        const q = query(listRef, orderBy('created_at', 'desc')); // remove if some docs lack created_at

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

            setToday(totals);
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
      // recompute the same way as above (DRY left out for brevity)
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

      setToday(totals);
      setError(null);
    } catch (e) {
      setError(String(e?.message || e));
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
      }}
    >
      {children}
    </DailyLeftContext.Provider>
  );
}
