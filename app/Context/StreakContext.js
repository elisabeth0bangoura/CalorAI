// StreakContext.js (JS) — Realtime weekly streak from /users/{uid}/Inventory
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from '@react-native-firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* helpers */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const startOfWeek = (date, weekStartsOn = 1) => {
  const d = new Date(date);
  const day = (d.getDay() + 7 - weekStartsOn) % 7; // 0..6; Monday=1
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
};
const endOfWeek = (date, weekStartsOn = 1) => {
  const start = startOfWeek(date, weekStartsOn);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
};
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

const mixHex = (aHex, bHex, t) => {
  const norm = h => h.replace('#','');
  const hx = s => {
    const n = norm(s);
    return parseInt(n.length === 3 ? n.split('').map(c=>c+c).join('') : n, 16);
  };
  const a=hx(aHex), b=hx(bHex);
  const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
  const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
  const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);
  return '#'+[r,g,bl].map(x=>x.toString(16).padStart(2,'0')).join('');
};

const StreakContext = createContext(null);

export function StreakProvider({ children, weekStartsOn = 1 }) {
  const db = getFirestore();
  const [uid, setUid] = useState(null);
  const [daysSet, setDaysSet] = useState(new Set());
  const rerunKey = useRef(0); // bump to re-bind query on week rollover

  /* auth -> uid (realtime) */
  useEffect(() => {
    const auth = getAuth();
    setUid(auth.currentUser?.uid ?? null);
    const unsub = onAuthStateChanged(auth, u => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  /* realtime Firestore: ONLY current week, auto rollover at week boundary */
  useEffect(() => {
    if (!uid) { setDaysSet(new Set()); return; }

    const now = new Date();
    const start = startOfWeek(now, weekStartsOn);
    const end   = endOfWeek(now, weekStartsOn);

    const qy = query(
      collection(db, `users/${uid}/Inventory`),
      where('created_at', '>=', Timestamp.fromDate(start)),
      where('created_at', '<',  Timestamp.fromDate(end)),
      orderBy('created_at', 'asc'),
    );

    const unsub = onSnapshot(
      qy,
      { includeMetadataChanges: true },
      snap => {
        const s = new Set();
        snap.forEach(doc => {
          const raw = doc.data()?.created_at;
          if (!raw) return;
          const d = raw?.toDate ? raw.toDate()
                  : typeof raw === 'number' ? new Date(raw)
                  : new Date(raw);
          if (isNaN(d)) return;
          d.setHours(0,0,0,0);
          s.add(iso(d)); // store day ISO
        });
        setDaysSet(s);
      },
      err => {
        console.warn('[StreakProvider] onSnapshot error:', err);
        setDaysSet(new Set());
      }
    );

    // schedule a rebind at next week start so query window updates
    const msToNextWeek = Math.max(1000, end.getTime() - now.getTime() + 1000);
    const tid = setTimeout(() => {
      rerunKey.current += 1; // changing deps below retriggers effect
    }, msToNextWeek);

    return () => {
      clearTimeout(tid);
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, uid, weekStartsOn, rerunKey.current]);

  /* build current week model from daysSet */
  const week = useMemo(() => {
    const start = startOfWeek(new Date(), weekStartsOn);
    const labels = ['M','T','W','T','F','S','S'];
    const days = [];
    const done = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = iso(d);
      const isDone = daysSet.has(key);
      if (isDone) done.push(key);
      days.push({ key, label: labels[i], isDone });
    }
    return { startISO: iso(start), days, doneDates: done };
  }, [daysSet, weekStartsOn]);

  /* weekly streak = how many days done this week (0..7) */
  const weekCount = useMemo(() => week.days.filter(d => d.isDone).length, [week]);
  const capped7 = clamp(weekCount, 0, 7);
  const ratio = capped7 / 7;

  /* derived colors */
  const colors = useMemo(() => {
    const bg = mixHex('#E5EAF0', '#5BC951', ratio);   // grey -> green
    const fg = capped7 >= 5 ? '#FFFFFF' : '#000000';  // flip to white at 5+
    return {
      bg,
      fg,
      dotGreen: '#22C55E',
      dotIdle: '#F1F3F9',
      checkColor: '#FFFFFF',
      ratio,
    };
  }, [capped7, ratio]);

  const value = useMemo(() => ({
    uid,
    capped7,      // 0..7 done this week
    ratio,        // for your Animated bg
    colors,
    week,         // { days, doneDates }
    greenCount: capped7,
  }), [uid, capped7, ratio, colors, week]);

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used inside <StreakProvider>');
  return ctx;
}
