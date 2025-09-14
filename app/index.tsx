// app/index.tsx
import { FirebaseAuthTypes, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { Image } from 'expo-image';
import { Href, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { LogBox, StyleSheet, Text, View, } from 'react-native';
import { height, size } from 'react-native-responsive-sizes';

SplashScreen.preventAutoHideAsync();

// If you don't have app/(tabs)/index.tsx, use '/(tabs)/home' instead.
type Dest = '/(tabs)' | '/(auth)/AuthHome';

const ALLOWED = new Set(['google.com', 'apple.com']);

function isAppleOrGoogle(user: FirebaseAuthTypes.User) {
  const ids = user.providerData?.map(p => p?.providerId) ?? [];
  return ids.some(id => ALLOWED.has(String(id)));
}

export default function Index() {
LogBox.ignoreAllLogs(true);

  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  // Prevent double replace + double hide in dev/StrictMode
  const lastTargetRef = useRef<Dest | null>(null);
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      let target: Dest = '/(auth)/AuthHome';

      if (user) {
        try { await user.reload(); } catch {}
        if (isAppleOrGoogle(user)) {
          target = '/(tabs)'; // or '/(tabs)/home'
        }
      }

      // Navigate only if target changed and we're not already there
      if (lastTargetRef.current !== target || pathname !== target) {
        lastTargetRef.current = target;
        router.replace(target as Href);
      }

      // Hide splash exactly once
      if (!splashHiddenRef.current) {
        splashHiddenRef.current = true;
        await SplashScreen.hideAsync();
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, pathname]);

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <Image
            source={require('../assets/Pink_Logo.png')}
            style={{ height: 200, width: 200 }}
            contentFit="contain"
          />
         
         <Text style={{
          fontSize: size(18),
          position: 'absolute',
          bottom: height(10),
          fontWeight: "700"
         }}>
          Bantico
         </Text>
        </View>
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5BCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
