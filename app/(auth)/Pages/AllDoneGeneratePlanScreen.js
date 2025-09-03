import { Image, Platform, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useSteps } from "../../Context/StepsContext";

export default function AllDoneGeneratePlanScreen({
  subLabel="Setup complete!",
  title="Let’s build your personalized journey ",
  progressPct = 88,
  handImage = null,
}) {
  const { prev, next } = useSteps();

  const cardShadow = Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8, shadowColor: "#00000044" },
  });

  const RING_SIZE = width(70);
  const RING_STROKE = 14;
  const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Top bar with back & progress */}
     
     
      {/* Gradient ring */}
      <View style={{ marginTop: height(14), alignItems: "center" }}>
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
         

          {/* center icon / image */}
          <View
            style={{
             height: height(25),
              width: height(25),
              alignSelf: 'center',
              borderRadius: height(25)/2,
              alignItems: "center", justifyContent: "center",
            
            }}
          >
        
        <Image source={require("../../../assets/cauldron.gif")} style={{ width: "100%", height:  "100%", resizeMode: "contain" }} />
         
          </View>
        </View>
      </View>

      {/* Text block */}
      <View style={{ alignItems: "center", marginTop: height(0) }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Safe check icon (unicode) to avoid undefined lucide icon */}
          <Text style={{ fontSize: size(14), marginRight: 8 }}>✔️</Text>
          <Text style={{ fontWeight: "800", color: "#1D1E22", fontSize: size(14) }}>{subLabel}</Text>
        </View>

        <Text
          style={{
            marginTop: height(1.5),
            fontSize: 30,
            lineHeight: 36,
            fontWeight: "900",
            color: "#1D1E22",
            textAlign: "center",
            paddingHorizontal: width(8),
          }}
        >
          {title}
        </Text>
      </View>

    
    
    </View>
  );
}
