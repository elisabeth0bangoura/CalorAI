// WeightProgressWagmiWithRanges.js
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';
import { LineChart } from 'react-native-wagmi-charts';

import { getAuth } from '@react-native-firebase/auth';
import {
  collection, doc, getDoc, getFirestore,
  onSnapshot, orderBy, query,
} from '@react-native-firebase/firestore';

/* ---------- constants ---------- */
const COLORS = {
  line: '#5BC951',
  fill: '#5BC951',
  goal: '#D3DAE0',
  empty: '#D3DAE0',
  textDim: '#A6B0B8',
  shadow: '#00000050',
};

// 👇 ranges as you requested
export const RANGES = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1Y',  label: '1Y',  days: 365 },
  { key: 'All', label: 'All', days: null },
];

const MS_DAY = 24 * 60 * 60 * 1000;
const KG_PER_LB = 0.45359237;

const toDate = (v) =>
  v?.toDate?.() ??
  (v instanceof Date ? v :
   typeof v === 'number' ? new Date(v) :
   typeof v === 'string' ? new Date(v) :
   v?.seconds ? new Date(v.seconds * 1000) : null);

/* ---------- component ---------- */
export default function WeightProgressChart({
  heightPx = 180,
  range = '90d',
}) {
  const uid = getAuth().currentUser?.uid;

  const [allPoints, setAllPoints] = useState([]); // [{timestamp, value(kg)}]
  const [goalKg, setGoalKg] = useState(null);

  // Normalize incoming prop to a valid range object
  const selected = useMemo(() => {
    const key = String(range || '').trim();
    const found =
      RANGES.find(r => r.key.toLowerCase() === key.toLowerCase()) ||
      RANGES.find(r => r.key === '90d');
    return found;
  }, [range]);

  useEffect(() => {
    console.log('[WeightProgressChart] range ->', range, 'selected ->', selected);
  }, [range, selected]);

  /* stream weight history */
  useEffect(() => {
    if (!uid) return;
    const db = getFirestore();
    const qy = query(
      collection(db, 'users', uid, 'weightprogress'), // 👈 fixed typo
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const docs = snap?.docs ?? [];
        const rows = docs
          .map(d => {
            const x = d.data() || {};
            const t = toDate(x.createdAt);
            const kg = Number.isFinite(+x.kg)
              ? +x.kg
              : Number.isFinite(+x.lb)
              ? +x.lb * KG_PER_LB
              : NaN;
            return t && Number.isFinite(kg) ? { timestamp: t.getTime(), value: kg } : null;
          })
          .filter(Boolean);
        setAllPoints(rows);
      },
      (err) => {
        console.warn('[WeightProgressChart] onSnapshot error:', err?.message || err);
        setAllPoints([]); // safe fallback
      }
    );
    return () => unsub?.();
  }, [uid]);

  /* fetch goal */
  useEffect(() => {
    (async () => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', uid));
        const u = snap.exists() ? snap.data() : {};
        const g = Number.isFinite(+u?.goalWeightKg)
          ? +u.goalWeightKg
          : Number.isFinite(+u?.goalWeightLb)
          ? +u.goalWeightLb * KG_PER_LB
          : null;
        setGoalKg(g);
      } catch (e) {
        console.warn('[WeightProgressChart] getDoc error:', e?.message || e);
      }
    })();
  }, [uid]);

  /* helpers */
  const hasDataFor = (r) => {
    if (!r?.days) return allPoints.length > 0;
    const cutoff = Date.now() - r.days * MS_DAY;
    return allPoints.some(p => p.timestamp >= cutoff);
  };

  /* effective points for chart (with fallback to All if empty for selected) */
  const { points, effectiveLabel } = useMemo(() => {
    if (!selected?.days) {
      return { points: allPoints, effectiveLabel: 'All' };
    }
    const cutoff = Date.now() - selected.days * MS_DAY;
    const filtered = allPoints.filter(p => p.timestamp >= cutoff);
    if (filtered.length === 0) {
      return { points: allPoints, effectiveLabel: 'All' };
    }
    return { points: filtered, effectiveLabel: selected.label };
  }, [selected, allPoints]);

  const hasData = points.length > 0;

  /* y-range includes goal line if present */
  const yRange = useMemo(() => {
    if (!hasData && goalKg == null) return undefined;
    const vals = [
      ...points.map(p => p.value),
      ...(goalKg != null ? [goalKg] : []),
    ];
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 0.5; max += 0.5; }
    const pad = (max - min) * 0.07 || 1;
    return { min: min - pad, max: max + pad };
  }, [points, goalKg, hasData]);

  /* delta for the effective range */
  const latest = points.at(-1)?.value ?? null;
  const first  = points.at(0)?.value ?? null;
  const delta  = latest != null && first != null ? (latest - first) : null;

  /* re-mount provider on meaningful changes */
  const providerKey = `${selected.key}-${points.length}-${points.at(-1)?.timestamp || 0}`;

  return (
    <>
      {/* header */}
      <View style={{ paddingHorizontal: width(5), marginBottom: 8 }}>
        <Text style={{ fontSize: size(18), marginBottom: height(2), fontWeight: '800' }}>
          Weight Progress
        </Text>
      </View>

      {/* card */}
      <View
        style={{
          width: '100%',
          borderRadius: 16,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#f1f1f1',
          paddingVertical: 12,
          marginTop: height(2),
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.01, shadowRadius: 10 },
            android: { elevation: 2, shadowColor: COLORS.shadow },
          }),
        }}
      >
        {hasData ? (
          <LineChart.Provider key={providerKey} data={points} yRange={yRange}>
            <LineChart height={heightPx} yGutter={16} width={Math.round(width(90))}>
              <LineChart.Path color={COLORS.line} width={3}>
                <LineChart.Gradient color={COLORS.fill} />
                {goalKg != null && (
                  <LineChart.HorizontalLine
                    at={{ value: goalKg }}
                    color={COLORS.goal}
                    lineProps={{ strokeDasharray: [6, 8] }}
                  />
                )}
              </LineChart.Path>

              <LineChart.CursorCrosshair color={COLORS.line}>
                <LineChart.Tooltip
                  textStyle={{
                    backgroundColor: 'black',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 12,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                />
                <LineChart.HoverTrap />
              </LineChart.CursorCrosshair>
            </LineChart>

            {/* labels */}
            <View style={{ marginTop: 6, paddingHorizontal: width(5), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <LineChart.DatetimeText style={{ color: COLORS.textDim }} options={{ month: 'short', day: 'numeric' }} />
              <LineChart.PriceText precision={1} />
            </View>

            {/* delta + goal + fallback hint */}
            <View style={{ paddingHorizontal: width(5), marginTop: 6 }}>
              {delta != null && (
                <Text style={{ color: delta >= 0 ? '#C15217' : COLORS.line, fontWeight: '600' }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg in {effectiveLabel}
                </Text>
              )}
              {goalKg != null && (
                <Text style={{ color: COLORS.textDim, marginTop: 2 }}>
                  Goal: <Text style={{ color: '#000', fontWeight: '700' }}>{goalKg} kg</Text>
                </Text>
              )}
              {selected.days && !hasDataFor(selected) && allPoints.length > 0 && (
                <Text style={{ color: COLORS.textDim, marginTop: 2 }}>
                  No entries in {selected.label}. Showing <Text style={{ fontWeight: '700', color: '#000' }}>All</Text>.
                </Text>
              )}
            </View>
          </LineChart.Provider>
        ) : (
          <View style={{ height: heightPx, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ height: 3, width: '85%', backgroundColor: COLORS.empty, borderRadius: 2 }} />
            <Text style={{ color: COLORS.textDim, marginTop: 8 }}>
              No entries yet
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
