import { Platform, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";
import { useSteps } from "../../Context/StepsContext";

export default function RequestNotificationsScreen({
  title = "Stay on track with notifications",
  message = "Bantico would like to send you Notifications",
  onAllow,
  onDeny,
}) {
  const { prev, next } = useSteps();

  const {
    RequestNotificationsState, setRequestNotifications
  } = useOnboarding()

  const cardShadow = Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0.9 },
    },
    android: {
      elevation: 5,
      shadowColor: "#00000055",
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Top bar */}
      

      {/* Title */}
      <View style={{ marginTop: height(14), paddingHorizontal: width(5) }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            textAlign: "center",
            color: "#141518",
          }}
        >
          {title}
        </Text>
      </View>

      {/* Fake iOS Notification Dialog */}
      <View style={{
         ...cardShadow,
       
       //  overflow:'hidden',
      }}> 
      <View
        style={{
          marginTop: height(5),
          marginHorizontal: width(8),
          backgroundColor: "#fff",
          borderRadius: 18,
            height: height(28),
         
     
        }}
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              fontSize: size(17),
              fontWeight: "600",
              textAlign: "center",
              color: "#141518",
            }}
          >
            {message}
          </Text>
        </View>




        <TouchableOpacity onPress={() => {
         setRequestNotifications(false), next()
         }}
        style={{
          width: "90%",
          paddingVertical: size(12),
          alignSelf: 'center',
          paddingHorizontal:size(20),
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#F7F6FD",
          borderRadius: 8,
          bottom: height(10),
          position: 'absolute',
        }}>
          <Text style={{
            fontSize: size(16),
            alignSelf: 'center',
          }}>
            Don't Allow
          </Text>
        </TouchableOpacity>




         <TouchableOpacity onPress={() => {
          setRequestNotifications(true), next()
         }}
         style={{
          width: "90%",
          paddingVertical: size(12),
          alignSelf: 'center',
          paddingHorizontal:size(20),
           borderRadius: 8,
          bottom: height(3),
          position: 'absolute',
          backgroundColor: "#151515",
          borderWidth: 1,
          borderColor: "#F7F6FD",
        }}>
          <Text style={{
            color: "#fff",
            fontSize: size(16),
            alignSelf: 'center',
          }}>
            Allow
          </Text>
        </TouchableOpacity>
      
      
 </View>
 </View>
 

      {/* Pointer emoji */}
      <Text style={{ textAlign: "center", marginTop: height(3), fontSize: size(28) }}>
        👆
      </Text>
    </View>
  );
}
