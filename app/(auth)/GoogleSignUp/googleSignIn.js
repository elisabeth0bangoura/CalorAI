// app/(auth)/GoogleSignUp/googleSignIn.js
// Expo SDK 52+, React Native Firebase v23

import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// ⬇️ REPLACE THESE with your real IDs from Google Cloud Console → Credentials
// Web client ID: type = "Web application"
// Fill these:
const WEB_CLIENT_ID = '980201356097-28hmqmnbt35emereqknkll599ig1se9v.apps.googleusercontent.com';
const IOS_CLIENT_ID = '980201356097-qr0en5kae92v4rq8880sfcbggfngm26m.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID, // iOS only (NOT reversed)
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
  configured = true;
}

function mapGoogleError(e) {
  const code = e?.code || e?.message || '';
  if (code === statusCodes.SIGN_IN_CANCELLED) return 'canceled';
  if (code === statusCodes.IN_PROGRESS) return 'Sign-in already in progress.';
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services not available.';
  if (String(code).includes('auth/account-exists-with-different-credential'))
    return 'Account exists with a different sign-in method.';
  return e?.message || 'Google sign-in failed.';
}

export async function googleSignIn() {
  ensureConfigured();

  try {
    // Android: make sure Play Services are ready
    try { await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }); } catch {}

    // 1) Native Google prompt
    const account = await GoogleSignin.signIn(); // throws if canceled
    let idToken = account?.idToken;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens?.idToken;
    }
    if (!idToken) throw new Error('No Google idToken returned.');

    // Optional access token (if you need Google APIs)
    const tokens = await GoogleSignin.getTokens().catch(() => null);
    const accessToken = tokens?.accessToken;

    // 2) Firebase credential
    const credential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(credential);

    return { userCredential, idToken, accessToken };
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
  try { await GoogleSignin.signOut().catch(() => {}); await auth().signOut(); } catch {}
}
