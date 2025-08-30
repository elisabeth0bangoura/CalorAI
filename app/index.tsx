// app/index.tsx
import { Image } from 'expo-image';
import { Href, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { height } from 'react-native-responsive-sizes';

// ✅ React Native Firebase v23: default imports
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

SplashScreen.preventAutoHideAsync();

type Dest =  "/(auth)/signUp";  //'/(auth)/AuthHome' | '/(tabs)';

type Provider = 'google' | 'apple' | 'email' | 'phone' | 'anonymous' | 'custom' | 'unknown';

function detectProviders(user: FirebaseAuthTypes.User): Provider[] {
  const out: Provider[] = [];
  const ids = (user.providerData || []).map(p => p?.providerId).filter(Boolean) as string[];

  if (ids.includes('google.com')) out.push('google');
  if (ids.includes('apple.com')) out.push('apple');
  if (ids.includes('password')) out.push('email');
  if (ids.includes('phone')) out.push('phone');
  if (user.isAnonymous) out.push('anonymous');
  if (ids.includes('custom')) out.push('custom');

  if (out.length === 0) out.push('unknown');
  return out;
}

/**
 * Ensure a minimal users/{uid} doc exists. This runs "fire-and-forget"
 * and does NOT block navigation to tabs.
 */
async function ensureUserDoc(user: FirebaseAuthTypes.User, providers: Provider[]) {
  try {
    const ref = firestore().collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        providers,
        onboardingCompleted: true, // 👈 if you ALWAYS want tabs for logged-in users
        createdAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      // Optional: keep providers up to date
      await ref.set({ providers }, { merge: true });
    }
  } catch (e) {
    // Non-blocking; log only
    console.warn('[Index] ensureUserDoc failed:', e);
  }
}

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const navigatedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const unsub = auth().onAuthStateChanged(async (user) => {
      if (cancelled || navigatedRef.current) return;

      const HOLD_MS = 80; // tiny hold to avoid flicker
      let target: Dest;

      if (!user) {
        console.log('[Index] No user -> AuthHome');
        target =  "/(auth)/signUp"; //"/(auth)/AuthHome";
      } else {
        // ✅ User is logged in (Google / Apple / Email / etc.)
        const providers = detectProviders(user);
        console.log('[Index] Signed in:', user.uid, 'providers:', providers);

        // Don’t block navigation — start this and move on
        ensureUserDoc(user, providers);

        // Go straight to tabs for any logged-in user
        target = "/(auth)/signUp"; // '/(tabs)';
      }

      timeoutRef.current = setTimeout(async () => {
        if (cancelled || navigatedRef.current) return;
        try {
          navigatedRef.current = true;
          console.log('[Index] Navigating to', target);
          router.replace(target as Href);
        } finally {
          await SplashScreen.hideAsync();
          setLoading(false);
        }
      }, HOLD_MS);
    });

    return () => {
      cancelled = true;
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <Image
            source={require('../assets/Logo_App_white.png')}
            style={{ height: 100, width: 100 }}
            contentFit="contain"
          />
          <Image
            source={require('../assets/Logo_App_white.png')}
            style={{ height: 100, bottom: height(6), position: 'absolute', width: 100 }}
            contentFit="contain"
          />
        </View>
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
