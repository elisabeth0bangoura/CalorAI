// BMIWidget.js
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';

import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

const COLORS = {
  dim: '#A6B0B8',
  chipTxt: '#111',
  under: '#0081FF',   // blue
  healthy: '#00C139', // green
  over: '#FD9E00',    // orange
  obese: '#E51C07',   // red
  trackBg: '#F1F4F7',
  cardShadow: '#00000050',
};

// BMI categories (WHO adult)
const CATS = [
  { key: 'under',   label: 'Underweight', from: -Infinity, to: 18.49, color: COLORS.under },
  { key: 'healthy', label: 'Healthy',     from: 18.5,     to: 24.99, color: COLORS.healthy },
  { key: 'over',    label: 'Overweight',  from: 25,       to: 29.99, color: COLORS.over },
  { key: 'obese',   label: 'Obese',       from: 30,       to: Infinity, color: COLORS.obese },
];

// scale domain to place the marker (clamped)
const SCALE_MIN = 13;
const SCALE_MAX = 40;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default function BMIWidget() {
  const [loading, setLoading] = useState(true);
  const [bmi, setBmi] = useState(null);
  const [err, setErr] = useState(null);

  const [user, setUser] = useState(null);
  const [trackW, setTrackW] = useState(0);

  // --- subscribe to /users/$uid ---
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      setErr('Not signed in');
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(getFirestore(), 'users', uid),
      (snap) => {
        const d = snap.exists() ? snap.data() : null;
        setUser(d);
        setLoading(false);
        setErr(null);
      },
      (e) => { setErr(String(e?.message || e)); setLoading(false); }
    );
    return () => unsub();
  }, []);

  // --- compute BMI from user fields ---
  useEffect(() => {
    if (!user) return;

    // height
    let cm = Number(user?.cm);
    if (!Number.isFinite(cm)) {
      const ft = Number(user?.ft);
      const inch = Number(user?.inch);
      if (Number.isFinite(ft) || Number.isFinite(inch)) {
        cm = ((ft || 0) * 12 + (inch || 0)) * CM_PER_IN;
      }
    }

    // weight
    let kg = Number(user?.kg);
    if (!Number.isFinite(kg) && Number.isFinite(Number(user?.lb))) {
      kg = Number(user.lb) * KG_PER_LB;
    }

    if (!Number.isFinite(cm) || !Number.isFinite(kg) || cm <= 0 || kg <= 0) {
      setBmi(null);
      return;
    }

    const m = cm / 100;
    const val = kg / (m * m);
    setBmi(val);
  }, [user]);

  const category = useMemo(() => {
    if (!Number.isFinite(bmi)) return null;
    return CATS.find(c => bmi >= c.from && bmi <= c.to) || null;
  }, [bmi]);

  const markerLeft = useMemo(() => {
    if (!Number.isFinite(bmi) || trackW <= 0) return 0;
    const t = (clamp(bmi, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
    return Math.round(t * trackW);
  }, [bmi, trackW]);

  // segments for the colored scale (proportional to WHO ranges within [13..40])
  const segs = useMemo(() => {
    const edges = [18.5, 25, 30];
    const ranges = [
      { color: COLORS.under,  from: SCALE_MIN, to: edges[0] },
      { color: COLORS.healthy,from: edges[0],  to: edges[1] },
      { color: COLORS.over,   from: edges[1],  to: edges[2] },
      { color: COLORS.obese,  from: edges[2],  to: SCALE_MAX },
    ];
    const len = SCALE_MAX - SCALE_MIN;
    return ranges.map(r => ({ color: r.color, flex: (r.to - r.from) / len }));
  }, []);

  // ---- UI ----
  return (


    <>
      <Text style={{ fontSize: size(18), fontWeight: '800', marginLeft: width(5), marginBottom: 8 }}>
        Your BMI
      </Text>
 <Text style={{marginLeft: width(5),  fontSize: size(38), fontWeight: '800' }}>
          {Number.isFinite(bmi) ? bmi.toFixed(1) : '--'}
        </Text>

    

    <View
      style={{
        width: '100%',
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f1f1f1',
        paddingVertical: 16,
        marginTop: height(2),
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.01, shadowRadius: 10 },
          android: { elevation: 2, shadowColor: COLORS.cardShadow },
        }),
      }}
    >
    
    
      {/* Value row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: width(5) }}>
       

        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: COLORS.dim, fontSize: size(14) }}>
            {Number.isFinite(bmi) ? 'Based on your latest height & weight' : loading ? 'Loading…' : 'Missing height or weight'}
          </Text>
          {category && (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: category.color + '22',
                borderColor: category.color,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                marginTop: 6,
              }}
            >
              <Text style={{ color: category.color, fontWeight: '700' }}>{category.label}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Scale */}
      <View style={{ paddingHorizontal: width(5), marginTop: 14 }}>
        <View
          onLayout={(e) => setTrackW(Math.max(0, Math.round(e.nativeEvent.layout.width)))}
          style={{
            height: 12,
            width: '100%',
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: COLORS.trackBg,
          }}
        >
          <View style={{ flexDirection: 'row', height: '100%' }}>
            {segs.map((s, i) => (
              <View key={i} style={{ flex: s.flex, backgroundColor: s.color, opacity: 0.65 }} />
            ))}
          </View>

          {/* Marker */}
          {Number.isFinite(bmi) && (
            <View
              style={{
                position: 'absolute',
                left: markerLeft - 1, // center the 2px line
                top: -6,
                width: 2,
                height: 24,
                backgroundColor: '#000',
                borderRadius: 2,
              }}
            />
          )}
        </View>

        {/* Legend */}
        <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: COLORS.dim, fontSize: size(12) }}>Under</Text>
          <Text style={{ color: COLORS.dim, fontSize: size(12) }}>Healthy</Text>
          <Text style={{ color: COLORS.dim, fontSize: size(12) }}>Over</Text>
          <Text style={{ color: COLORS.dim, fontSize: size(12) }}>Obese</Text>
        </View>
      </View>
    </View>


 </>
  );
}
