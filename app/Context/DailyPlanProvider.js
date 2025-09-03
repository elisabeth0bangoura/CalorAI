// DailyTargetsContext.js — plain JS, RN Firebase v22 modular
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';

/* -------- constants & helpers -------- */
const KCAL_PER_KG = 7700;   // 1 kg fat ≈ 7700 kcal
const CUP_ML = 250;

const toNum = (v, fb = NaN) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? Number(n) : fb;
};

const calcAge = (year, month, day) => {
  const now = new Date();
  let age = now.getFullYear() - (Number(year) || now.getFullYear());
  const m = Number(month) || 1, d = Number(day) || 1;
  if (now.getMonth() + 1 < m || ((now.getMonth() + 1) === m && now.getDate() < d)) age--;
  return Math.max(0, age);
};

const mifflinStJeor = (kg, cm, age, gender) => {
  const s = String(gender || '').toLowerCase().startsWith('m') ? 5 : -161; // male:+5, female:-161
  return 10 * kg + 6.25 * cm - 5 * age + s;
};

const activityFromWorkouts = (workouts) => {
  const w = parseInt(workouts, 10);
  if (!Number.isFinite(w) || w <= 0) return 1.35;
  if (w <= 2) return 1.45;
  if (w <= 4) return 1.55;
  if (w <= 6) return 1.725;
  return 1.9;
};

const DailyTargetsContext = createContext(null);
export const useDailyTargets = () => useContext(DailyTargetsContext);

export default function DailyTargetsProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [targets, setTargets] = useState(null);
  const [debug, setDebug] = useState(null);

  // 1) Wait for auth to be ready
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return unsub;
  }, []);

  // 2) Compute targets when we have a uid
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setTargets(null);

        if (!uid) { setLoading(false); return; }

        const snap = await getDoc(doc(getFirestore(), 'users', uid));
        if (!snap.exists()) throw new Error('User doc does not exist');
        const d = snap.data() || {};

        // ------- anthropometrics -------
        let kg = toNum(d.kg);
        if (!Number.isFinite(kg)) {
          const lb = toNum(d.lb);
          if (Number.isFinite(lb)) kg = lb * 0.45359237;
        }
        const cm = Number.isFinite(toNum(d.cm))
          ? toNum(d.cm)
          : Math.round(((toNum(d.ft) || 0) * 12 + (toNum(d.inch) || 0)) * 2.54);
        const gender = d.gender;
        const age    = calcAge(d.year, d.month, d.day);
        const workouts = d.workouts;

        if (!Number.isFinite(kg) || !Number.isFinite(cm)) throw new Error('Missing kg/cm');

        // ------- calories (HowFast is KG / DAY) -------
        const bmr  = mifflinStJeor(kg, cm, age, gender);
        const tdee = bmr * activityFromWorkouts(workouts);

        const goal = String(d.goal || 'maintain').toLowerCase(); // "lose" | "gain" | "maintain"
        const howFastKgPerDay = Math.max(0, toNum(d.HowFast));    // kg/day

        const safeMinCalories = Math.max(1200, bmr * 0.8);
        const deficitCapKcal  = Math.max(0, Math.min(1000, 0.30 * tdee, tdee - safeMinCalories));
        const surplusCapKcal  = Math.min(600, 0.15 * tdee);

        const requestedDeficit = goal === 'lose' ? howFastKgPerDay * KCAL_PER_KG : 0;
        const requestedSurplus = goal === 'gain' ? howFastKgPerDay * KCAL_PER_KG : 0;

        const effectiveDeficit = Math.min(requestedDeficit, deficitCapKcal);
        const effectiveSurplus = Math.min(requestedSurplus, surplusCapKcal);

        let targetCalories = tdee - effectiveDeficit + effectiveSurplus;
        targetCalories = Math.max(targetCalories, safeMinCalories);

        const achievableHowFastKgPerDay =
          (goal === 'lose' ? effectiveDeficit : effectiveSurplus) / KCAL_PER_KG;

        // ------- clinical settings -------
        const kidney   = d.kidneySettings || {};
        const heart    = d.heartSettings || {};
        const diabetes = d.diabetesSettings || {};
        const mealsPerDay = Number.isFinite(toNum(d.mealsPerDay)) ? toNum(d.mealsPerDay) : 3;

        // Water: kidney override → else 30 ml/kg (min 1.5L)
        const hydrationCups = toNum(kidney.hydrationGoalCups);
        const waterMl = Number.isFinite(hydrationCups)
          ? hydrationCups * CUP_ML
          : Math.round(Math.max(1500, 30 * kg));

        // Sodium: strictest of kidney/heart, else 2300 mg
        const kidneyNa = toNum(kidney.sodiumLimitMg);
        const heartNa  = toNum(heart.sodiumLimitMg);
        const sodiumLimitMg = [kidneyNa, heartNa].filter(Number.isFinite).length
          ? Math.min(...[kidneyNa, heartNa].filter(Number.isFinite))
          : 2300;

        // Coffee
        const coffeeTargetCups = Number.isFinite(toNum(d?.habitSettings?.coffeePerDayTarget))
          ? toNum(d.habitSettings.coffeePerDayTarget)
          : 1;

        // Sat fat (heart)
        const satPctMap = { low: 0.07, moderate: 0.10, high: 0.13 };
        const satPct = satPctMap[String(heart.satFatLimit || '').toLowerCase()];
        const satFatG = satPct ? Math.round((targetCalories * satPct) / 9) : undefined;

        // ------- macros -------
        const pref = String(d.dietPreferenceId || 'balanced').toLowerCase();
        let baseP = 0.20, baseF = 0.30;
        if (pref.includes('low_carb')) { baseP = 0.25; baseF = 0.40; }
        else if (pref.includes('low-fat') || pref.includes('low_fat')) { baseP = 0.25; baseF = 0.20; }
        else if (pref.includes('high_protein') || pref.includes('high-protein')) { baseP = 0.30; baseF = 0.30; }

        const kidneyPMap = { low: 0.6, moderate: 0.8, high: 1.2 };
        const kidneyLevel = String(kidney.proteinLevel || '').toLowerCase();
        let proteinPerKg = kidneyPMap[kidneyLevel] || (goal === 'lose' ? 1.2 : goal === 'gain' ? 1.6 : 1.0);
        let proteinG    = Math.round(kg * proteinPerKg);
        let proteinKcal = proteinG * 4;

        let fatKcal = targetCalories * baseF;
        let fatG    = Math.max(0, Math.round(fatKcal / 9));

        let carbsKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
        let carbsG    = Math.round(carbsKcal / 4);

        const carbPerMeal = Number.isFinite(toNum(diabetes.carbTargetPerMeal))
          ? toNum(diabetes.carbTargetPerMeal)
          : undefined;
        const trackCarbs  = !!diabetes.trackCarbs;
        const diabetesDailyCarbG = trackCarbs && carbPerMeal ? carbPerMeal * mealsPerDay : undefined;

        if (Number.isFinite(diabetesDailyCarbG)) {
          carbsG = Math.min(carbsG, diabetesDailyCarbG);
          carbsKcal = carbsG * 4;
          fatKcal = Math.max(0, targetCalories - proteinKcal - carbsKcal);
          fatG = Math.max(0, Math.round(fatKcal / 9));
        }

        const sugarG = Math.min(Math.round((targetCalories * 0.10) / 4), carbsG);
        const fiberG = Math.max(25, Math.round((14 * targetCalories) / 1000));

        if (cancelled) return;
        setTargets({
          calories: Math.round(targetCalories),
          waterMl: Math.round(waterMl),
          coffeeCups: Math.round(coffeeTargetCups),
          proteinG, carbsG, fatG, sugarG, fiberG,
          sodiumMg: Math.round(sodiumLimitMg),
          satFatG,
          mealsPerDay,
          diabetesDailyCarbG: Number.isFinite(diabetesDailyCarbG) ? diabetesDailyCarbG : undefined,
          carbPerMealG: Number.isFinite(carbPerMeal) ? carbPerMeal : undefined,
        });

        setDebug({
          kg, cm, age, gender,
          bmr: Math.round(bmr),
          tdee: Math.round(tdee),
          goal,
          requestedHowFastKgPerDay: howFastKgPerDay,
          achievableHowFastKgPerDay: +achievableHowFastKgPerDay.toFixed(3),
        });
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(String(e?.message || e));
          setTargets(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <DailyTargetsContext.Provider value={{ loading, error, targets, debug }}>
      {children}
    </DailyTargetsContext.Provider>
  );
}
