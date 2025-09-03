// DesiredWeight.js (HowFastReachingGoal)
import Slider from "@react-native-community/slider"; // npx expo install @react-native-community/slider
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

export default function HowFastReachingGoal({
  unit = "kg",
  min = 0.1,
  max = 1.5,
  step = 0.1,
  recommended = 0.8,
  initial = 1.0,
  onChange,
}) {

  const {
    HowFast, setHowFast
  } = useOnboarding()



  const fmt = (v) => `${Number(v).toFixed(1)} ${unit}`;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Title + sub */}
      <Text
        style={{
          fontSize: size(30),
          marginLeft: width(5),
          marginTop: height(14),
          width: "90%",
          fontWeight: "700",
        }}
      >
        How fast do you want{"\n"}to reach your goal?
      </Text>
      <Text
        style={{
          fontSize: size(15),
          color: "#8E9198",
          textAlign: "center",
          marginTop: height(5),
        }}
      >
        Loss weight speed per week
      </Text>

      {/* Current HowFast */}
      <Text
        style={{
          fontSize: size(44),
          fontWeight: "900",
          textAlign: "center",
          marginTop: height(1),
        }}
      >
        {fmt(HowFast)}
      </Text>

      {/* Emoji cues + slider */}
      <View style={{ width: "88%", alignSelf: "center", marginTop: height(4) }}>
        {/* emoji row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: height(1),
            paddingHorizontal: 0,
          }}
        >
         <View style={{
          width: size(50),
          height: size(50)
         }}>
          <Image source={require("../../../assets/images/stand.gif")}
          style={{
            height: "100%",
            width: "100%",
          }} />
         </View>
            <View style={{
          width: size(50),
          height: size(50)
         }}>
          <Image source={require("../../../assets/images/walk.gif")}
          style={{
            height: "100%",
            width: "100%",
          }} />
         </View>
         
          
           <View style={{
          width: size(50),
          height: size(50)
         }}>
          <Image source={require("../../../assets/images/run2.gif")}
          style={{
            height: "100%",
            width: "100%",
          }} />
         </View>
         

        </View>

        {/* slider with center tick */}
        <View style={{ position: "relative" }}>
          <Slider
            value={HowFast}
            onValueChange={(v) => {
              const n = Number(v.toFixed(1));
              setHowFast(n);
            }}
            onSlidingComplete={(v) => onChange?.(Number(v.toFixed(1)))}
            minimumValue={min}
            maximumValue={max}
            step={step}
            minimumTrackTintColor="#111"
            maximumTrackTintColor="#E6E7EB"
            thumbTintColor="#ffffff"
            style={{ width: "100%", height: 44 }}
          />
          {/* center tick */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: "50%",
              transform: [{ translateX: -1 }],
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: "#111",
            }}
          />
        </View>

        {/* scale labels */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: size(14), color: "#6A6F78" }}>{fmt(min)}</Text>
          <Text style={{ fontSize: size(14), color: "#6A6F78" }}>
            {fmt(recommended)}
          </Text>
          <Text style={{ fontSize: size(14), color: "#6A6F78" }}>{fmt(max)}</Text>
        </View>

        {/* Recommended pill */}
        <Pressable
          onPress={() => {
            setHowFast(recommended);
            onChange?.(recommended);
          }}
          style={{
            alignSelf: "center",
            marginTop: height(4),
            width: "92%",
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: "#F6F7FB",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: size(16), fontWeight: "700", color: "#111" }}>
            Recommended
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
