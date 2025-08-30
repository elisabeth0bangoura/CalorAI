// app/(auth)/AuthHome.jsx
// RNFB v23-correct imports + flows; routes to /(auth)/signUp with Email + method

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';

// ✅ React Native Firebase v23 default imports
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import AppBlurBottom from './AppBlurBottom';
import { googleSignIn } from './GoogleSignUp/googleSignIn';
import { signUpWithApple } from './signUpWithApple'; // ← Apple helper (RNFB v23)

export default function AuthHome() {
  // (Optional) silence RNFB modular deprecation warnings if any third-party lib uses them
  globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

  const router = useRouter();
  const [loading, setLoading] = useState({ apple: false, google: false, email: false });
  const lottieRef = useRef(null);

  const tap = async (fn) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return fn?.();
  };

  // Optional: use this if you want to auto-route after sign-in by checking a Firestore flag
  const decideNext = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const snap = await firestore().collection('users').doc(user.uid).get();
      const completed = !!snap.data()?.onboardingCompleted;
      router.replace(completed ? '/(tabs)' : '/(auth)/signUp');
    } catch (e) {
      console.warn('Failed to read onboarding flag:', e);
      router.replace('/(auth)/signUp');
    }
  };

  const onApple = async () => {
    if (loading.apple) return;
    setLoading((s) => ({ ...s, apple: true }));
    try {
      const userCred = await signUpWithApple();
      if (userCred) {
        const email = userCred.user?.email ?? auth().currentUser?.email ?? '';
        console.log('[AUTH] Apple email:', email);

        // Push to onboarding with prefilled email
        router.push({
          pathname: '/(auth)/signUp',
          params: { Email: email, method: 'apple' },
        });

        // Or auto-decide:
        // await decideNext();
      }
    } catch (e) {
      if (e?.name !== 'APPLE_SIGNIN_CANCELED' && e?.message !== 'canceled') {
        console.error('Apple sign-in failed:', e);
      }
    } finally {
      setLoading((s) => ({ ...s, apple: false }));
    }
  };

  const onGoogle = async () => {
    if (loading.google) return;
    setLoading((s) => ({ ...s, google: true }));
    try {
      const cred = await googleSignIn(); // { userCredential, idToken, accessToken }
      if (cred) {
        const email = cred?.userCredential?.user?.email ?? auth().currentUser?.email ?? '';
        console.log('[AUTH] Google email:', email);

        router.push({
          pathname: '/(auth)/signUp',
          params: { Email: email, method: 'google' },
        });

        // Or:
        // await decideNext();
      }
    } catch (e) {
      if (e?.name !== 'GOOGLE_SIGNIN_CANCELED' && e?.message !== 'canceled') {
        console.error('Google sign-in failed:', e);
      }
    } finally {
      setLoading((s) => ({ ...s, google: false }));
    }
  };

  const onEmail = async () => {
    if (loading.email) return;
    setLoading((s) => ({ ...s, email: true }));
    try {
      router.replace('/(auth)/Login');
    } finally {
      setLoading((s) => ({ ...s, email: false }));
    }
  };

  const source = require('../../assets/AnimationSignUp.mov');
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={{ height: '100%', width: '100%', backgroundColor: '#fff' }}>
      <StatusBar style="dark" />

      {/* BG animation */}
      <View style={{ alignItems: 'center', marginTop: height(-5) }}>
        <VideoView
          player={player}
          style={{
            alignSelf: 'center',
            height: '100%',
            width: '100%',
            marginTop: height(-5),
          }}
          contentFit="contain"
          nativeControls={false}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Apple */}
        <Pressable
          onPress={() => tap(onApple)}
          disabled={loading.apple}
          style={{
            height: size(55),
            width: '90%',
            marginBottom: height(1),
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            backgroundColor: '#000',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
            opacity: loading.apple ? 0.6 : 1,
          }}
        >
          <View style={{ height: size(20), width: size(20), marginRight: width(4) }}>
            <Image
              source={{ uri: 'https://cdn.brandfetch.io/apple.com/w/419/h/512/theme/light/logo?c=1idHhyM4UatCQKFblcg' }}
              style={{ height: '100%', width: '100%' }}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.btnText, { color: '#fff', fontSize: size(16), fontFamily: 'Open-Sans-SemiBold' }]}>
            Continue with Apple
          </Text>
        </Pressable>

        {/* Google */}
        <Pressable
          onPress={() => tap(onGoogle)}
          disabled={loading.google}
          style={{
            height: size(55),
            width: '90%',
            borderRadius: 20,
            alignItems: 'center',
            marginBottom: height(1),
            justifyContent: 'center',
            flexDirection: 'row',
            backgroundColor: '#000',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
            opacity: loading.google ? 0.6 : 1,
          }}
        >
          <View style={{ height: size(20), width: size(20), marginRight: width(4) }}>
            <Image
              source={{ uri: 'https://cdn.brandfetch.io/id6O2oGzv-/w/800/h/817/theme/dark/symbol.png?c=1bxid64Mup7aczewSAYMX&t=1755835725776' }}
              style={{ height: '100%', width: '100%' }}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.btnText, { color: '#fff', fontSize: size(16), fontFamily: 'Open-Sans-SemiBold' }]}>
            Continue with Google
          </Text>
        </Pressable>

        {/* Email */}
        <Pressable
          onPress={() => tap(onEmail)}
          disabled={loading.email}
          style={[styles.emailBtn, { opacity: loading.email ? 0.6 : 1 }]}
        >
          <Mail size={25} color={'#000'} style={{ marginRight: width(4) }} />
          <Text style={[styles.btnText, { color: '#000', fontSize: size(16), fontFamily: 'Open-Sans-SemiBold' }]}>
            Continue with email
          </Text>
        </Pressable>

        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://yourdomain.com/terms')}>Terms</Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://yourdomain.com/privacy')}>Privacy Policy</Text>.
        </Text>
      </View>

      <AppBlurBottom />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { width: '100%', height: '100%', backgroundColor: '#FFCF2D' },
  container: { width: '100%', height: '100%', backgroundColor: '#FFCF2D', alignItems: 'center' },
  lottie: { position: 'absolute', width: width(100), height: height(100) },
  tagline: { width: 400, marginTop: height(-5), textAlign: 'center', fontFamily: 'Open-Sans', fontSize: size(20) },
  subtle: { marginTop: height(0.5), fontSize: size(12), color: '#333', opacity: 0.8 },
  actions: { position: 'absolute', zIndex: 1000, bottom: height(8), width: '100%', alignItems: 'center' },
  btn: {
    height: size(55),
    width: '90%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  emailBtn: {
    height: size(55),
    width: '90%',
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: height(1),
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnText: { fontSize: size(16), fontFamily: 'Open-Sans-SemiBold' },
  legal: { width: '90%', textAlign: 'center', fontSize: size(11), color: '#333', marginTop: height(1.5), opacity: 0.8 },
  link: { textDecorationLine: 'underline' },
});
