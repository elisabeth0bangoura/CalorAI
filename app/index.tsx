// app/index.tsx
import { FirebaseAuthTypes, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { Image } from 'expo-image';
import { Href, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { height } from 'react-native-responsive-sizes';

SplashScreen.preventAutoHideAsync();

// If you don't have app/(tabs)/index.tsx, use '/(tabs)/home' instead.
type Dest = '/(tabs)' | '/(auth)/AuthHome';

const ALLOWED = new Set(['google.com', 'apple.com']);

function isAppleOrGoogle(user: FirebaseAuthTypes.User) {
  const ids = user.providerData?.map(p => p?.providerId) ?? [];
  return ids.some(id => ALLOWED.has(String(id)));
}

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      let target: Dest = '/(auth)/AuthHome';

      if (user) {
        // ensure providerData is populated after cold start
        try { await user.reload(); } catch {}
        // console.log('providers:', user.providerData.map(p => p.providerId)); // handy debug
        if (isAppleOrGoogle(user)) {
          target = '/(tabs)'; // or '/(tabs)/home'
        }
      }

      try {
        router.replace(target as Href);
      } finally {
        await SplashScreen.hideAsync();
        setLoading(false);
      }
    });

    return unsub;
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
            style={{
              height: 100,
              bottom: height(6),
              position: 'absolute',
              width: 100,
            }}
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
    flex: 1, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
});
