import { useLocalSearchParams, useRouter } from 'expo-router';
import 'moment/locale/de';
import { useEffect, useMemo, useRef, useState } from 'react';


import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { ArrowRight } from 'lucide-react-native';
import { height, size, width } from 'react-native-responsive-sizes';

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  getAuth,
  linkWithCredential,
  updateProfile,
} from '@react-native-firebase/auth';

import { doc, getFirestore, serverTimestamp, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { useIsFocused } from '@react-navigation/native';

export default function SignUp5() {
  const { Email, Phonenumber, method, Password, UserName, Birthday } = useLocalSearchParams();
  const router = useRouter();
  const isFocused = useIsFocused(); // 👈 focus-aware

  const fullText1 = `Ich bin dein smarter Vertragsort.\nBei Bantico findest du all deine Verträge –\nMiete, Auto, Versicherungen oder Business-Verträge – an einem Ort.\n\nDigital, sicher, organisiert.\nIch erinnere dich an Fristen, schreibe Kündigungen,\nund halte alle wichtigen Dinge für dich fest.\nNichts geht mehr verloren.`;
  const fullText2 = `Wie darf ich dich nennen?`;

  const [displayedText1, setDisplayedText1] = useState('');
  const [displayedText2, setDisplayedText2] = useState('');
  const [index1, setIndex1] = useState(0);
  const [index2, setIndex2] = useState(0);
  const [showSecondText, setShowSecondText] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [Einverstanden, setEinverstanden] = useState(!true);
  const [firstDone, setFirstDone] = useState(false);


  
  useEffect(() => {
    if (index1 < fullText1.length) {
      const timeout = setTimeout(() => {
        setDisplayedText1((prev) => prev + fullText1.charAt(index1));
        setIndex1(index1 + 1);
      }, 30);
      return () => clearTimeout(timeout);
    } else if (!firstDone) {
      setFirstDone(true);
      setShowSecondText(true);
    }
  }, [index1]);

  useEffect(() => {
    if (showSecondText && index2 < fullText2.length) {
      const timeout = setTimeout(() => {
        setDisplayedText2((prev) => prev + fullText2.charAt(index2));
        setIndex2(index2 + 1);
      }, 30);
      return () => clearTimeout(timeout);
    } else if (index2 === fullText2.length && !showInput) {
      setShowInput(true);
    }
  }, [showSecondText, index2]);

  const handleUserName = (text) => {
    setUserName(text);
  };

  const SaveUserNameInDB = async (UserName) => {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      console.log('No user is logged in');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { name: UserName });
      router.replace('./');
      console.log('User name successfully updated!');
    } catch (error) {
      console.error('Error updating user name:', error);
    }
  };

  /** ---------- Helpers: strict DD MM YYYY age ---------- */
  function daysInMonthUTC(year, month /* 1-12 */) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function calculateAgeDDMMYYYY(birthdayParam) {
    if (!birthdayParam) return null;

    const raw = Array.isArray(birthdayParam) ? String(birthdayParam[0] ?? '') : String(birthdayParam);
    const cleaned = raw.trim().replace(/[^\d]+$/, '');
    const parts = cleaned.split(/[.\-\/\s]+/).filter(Boolean);
    if (parts.length !== 3) return null;

    const [ddStr, mmStr, yyyyStr] = parts;
    const day = Number(ddStr);
    const month = Number(mmStr);
    const year = Number(yyyyStr);

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
    if (year < 1000 || month < 1 || month > 12) return null;

    const maxDay = daysInMonthUTC(year, month);
    if (day < 1 || day > maxDay) return null;

    const birthUTC = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(birthUTC.getTime())) return null;

    const now = new Date();
    let age = now.getUTCFullYear() - birthUTC.getUTCFullYear();

    const hadBirthdayThisYear =
      now.getUTCMonth() > birthUTC.getUTCMonth() ||
      (now.getUTCMonth() === birthUTC.getUTCMonth() && now.getUTCDate() >= birthUTC.getUTCDate());

    if (!hadBirthdayThisYear) age--;

    return age;
  }

  const age = useMemo(() => calculateAgeDDMMYYYY(Birthday), [Birthday]);

  /** --------------------------- Confetti --------------------------- */
  const creatingRef = useRef(false);
  const confettiRef = useRef(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Start when focused, stop and unmount as soon as we blur (navigate away)
  useEffect(() => {
    if (isFocused) {
      setShowConfetti(true);
      // next frame (avoids starting during layout)
      requestAnimationFrame(() => confettiRef.current?.startConfetti());
    } else {
      // stop immediately on blur, then unmount
      confettiRef.current?.stopConfetti();
      setShowConfetti(false);
    }
  }, [isFocused]);

  /** ---------------------- Firestore upsert ----------------------- */
  async function upsertUserDoc({ uid, email, userName, birthday }) {
    const db = getFirestore();
    await setDoc(
      doc(db, 'users', uid),
      {
        uid: uid,
        email: email ?? null,
        UserName: userName ?? null,
        Birthday: birthday ?? null,
        Phonenumber: Phonenumber ?? null,
        onboardingCompleted: false,
        SignUp_Method: method,
        SleepMode: false,
        isPremium: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /** -------------------------- CreateUser ------------------------- */
  async function CreateUser() {
    if (creatingRef.current) return;
    creatingRef.current = true;

    const auth = getAuth();
    try {
      let user = auth.currentUser;

      if (method === 'email') {
        const existing = await fetchSignInMethodsForEmail(auth, Email);
        if (existing?.length > 0) throw new Error('Diese E-Mail wird bereits verwendet.');
        const cred = await createUserWithEmailAndPassword(auth, Email, Password);
        user = cred.user;
        if (UserName) await updateProfile(user, { displayName: UserName });
        await upsertUserDoc({ uid: user.uid, email: user.email, userName: UserName, birthday: Birthday });
      } else if (method === 'google' || method === 'apple') {
        if (!user) throw new Error('Kein eingeloggter OAuth-Nutzer gefunden.');
        if (Email && Password) {
          const methods = await fetchSignInMethodsForEmail(auth, Email);
          if (methods.includes('password')) throw new Error('Diese E-Mail hat bereits ein Passwort-Login.');
          const emailCred = EmailAuthProvider.credential(Email, Password);
          await linkWithCredential(user, emailCred);
        }
        if (UserName) await updateProfile(user, { displayName: UserName });
        await upsertUserDoc({ uid: user.uid, email: Email ?? user.email, userName: UserName, birthday: Birthday });
      } else {
        throw new Error('Unbekannte Signup-Methode.');
      }

      // Stop + unmount confetti BEFORE navigating
      confettiRef.current?.stopConfetti();
      setShowConfetti(false);

      // Open your follow-up and navigate
    
      router.replace('/(tabs)');
    } catch (err) {
      console.error('❌ Fehler beim Erstellen:', err);
      Alert.alert('Fehler', err?.message ?? String(err));
    } finally {
      creatingRef.current = false;
    }
  }

  /** ----------------------------- UI ------------------------------ */
  return (
    <>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Confetti overlay while focused */}
      

        {/* Content */}
        <View
          style={{
            flex: 1,
            zIndex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              fontSize: 48,
              fontFamily: 'Righteous-Regular',
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.08)',
              textShadowRadius: 4,
            }}
          >
            Welcome
          </Text>

          <Text style={{ marginTop: 12, fontSize: 18, lineHeight: 26, textAlign: 'center', maxWidth: '80%' }}>
            You’re all set. Tap <Text style={{ fontWeight: '600' }}>Done</Text> to go to your profile.
          </Text>

          <TouchableOpacity
            onPress={CreateUser}
            style={{
              paddingVertical: 20,
              paddingHorizontal: 40,
              bottom: height(8),
              justifyContent: 'center',
              alignItems: 'center',
              position: 'absolute',
              width: '90%',
              marginLeft: width(5),
              flexDirection: 'row',
              borderRadius: 10,
              backgroundColor: '#000',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.14,
              shadowRadius: 8.27,
              elevation: 10,
            }}
          >
            <Text
              style={{
                fontFamily: 'Righteous-Regular',
                fontSize: size(18),
                color: '#fff',
              }}
            >
              Done
            </Text>

            <ArrowRight
              color={'#fff'}
              size={size(22)}
              style={{
                position: 'absolute',
                right: width(10),
              }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
