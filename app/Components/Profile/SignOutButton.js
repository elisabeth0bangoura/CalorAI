import { getAuth, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { EyeClosed, } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';

export default function SignOutButton() {

    const router = useRouter()



  const handleSignOut = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return;

    const providers = (user.providerData || []).map(p => p.providerId);

    try {
      // If Google user, sign out from Google as well
      if (providers.includes('google.com')) {
        try {
          await GoogleSignin.signOut();
        } catch (e) {
          console.log('Google sign out error:', e);
        }
      }

      // For Apple ("apple.com") and Email ("password"), only Firebase signOut is needed
      await signOut(auth);
        router.replace("/(auth)/AuthHome")
      console.log('Signed out');
    } catch (error) {
      console.log('Error signing out:', error);
    }
  };

  return <TouchableOpacity onPress={() => {handleSignOut()}}
  style={{
        width: "90%",
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>
        <View style={{
            flexDirection: 'row',
        }}> 
        <EyeClosed size={18} color={"#FF1B1E"} />
        <Text style={{
            marginLeft: width(5),
            marginBottom: height(1),
            fontSize: size(15),
            color: "#FF1B1E",
            fontWeight: "700"
        }}>
         Logout
        </Text>
        </View>

        
    </TouchableOpacity>
;
}
