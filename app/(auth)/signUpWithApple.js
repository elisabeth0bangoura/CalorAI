// app/(auth)/signUpWithApple.js
// React Native Firebase v23 + Expo Apple Auth (nonce flow correct)

import auth from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

function randomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function mapFirebaseAppleError(e) {
  const code = e?.code || '';
  if (code.includes('auth/account-exists-with-different-credential')) return 'Account exists with a different sign-in method.';
  if (code.includes('auth/invalid-credential')) return 'Invalid Apple credential.';
  if (code.includes('auth/operation-not-allowed')) return 'Apple Sign-In is disabled in Firebase.';
  if (code.includes('auth/user-disabled')) return 'This user has been disabled.';
  if (code.includes('auth/internal-error')) return 'Internal auth error. Check Apple keys in Firebase & rebuild the app.';
  return e?.message || 'Sign in failed. Please try again.';
}

/**
 * Sign up / Sign in with Apple (iOS only).
 * - Sends SHA256(nonce) to Apple
 * - Uses RAW nonce for Firebase
 * @returns {Promise<import('@react-native-firebase/auth').FirebaseAuthTypes.UserCredential>}
 */
export async function signUpWithApple() {
  if (Platform.OS !== 'ios') throw new Error('Apple Sign-In is iOS only.');
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Sign In with Apple not available on this device.');

  try {
    // 1) Nonce
    const rawNonce = randomString(32);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    // 2) Apple — pass HASHED nonce here
    const resp = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken, fullName } = resp || {};
    if (!identityToken) throw new Error('No identity token from Apple.');

    // 3) RNFB v23 — build credential with RAW nonce here
    const appleCredential = auth.AppleAuthProvider.credential(identityToken, rawNonce);

    // 4) Firebase sign-in
    const userCred = await auth().signInWithCredential(appleCredential);

    // 5) Optional: set display name on first run
    const user = userCred.user;
    const display = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
    if (display && !user.displayName) {
      await user.updateProfile({ displayName: display }).catch(() => {});
    }

    return userCred;
  } catch (e) {
    if (e?.code === 'ERR_CANCELED') {
      const cancelErr = new Error('canceled');
      cancelErr.name = 'APPLE_SIGNIN_CANCELED';
      throw cancelErr;
    }
    throw new Error(mapFirebaseAppleError(e));
  }
}
