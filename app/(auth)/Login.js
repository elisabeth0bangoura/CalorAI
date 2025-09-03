import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import 'moment/locale/de';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { height, size, width } from 'react-native-responsive-sizes';

// Firebase (modular)
import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from '@react-native-firebase/firestore';

// Your existing OAuth helpers
import { googleSignIn } from './GoogleSignUp/googleSignIn'; // <-- path relative to THIS file
import { signUpWithApple } from './signUpWithApple'; // <-- path relative to THIS file

const storage = new MMKV();

/* Preload images into MMKV (unchanged) */
const preloadAccountImages = async (uid) => {
  try {
    const snapshot = await getDocs(collection(getFirestore(), 'users', uid, 'AccountImages'));
    const urls = Array(6).fill(null);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data?.index !== undefined && data.url) {
        urls[data.index] = data.url;
      }
    });
    storage.set(`${uid}_cachedAccountImages`, JSON.stringify(urls));
  } catch (err) {
    console.warn('Error preloading account images:', err);
  }
};

export default function LogIn() {
  const router = useRouter();
  const auth = getAuth();

  const [Email, setEmail] = useState('');
  const [Password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errText, setErrText] = useState('');

  const fullText = 'Your space to test ideas, get feedback, and move fast.';
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (index < fullText.length) {
          const next = prev + fullText.charAt(index);
          index++;
          return next;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const afterLogin = async (uid) => {
    const lastUid = storage.getString('lastLoggedInUser');
    if (lastUid && lastUid !== uid) {
      storage.delete(`${lastUid}_cachedAccountImages`);
    }
    storage.set('lastLoggedInUser', uid);
    await preloadAccountImages(uid);
    router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    setErrText('');
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, Email.trim(), Password);
      await afterLogin(cred.user.uid);
    } catch (e) {
      setErrText(e?.message || 'Login failed.');
      console.error('Login error:', e);
    } finally {
      setBusy(false);
    }
  };

  // --- Google login (uses your existing helper which already upserts users/{uid})
  const handleGoogleLogin = async () => {
    setErrText('');
    setBusy(true);
    try {
      const { uid } = await googleSignIn(); // your helper handles setDoc(...provider:'google')
      await afterLogin(uid);
    } catch (e) {
      if (e?.message === 'canceled') return; // user cancelled
      setErrText(e?.message || 'Google sign-in failed.');
      console.error('Google login error:', e);
    } finally {
      setBusy(false);
    }
  };

  // --- Apple login (call your helper, then upsert users/{uid})
  const handleAppleLogin = async () => {
    setErrText('');
    setBusy(true);
    try {
      const userCred = await signUpWithApple(); // returns Firebase UserCredential
      const user = userCred?.user;
      const uid = user?.uid;
      if (!uid) throw new Error('No uid from Apple login.');

      // Upsert minimal profile in Firestore (provider: 'apple')
      await setDoc(
        doc(getFirestore(), 'users', uid),
        {
          uid,
          email: user?.email || null,
          displayName: user?.displayName || null,
          photoURL: user?.photoURL || null,
          emailVerified: !!user?.emailVerified,
          phoneNumber: user?.phoneNumber || null,
          lastLoginAt: serverTimestamp(),
          provider: 'apple',
        },
        { merge: true }
      );

      await afterLogin(uid);
    } catch (e) {
      if (e?.name === 'APPLE_SIGNIN_CANCELED' || e?.message === 'canceled') return;
      setErrText(e?.message || 'Apple sign-in failed.');
      console.error('Apple login error:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ height: '100%', width: '100%', backgroundColor: '#FFCF2E' }}>
          <KeyboardAvoidingView
            style={{ flex: 1, alignItems: 'center', backgroundColor: '#FFCF2E' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={{ height: '100%', width: '100%', backgroundColor: '#fff' }}>
              <Text
                style={{
                  fontSize: size(28),
                  marginTop: height(9),
                  marginLeft: width(5),
                  width: width(80),
                  color: '#000',
                  zIndex: 1000,
                  fontFamily: 'PlayfairDisplay-Bold',
                }}
              >
                Log In
              </Text>

              <View style={{ height: 70, width: '90%' }}>
                <Text
                  style={{
                    fontSize: size(16),
                    marginTop: height(2),
                    marginLeft: width(5),
                    color: '#222',
                    zIndex: 1000,
                    fontFamily: 'Open-Sans',
                  }}
                >
                  {displayedText}
                </Text>
              </View>

              {!!errText && (
                <Text
                  style={{
                    color: '#C00',
                    marginLeft: width(5),
                    marginTop: height(1),
                    fontSize: size(14),
                  }}
                >
                  {errText}
                </Text>
              )}

              {/* Email */}
              <TextInput
                placeholder="E-Mail"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setEmail}
                value={Email}
                editable={!busy}
                style={{
                  borderWidth: 1,
                  borderColor: '#222',
                  width: width(90),
                  alignSelf: 'center',
                  textAlign: 'center',
                  marginTop: height(3),
                  borderRadius: 10,
                  height: height(6),
                  fontSize: size(16),
                  paddingHorizontal: width(5),
                }}
              />

              {/* Password */}
              <TextInput
                placeholder="Password"
                onChangeText={setPassword}
                value={Password}
                secureTextEntry={true}
                editable={!busy}
                style={{
                  borderWidth: 1,
                  borderColor: '#222',
                  width: width(90),
                  fontSize: size(16),
                  alignSelf: 'center',
                  marginTop: height(2),
                  textAlign: 'center',
                  borderRadius: 10,
                  height: height(6),
                  paddingHorizontal: width(5),
                }}
              />

              {/* Email/password login */}
              <TouchableOpacity
                disabled={busy}
                onPress={handleLogin}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  marginTop: height(3),
                  alignSelf: 'center',
                  flexDirection: 'row',
                  borderRadius: 10,
                  backgroundColor: busy ? '#444' : '#222',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.14,
                  shadowRadius: 8.27,
                  elevation: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    fontFamily: 'PlayfairDisplay-Bold',
                    color: '#fff',
                  }}
                >
                  Next
                </Text>
                <ArrowRight color={'#fff'} size={size(22)} style={{ marginLeft: width(2) }} />
              </TouchableOpacity>

              {/* Divider */}
              <View style={{ alignItems: 'center', marginVertical: height(3) }}>
                <Text style={{ color: '#666' }}>or continue with</Text>
              </View>

              {/* Google */}
              <TouchableOpacity
                disabled={busy}
                onPress={handleGoogleLogin}
                style={{
                  width: width(90),
                  alignSelf: 'center',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#ddd',
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: height(1.5),
                  backgroundColor: '#fff',
                }}
              >
                <Text style={{ fontSize: size(16), color: '#111', fontWeight: '700' }}>
                  Continue with Google
                </Text>
              </TouchableOpacity>

              {/* Apple (iOS only — your helper throws on Android) */}
              <TouchableOpacity
                disabled={busy}
                onPress={handleAppleLogin}
                style={{
                  width: width(90),
                  alignSelf: 'center',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#ddd',
                  paddingVertical: 14,
                  alignItems: 'center',
                  backgroundColor: '#000',
                }}
              >
                <Text style={{ fontSize: size(16), color: '#fff', fontWeight: '700' }}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}
