import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  View
} from "react-native";
import { easeGradient } from "react-native-easing-gradient";
import { height } from "react-native-responsive-sizes";

export default function AppBlurHeader2() {

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
          top: 0,
          zIndex: 2,  width: "100%", 
          height: height(11)
  }}
      >
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
           <LinearGradient
            colors={colors}
            locations={locations}
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: "180deg" }] }]}
          />

          }
        >
          <BlurView 
            intensity={80}
            tint={"light"}
            style={StyleSheet.absoluteFill}
          >
         
          </BlurView>
        </MaskedView>
      </View>

  );
}

