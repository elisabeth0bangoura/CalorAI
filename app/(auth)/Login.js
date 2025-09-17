import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'moment/locale/de';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { height, size, width } from 'react-native-responsive-sizes';
import { useSheets } from '../Context/SheetsContext';
import { googleSignIn } from './GoogleSignUp/googleSignIn';
import { signUpWithApple } from './signUpWithApple';

const storage = new MMKV();

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
  const { dismiss } = useSheets();

  const [Email, setEmail] = useState('');
  const [Password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errText, setErrText] = useState('');

  const fullText = 'Your space to test ideas, get feedback, and move fast.';
  const [displayedText, setDisplayedText] = useState('');

  const animationRef = useRef(null);

  useEffect(() => {
    animationRef.current?.play();
    animationRef.current?.play(30, 120);
  }, []);

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
    dismiss('LogIn');
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

  const handleGoogleLogin = async () => {
    setErrText('');
    setBusy(true);
    try {
      const { uid } = await googleSignIn();
      await afterLogin(uid);
    } catch (e) {
      if (e?.message === 'canceled') return;
      setErrText(e?.message || 'Google sign-in failed.');
      console.error('Google login error:', e);
    } finally {
      setBusy(false);
    }
  };

  const handleAppleLogin = async () => {
    setErrText('');
    setBusy(true);
    try {
      const userCred = await signUpWithApple();
      const user = userCred?.user;
      const uid = user?.uid;
      if (!uid) throw new Error('No uid from Apple login.');
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
      <View style={{ height: '100%', width: '100%', backgroundColor: '#fff' }}>
        <Text
          style={{
            fontSize: size(20),
            marginTop: height(4),
            alignSelf: 'center',
            color: '#000',
            zIndex: 1000,
            fontWeight: '800',
          }}
        >
          Log In
        </Text>

        <View
          style={{
            width: '90%',
            position: 'absolute',
            marginTop: height(8),
            alignSelf: 'center',
            zIndex: 1000,
            top: height(6),
          }}
        >
          <TouchableOpacity
            disabled={busy}
            onPress={handleGoogleLogin}
            style={{
              width: width(90),
              alignSelf: 'center',
              borderRadius: 15,
              borderWidth: 1,
              height: size(60),
              flexDirection: 'row',
              borderColor: '#ddd',
              paddingVertical: 14,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: height(2),
              backgroundColor: '#fff',
            }}
          >
            <View
              style={{
                height: size(20),
                width: size(20),
                alignItems: 'center',
                marginRight: width(4),
                justifyContent: 'center',
              }}
            >
              <Image source={require('../../assets/brands/google.png')} style={{ height: '100%', width: '100%' }} />
            </View>
            <Text style={{ fontSize: size(16), color: '#111', fontWeight: '700' }}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={busy}
            onPress={handleAppleLogin}
            style={{
              width: width(90),
              alignSelf: 'center',
              height: size(60),
              borderRadius: 15,
              borderWidth: 1,
              borderColor: '#ddd',
              flexDirection: 'row',
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            <View
              style={{
                height: size(20),
                width: size(20),
                alignItems: 'center',
                marginRight: width(4),
                justifyContent: 'center',
              }}
            >
              <Image source={require('../../assets/brands/Apple.png')} style={{ height: '100%', width: '100%' }} />
            </View>

            <Text style={{ fontSize: size(16), color: '#fff', fontWeight: '700' }}>Continue with Apple</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
