// app/(auth)/GoogleSignUp/googleSignIn.js
// Expo SDK 52+, React Native Firebase v22+ (modular)

import {
  signOut as firebaseSignOut,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import {
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useOnboarding } from '../../Context/OnboardingContext';

/* ===================== Google OAuth config ===================== */
const WEB_CLIENT_ID = '980201356097-28hmqmnbt35emereqknkll599ig1se9v.apps.googleusercontent.com';
const IOS_CLIENT_ID = '980201356097-qr0en5kae92v4rq8880sfcbggfngm26m.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
    scopes: ['profile', 'email'],
    shouldFetchBasicProfile: true,
  });
  configured = true;
}

/* ============================ helpers =========================== */
function mapGoogleError(e) {
  const code = e?.code || e?.message || '';
  if (code === statusCodes.SIGN_IN_CANCELLED) return 'canceled';
  if (code === statusCodes.IN_PROGRESS) return 'Sign-in already in progress.';
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services not available.';
  if (String(code).includes('auth/account-exists-with-different-credential'))
    return 'Account exists with a different sign-in method.';
  return e?.message || 'Google sign-in failed.';
}

const KG_PER_LB = 0.45359237;
const IN_PER_FT = 12;
const CM_PER_IN = 2.54;

const toNum = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};
const kgFromLb = (lb) => (Number.isFinite(Number(lb)) ? Math.round(Number(lb) * KG_PER_LB) : null);
const cmFromFtIn = (ft, inch) => {
  const f = toNum(ft) ?? 0;
  const i = toNum(inch) ?? 0;
  const totalIn = f * IN_PER_FT + i;
  return Math.round(totalIn * CM_PER_IN);
};

/** Grab EVERY non-function value from your OnboardingContext.
 *  (skips setters/toggles/clear/select) */
function extractAllContextValues(ctx) {
  const out = {};
  Object.entries(ctx || {}).forEach(([k, v]) => {
    if (typeof v === 'function') return;
    const lk = String(k);
    if (
      lk.startsWith('set') ||
      lk.startsWith('toggle') ||
      lk.startsWith('clear') ||
      lk.startsWith('select')
    ) return;
    out[lk] = v;
  });
  return out;
}

/** A tiny mirror of frequently queried fields at root (optional) */
function mirrorForRoot(raw = {}) {
  const {
    gender, goal, workouts,
    unitSystem, weightUnit,
    kg, lb, cm, ft, inch,
    goalWeightKg, goalWeightLb, goalWeightUnit,
    year, month, day,
    dietPreferenceId,
    RequestNotifications,
    SmokingFrequency,
  } = raw;
  return {
    gender, goal, workouts,
    unitSystem, weightUnit,
    kg, lb, cm, ft, inch,
    goalWeightKg, goalWeightLb, goalWeightUnit,
    year, month, day,
    dietPreferenceId,
    RequestNotifications,
    SmokingFrequency,
  };
}

/* ================= build payload from context =================== */
export function buildOnboardingPayload(ctx) {
  const raw = extractAllContextValues(ctx);

  // normalized helpers many screens use
  const currentKg =
    raw.weightUnit === 'kg'
      ? toNum(raw.kg) ?? (toNum(raw.lb) ? kgFromLb(raw.lb) : null)
      : toNum(raw.lb)
      ? kgFromLb(raw.lb)
      : toNum(raw.kg);

  const currentCm = toNum(raw.cm) ?? cmFromFtIn(raw.ft, raw.inch);

  const goalKg =
    raw.goalWeightUnit === 'kg'
      ? toNum(raw.goalWeightKg) ?? (toNum(raw.goalWeightLb) ? kgFromLb(raw.goalWeightLb) : null)
      : toNum(raw.goalWeightLb)
      ? kgFromLb(raw.goalWeightLb)
      : toNum(raw.goalWeightKg);

  return {
    savedAt: serverTimestamp(),
    ...raw, // ⬅️ ALL context values at the root of "onboarding"
    normalized: { currentKg, currentCm, goalKg },
  };
}

/* ====================== Firestore save ========================= */
async function saveUsersFullDoc(uid, baseProfile = {}, ctx) {
  if (!uid) throw new Error('saveUsersFullDoc: uid is required');

  const db = getFirestore();

  // 1) full context flatten
  const contextFlat = extractAllContextValues(ctx);

  // 2) normalized helpers
  const payload = buildOnboardingPayload(ctx);

  // 3) small mirror at root for easy querying
  const rootMirror = mirrorForRoot(contextFlat);

  // 4) final doc body: put EVERYTHING at users/{uid}
  const docBody = {
    uid,
    updatedAt: serverTimestamp(),

    // full auth profile
    ...baseProfile,

    // ✅ FLATTENED context (ALL values right at root)
    ...contextFlat,

    // ✅ Also keep it grouped for convenience
    context: contextFlat,

    // ✅ Useful numbers
    normalized: payload.normalized,
  };

  await setDoc(doc(db, 'users', uid), docBody, { merge: true });
}

/* ========== Sign in with Google (optionally save ALL context) ========== */
/** Call as:
 *  - googleSignIn()                            -> saves profile only
 *  - googleSignIn(ctxFromUseOnboarding)        -> saves profile + ALL context
 */
export async function googleSignIn(ctx) {
  ensureConfigured();

  try {
    if (Platform.OS === 'android') {
      try { await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }); } catch {}
    }

    const account = await GoogleSignin.signIn(); // throws if canceled
    const tokens = await GoogleSignin.getTokens().catch(() => null);
    const idToken = account?.idToken || tokens?.idToken || null;
    const accessToken = account?.accessToken || tokens?.accessToken || null;

    if (!idToken) throw new Error('No Google idToken returned.');

    const auth = getAuth();
    const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential?.user;
    const uid = user?.uid;

    const baseProfile = {
      email: user?.email || null,
      displayName: user?.displayName || null,
      photoURL: user?.photoURL || null,
      emailVerified: !!user?.emailVerified,
      phoneNumber: user?.phoneNumber || null,
      lastLoginAt: serverTimestamp(),
      provider: 'google',
    };

    // Save whole user + (optional) full context
    if (ctx && typeof ctx === 'object') {
      await saveUsersFullDoc(uid, baseProfile, ctx);
    } else {
      // At least persist the profile if no context provided yet
      await setDoc(
        doc(getFirestore(), 'users', uid),
        { uid, updatedAt: serverTimestamp(), ...baseProfile },
        { merge: true }
      );
    }

    return { uid, userCredential };
  } catch (e) {
    const msg = mapGoogleError(e);
    if (msg === 'canceled') {
      const err = new Error('canceled');
      err.name = 'GOOGLE_SIGNIN_CANCELED';
      throw err;
    }
    throw new Error(msg);
  }
}

export async function googleSignOut() {
  try {
    await GoogleSignin.signOut().catch(() => {});
    const auth = getAuth();
    await firebaseSignOut(auth);
  } catch {}
}

/* ========== Hook: sign in & save ALL context in one go ========== */
export function useGoogleSignInWithOnboarding() {
  const ctx = useOnboarding();

  // One dep is fine — we want the latest values
  const signIn = useCallback(async () => {
    const res = await googleSignIn(ctx); // passes full context
    return res; // { uid, userCredential }
  }, [ctx]);

  return { signIn };
}

/* ========== Save ALL context for current signed-in user ========== */
export async function saveAllContextForCurrentUser(ctx) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user?.uid) throw new Error('Not signed in.');

  const baseProfile = {
    email: user?.email || null,
    displayName: user?.displayName || null,
    photoURL: user?.photoURL || null,
    emailVerified: !!user?.emailVerified,
    phoneNumber: user?.phoneNumber || null,
    lastLoginAt: serverTimestamp(),
  };

  await saveUsersFullDoc(user.uid, baseProfile, ctx);
}
