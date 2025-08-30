import { Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

export default function HaveYouUsedAnyOther() {
  const {
    HaveYouUsedAnyOtherPlatform,
    setHaveYouUsedAnyOtherPlatform,
  } = useOnboarding(); // uses onboarding context

  // store as "yes" | "no" (change to true/false if you prefer)
  const isYes = HaveYouUsedAnyOtherPlatform === "yes";
  const isNo  = HaveYouUsedAnyOtherPlatform === "no";

  return (
    <>
      <View
        style={{
          height: "100%",
          width: "100%",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        {/* YES */}
        <TouchableOpacity
          onPress={() => setHaveYouUsedAnyOtherPlatform("yes")}
          activeOpacity={0.9}
          style={{
            height: size(70),
            width: "90%",
            borderRadius: 15,
            marginTop: height(10),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: height(2),
            alignSelf: "center",
            backgroundColor: isYes ? "#151515" : "#F1F3F9", // 🔥 selected state
          }}
        >
         
          <Text
            style={{
              marginLeft: width(3),
              color: isYes ? "#fff" : "#000",
              fontWeight: "700",
              fontSize: size(16),
            }}
          >
            Yes
          </Text>
        </TouchableOpacity>

        {/* NO */}
        <TouchableOpacity
          onPress={() => setHaveYouUsedAnyOtherPlatform("no")}
          activeOpacity={0.9}
          style={{
            height: size(70),
            width: "90%",
            borderRadius: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: height(2),
            alignSelf: "center",
            backgroundColor: isNo ? "#151515" : "#F1F3F9", // 🔥 selected state
          }}
        >
        
          <Text
            style={{
              marginLeft: width(3),
              color: isNo ? "#fff" : "#000",
              fontWeight: "700",
              fontSize: size(16),
            }}
          >
            No
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
