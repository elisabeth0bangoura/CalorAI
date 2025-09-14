// EditNutritionGoalsScreen.js
import { Cigarette, Coffee, Egg, Flame, WandSparkles, Wheat } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';
import { ScrollView } from 'react-native-gesture-handler';
import { height, size, width } from 'react-native-responsive-sizes';
import AppBlurBottom from './AppBlurBottom';

import { useSheets } from '@/app/Context/SheetsContext';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';

const DEFAULT_COLORS = {
  bg: '#ffffff',
  card: '#F4F5F7',
  text: '#0F0F12',
  sub: '#7B7F87',
  divider: '#ECEEF1',
  cal: '#111111',        // calories ring color (keep existing key)
  protein: '#632EFF',
  carbs: '#F7931A',
  fat: '#FCDB2A',
  fiber: '#A87DD8',
  sugar: '#FF89A0',
  sodium: '#D7A44A',
  coffee: '#C15217',
  cigarette: '#F7931A',
};

// If AllNeeds is empty → show these four by default (top),
// hide everything else under “Show micronutrients”.
const DEFAULT_ENABLED_FALLBACK = {
  calories:  true,   // Kalorienziel
  protein:   true,   // Proteinziel
  carbs:     true,   // Kohlenhydratziel
  fat:       true,   // Fettziel
  fiber:     false,
  sugar:     false,
  sodium:    false,
  coffee:    false,
  cigarette: false,
};

const ringProps = {
  radius: 28,
  activeStrokeWidth: 6,
  inActiveStrokeWidth: 6,
  inActiveStrokeOpacity: 0.15,
  strokeLinecap: 'round',
  rotation: -90,
};

// ---- tiny perf helpers ----
const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
};

export default function EditHabit_And_Nutrition_Goals() {
  const [openCategory, setOpenCategory] = useState(false);

  const {
    present,
  } = useSheets();

  // Enabled map from Firestore or fallback
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED_FALLBACK);
  const [focus, setFocus] = useState(null);
  const [COLORS, setCOLORS] = useState(DEFAULT_COLORS);

  // Real-time Firestore subscription with fallback + guards
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const db = getFirestore();
    const ref = doc(db, 'users', uid, 'AllNeeds', 'current');

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // No doc → fallback
          setEnabled((prev) =>
            shallowEqual(prev, DEFAULT_ENABLED_FALLBACK) ? prev : DEFAULT_ENABLED_FALLBACK
          );
          return;
        }

        const data = snap.data() || {};
        const cloudEnabled = (data && typeof data.enabled === 'object') ? data.enabled : null;

        // Merge into fallback to guarantee unknown keys are false
        const nextEnabled = cloudEnabled
          ? { ...DEFAULT_ENABLED_FALLBACK, ...cloudEnabled }
          : DEFAULT_ENABLED_FALLBACK;

        setEnabled((prev) => (shallowEqual(prev, nextEnabled) ? prev : nextEnabled));

        if (data.colors && typeof data.colors === 'object') {
          setCOLORS((prev) => {
            const merged = { ...prev, ...data.colors };
            return shallowEqual(prev, merged) ? prev : merged;
          });
        }
        if (data.focus && data.focus !== focus) setFocus(data.focus);
      },
      (err) => {
        console.warn('AllNeeds/current snapshot error:', err?.message);
        // On error, keep current state; UI still works
      }
    );

    return () => unsub();
  }, [focus]);

  // Static demo numbers (kept)
  const metrics = {
    calories:  { current: 1074, goal: 2200, unit: 'kcal' },
    protein:   { current: 104,  goal: 150,  unit: 'g' },
    carbs:     { current: 97,   goal: 250,  unit: 'g' },
    fat:       { current: 29,   goal: 70,   unit: 'g' },
    fiber:     { current: 25,   goal: 30,   unit: 'g' },
    sugar:     { current: 40,   goal: 50,   unit: 'g' },
    sodium:    { current: 2300, goal: 2300, unit: 'mg' },
    coffee:    { current: 3, goal: 1, unit: 'cups' },
    cigarette: { current: 10, goal: 2, unit: 'amount' },
  };

  const clampPct = (c, g) => {
    if (!g || g <= 0) return 0;
    const p = (c / g) * 100;
    return Math.max(0, Math.min(100, p));
  };

  // Build micronutrients+habits list
  const microAll = useMemo(() => {
    const list = [
      { key: 'fiber',     label: 'Fiber Goal',     color: COLORS.fiber,     icon: Flame,     value: metrics.fiber.current,     goal: metrics.fiber.goal },
      { key: 'sugar',     label: 'Sugar Goal',     color: COLORS.sugar,     icon: Flame,     value: metrics.sugar.current,     goal: metrics.sugar.goal },
      { key: 'sodium',    label: 'Sodium Goal',    color: COLORS.sodium,    icon: Flame,     value: metrics.sodium.current,    goal: metrics.sodium.goal },
      { key: 'coffee',    label: 'Reduce Coffine', color: COLORS.coffee,    icon: Coffee,    value: 5,                           goal: metrics.coffee.goal },
      { key: 'cigarette', label: 'Reduce Smoking', color: COLORS.cigarette, icon: Cigarette, value: 20,                          goal: metrics.cigarette.goal },
    ];
    return list.map(it => ({
      ...it,
      pct: clampPct(it.value, it.goal),
      isEnabled: enabled[it.key] === true,
    }));
  }, [enabled, COLORS, metrics]);

  // Enabled micros (always visible, top)
  const microEnabled = useMemo(
    () => microAll.filter(it => it.isEnabled),
    [microAll]
  );

  // Disabled micros (only visible in “Show micronutrients”)
  const microDisabled = useMemo(
    () => microAll.filter(it => !it.isEnabled),
    [microAll]
  );

  // identical item UI (no style changes)
  const renderMicroItem = ({ item, index }) => (
    <View
      style={{
        width: '90%',
        alignSelf: 'center',
        height: size(100),
        flexDirection: 'row',
        marginTop: index === 0 ? height(5) : 0, // match your first micro spacing
      }}
    >
      <CircularProgressBase
        {...ringProps}
        value={item.pct}
        maxValue={100}
        activeStrokeColor={item.color}
        inActiveStrokeColor={item.color}
      >
        <item.icon size={18} color={item.color} />
      </CircularProgressBase>

      <View style={{ marginLeft: width(5) }}>
        <Text>{item.label}</Text>
        <Text style={{ fontWeight: '700', fontSize: size(18) }}>
          {String(item.value)}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <ScrollView
        style={{ height: height(100), width: '100%' }}
        contentContainerStyle={{ paddingBottom: height(25) }}
      >
        <Text
          style={{
            fontSize: size(25),
            marginLeft: width(5),
            marginTop: height(5),
            fontWeight: '800',
            color: COLORS.text,
            lineHeight: 40,
          }}
        >
          Edit Nutrition Goals
        </Text>

        {/* ==== Always-visible TOP: the 4 default cards ==== */}
        {/* Kalorienziel */}
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            marginTop: height(5),
            height: size(100),
            flexDirection: 'row',
          }}
        >
          <CircularProgressBase
            {...ringProps}
            value={clampPct(metrics.calories.current, metrics.calories.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.cal}
            inActiveStrokeColor={COLORS.cal}
          >
            <Flame size={18} color={COLORS.cal} />
          </CircularProgressBase>

          <View style={{ marginLeft: width(5) }}>
            <Text>Calorie Goal</Text>
            <Text style={{ fontWeight: '700', fontSize: size(18) }}>1074</Text>
          </View>
        </View>

        {/* Proteinziel */}
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            height: size(100),
            flexDirection: 'row',
          }}
        >
          <CircularProgressBase
            {...ringProps}
            value={clampPct(metrics.protein.current, metrics.protein.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.protein}
            inActiveStrokeColor={COLORS.protein}
          >
            <Egg size={18} color={COLORS.protein} />
          </CircularProgressBase>

          <View style={{ marginLeft: width(5) }}>
            <Text>Protein Goal</Text>
            <Text style={{ fontWeight: '700', fontSize: size(18) }}>104</Text>
          </View>
        </View>

        {/* Kohlenhydratziel */}
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            height: size(100),
            flexDirection: 'row',
          }}
        >
          <CircularProgressBase
            {...ringProps}
            value={clampPct(metrics.carbs.current, metrics.carbs.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.carbs}
            inActiveStrokeColor={COLORS.carbs}
          >
            <Wheat size={18} color={COLORS.carbs} />
          </CircularProgressBase>

          <View style={{ marginLeft: width(5) }}>
            <Text>Carbs Goal</Text>
            <Text style={{ fontWeight: '700', fontSize: size(18) }}>97</Text>
          </View>
        </View>

        {/* Fettziel */}
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            height: size(50),
            flexDirection: 'row',
          }}
        >
          <CircularProgressBase
            {...ringProps}
            value={clampPct(metrics.fat.current, metrics.fat.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.fat}
            inActiveStrokeColor={COLORS.fat}
          >
            <Flame size={18} color={COLORS.fat} />
          </CircularProgressBase>

          <View style={{ marginLeft: width(5) }}>
            <Text>Fat Goal</Text>
            <Text style={{ fontWeight: '700', fontSize: size(18) }}>29</Text>
          </View>
        </View>

        {/* ===== Enabled MICROS (ALWAYS VISIBLE, TOP AFTER THE 4) ===== */}
        {microEnabled.length > 0 && (
          <FlatList
            data={microEnabled}
            keyExtractor={(it) => `en-${it.key}`}
            renderItem={renderMicroItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingTop: height(1), paddingBottom: height(1) }}
          />
        )}

        {/* Toggle for disabled micros */}
        <TouchableOpacity
          onPress={() => setOpenCategory((prev) => !prev)}
          style={{
            marginLeft: width(5),
            paddingVertical: height(2),
            paddingHorizontal: width(5),
          }}
        >
          <Text style={{ fontWeight: '600', fontSize: size(16) }}>
            {openCategory ? 'Hide micronutrients' : 'Show micronutrients'}
          </Text>
        </TouchableOpacity>

        {/* ===== Disabled MICROS (ONLY INSIDE HIDDEN SECTION) ===== */}
        {openCategory && microDisabled.length > 0 && (
          <View style={{ opacity: 0.35 }}>
            <FlatList
              data={microDisabled}
              keyExtractor={(it) => `dis-${it.key}`}
              renderItem={renderMicroItem}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: height(2) }}
            />
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          present('Generate_Based_On_Habits_And_Health');
        }}
        style={{
          height: size(50),
          borderWidth: 1,
          width: '90%',
          zIndex: 1000,
          position: 'absolute',
          bottom: height(15),
          alignSelf: 'center',
          borderRadius: 15,
          borderColor: '#000',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WandSparkles size={18} style={{ marginRight: width(3) }} />
        <Text>Generate based on habits and health</Text>
      </TouchableOpacity>

      <AppBlurBottom />
    </>
  );
}