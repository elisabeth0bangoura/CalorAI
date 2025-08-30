import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';


export default function ConfirmAge() {
  // Übergabeparameter vom vorherigen Screen
  const { Email, Password, Birthday, Phonenumber, UserName, method } = useLocalSearchParams();
  const router = useRouter();
  const animation = useRef(null);

  // Alter berechnen
  function daysInMonthUTC(year, month /* 1-12 */) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  function calculateAgeDDMMYYYY(birthdayParam) {
    if (!birthdayParam) return null;
    const raw = Array.isArray(birthdayParam) ? String(birthdayParam[0] ?? '') : String(birthdayParam);
    const parts = raw.split(/[.\-\/\s]+/).filter(Boolean);
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

  // Hilfsfunktion für Firestore Profil
 /*async function upsertUserDoc({ uid, email, userName, birthday }) {
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
        SleepMode: false,
        isPremium: false,
        RewardPoints: 0,
        ValidationScore: 10,
        validationCooldownUntil: null,
        validationWeekStart: Timestamp.now(),
        validationWeekResetsOn: Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function CreateUser() {
    const auth = getAuth();

    try {
      let user = auth.currentUser;

      // --- if/else für Signup-Wege ---
      if (method === 'email') {
        // Klassischer Signup mit Email + Passwort
        const existing = await fetchSignInMethodsForEmail(auth, Email);
        if (existing?.length > 0) {
          throw new Error('Diese E-Mail wird bereits verwendet.');
        }
        const cred = await createUserWithEmailAndPassword(auth, Email, Password);
        user = cred.user;
        if (UserName) await updateProfile(user, { displayName: UserName });
        await upsertUserDoc({ uid: user.uid, email: user.email, userName: UserName, birthday: Birthday });
      } 
      else if (method === 'google' || method === 'apple') {
        // User kommt von OAuth → ist schon eingeloggt
        if (!user) throw new Error('Kein eingeloggter OAuth-Nutzer gefunden.');

        // Optional: Email+Password als Loginweg hinzufügen
        if (Email && Password) {
          const methods = await fetchSignInMethodsForEmail(auth, Email);
          if (methods.includes('password')) {
            throw new Error('Diese E-Mail hat bereits ein Passwort-Login.');
          }
          const emailCred = EmailAuthProvider.credential(Email, Password);
          await linkWithCredential(user, emailCred);
        }
        if (UserName) await updateProfile(user, { displayName: UserName });
        await upsertUserDoc({ uid: user.uid, email: Email ?? user.email, userName: UserName, birthday: Birthday });
      } 
      else {
        throw new Error('Unbekannte Signup-Methode.');
      }

      console.log('✅ Nutzer erfolgreich erstellt / vervollständigt.');
      router.replace('/(auth)/signUp5');
    } catch (err) {
      console.error('❌ Fehler beim Erstellen:', err);
      Alert.alert('Fehler', err.message);
    }
  }
*/
  return (
    <>
      <View style={{ backgroundColor: '#fff', height: '100%', width: '100%', position: 'absolute' }}>
        <TouchableOpacity
          onPress={() => {}}
          style={{
            paddingVertical: 20,
            paddingHorizontal: 40,
            position: 'absolute',
            bottom: height(8),
            alignItems: 'center',
            right: width(5),
            flexDirection: 'row',
            borderRadius: 10,
            backgroundColor: '#222',
          }}
        >
          <Text style={{ fontSize: size(16), fontFamily: 'PlayfairDisplay-Bold', color: '#fff' }}>Done</Text>
          <ArrowRight color={'#fff'} size={size(22)} style={{ marginLeft: width(2) }} />
        </TouchableOpacity>
      </View>

      <BlurView intensity={40} tint="light" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 }}>
        <View
          style={{
            height: height(35),
            width: width(80),
            backgroundColor: '#fff',
            borderRadius: 10,
            zIndex: 10,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10 },
              android: { elevation: 6, shadowColor: '#00000050' },
            }),
          }}
        >
          <View style={{ padding: 30 }}>
            <Text style={{ fontSize: size(30), fontFamily: 'Righteous-Regular' }}>
              {age != null ? `You're ${age}` : 'Age unavailable'}
            </Text>
            <Text style={{ marginTop: height(2), fontSize: size(14), fontFamily: 'Open-Sans-SemiBold', marginBottom: height(2) }}>
              Born {Birthday}
            </Text>
            <Text style={{ fontSize: size(14), fontFamily: 'Open-Sans' }}>
              Confirm your age is correct. Let's keep our community authentic.
            </Text>
          </View>

          <View
            style={{
              width: '100%',
              bottom: 0,
              position: 'absolute',
              height: height(8),
              borderTopColor: '#F1F3F7',
              borderTopWidth: 1,
              alignItems: 'center',
              flexDirection: 'row',
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ height: size(50), width: '48%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: size(15), fontFamily: 'Righteous-Regular' }}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
           
                 router.push({
                  pathname: "/(auth)/signUp5",
                  params: { 
                    Email: Email || NewEmail, 
                    Phonenumber: Phonenumber,
                    method:method, 
                    Password: Password,
                    UserName:UserName,
                    Birthday: Birthday,
                  },
                }); 
              }}
              style={{ height: size(50), width: '48%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: size(15), fontFamily: 'Righteous-Regular' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </>
  );
}


