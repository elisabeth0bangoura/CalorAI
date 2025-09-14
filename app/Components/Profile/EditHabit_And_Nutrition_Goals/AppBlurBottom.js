import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  View
} from "react-native";
import { easeGradient } from "react-native-easing-gradient";
import { height } from "react-native-responsive-sizes";

export default function AppBlurBottom() {

  // Gradient for the mask (transparent -> opaque)
  const { colors, locations } = easeGradient({
    colorStops: {
      0: { color: "transparent" },
      0.5: { color: "rgba(0,0,0,0.99)" },
      1: { color: "black" },
    },
  });

  return (
   
   
      <View
        pointerEvents="none"
        style={{ 
          position: "absolute",
          bottom: 0,
          width: "100%", 
          height: height(35)
  }}
      >
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
           <LinearGradient
            colors={colors}
            locations={locations}
            style={[StyleSheet.absoluteFill]}
          />

          }
        >
          <BlurView 
            intensity={90}
            tint={"light"}
            style={StyleSheet.absoluteFill}
          >
         
          </BlurView>
        </MaskedView>
      </View>

  );
}

