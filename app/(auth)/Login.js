import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { useRouter } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import 'moment/locale/de';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { height, size, width } from 'react-native-responsive-sizes';

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
  const animation = useRef(null);

  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");

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

  const handleEmail = (text) => setEmail(text);
  const handlePassword = (text) => setPassword(text);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, Email, Password);
      const uid = userCredential.user.uid;
      const lastUid = storage.getString('lastLoggedInUser');

      if (lastUid && lastUid !== uid) {
        storage.delete(`${lastUid}_cachedAccountImages`);
      }

      storage.set('lastLoggedInUser', uid);
      await preloadAccountImages(uid);

      router.replace("/(tabs)");
    } catch (error) {
      console.error('Login error:', error.message);
    }
  };

  return (
<>


        <StatusBar style="dark" />
    
    
    
    
    
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} style={{
        backgroundColor: "#FFCF2E",
        height: "100%", width: "100%"
      }}>
    
          <View style={{ height: "100%", width: "100%", backgroundColor: '#FFCF2E' }}>
            <KeyboardAvoidingView
              style={{ flex: 1, alignItems: 'center', backgroundColor: '#FFCF2E' }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
         
    


    <View style={{ height: "100%", width: "100%", backgroundColor: '#fff' }}>
     
     

      <Text style={{
        fontSize: size(28),
        marginTop: height(9),
        marginLeft: width(5),
        width: width(80),
        color: '#000',
        zIndex: 1000,
        fontFamily: "PlayfairDisplay-Bold",
      }}>
        Log In
      </Text>

      <View style={{ height: 70, width: "90%" }}>
        <Text style={{
          fontSize: size(16),
          marginTop: height(2),
          marginLeft: width(5),
          color: '#222',
          zIndex: 1000,
          fontFamily: "Open-Sans",
        }}>
          {displayedText}
        </Text>
      </View>

      <TextInput
        placeholder='E-Mail'
        keyboardType="email-address"
        onChangeText={handleEmail}
        style={{
          borderWidth: 1,
          borderColor: '#222',
          width: width(90),
          alignSelf: 'center',
          textAlign: 'center',
          marginTop: height(5),
          borderRadius: 10,
          height: height(6),
          fontSize: size(16),
          paddingHorizontal: width(5)
        }}
      />

      <TextInput
        placeholder='Password'
        onChangeText={handlePassword}
        secureTextEntry={false}
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
          paddingHorizontal: width(5)
        }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          paddingVertical: 20,
          paddingHorizontal: 40,
          bottom: height(8),
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
          right: width(5),
          marginLeft: width(5),
          flexDirection: 'row',
          borderRadius: 10,
          backgroundColor: '#222',
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.14,
          shadowRadius: 8.27,
          elevation: 10,
        }}
      >
        <Text style={{
          fontSize: size(16),
          fontFamily: "PlayfairDisplay-Bold",
          color: '#fff',
        }}>
          Next
        </Text>
        <ArrowRight color={"#fff"} size={size(22)} style={{ marginLeft: width(2) }} />
      </TouchableOpacity>
    </View>


    </KeyboardAvoidingView>
    </View>
    </TouchableWithoutFeedback>
    </>
  );
}
