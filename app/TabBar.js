// Tabbar.js
import { Scan } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { height, size } from "react-native-responsive-sizes";
import { useRevenueCat } from "./Context/RevenueCatContext";
import { useSheets } from "./Context/SheetsContext";

export default function Tabbar() {
  const { present } = useSheets();      // paywall is registered in _layout.tsx
  const { isPremium, loading, ClickedOnBtn, setClickedOnBtn,  } = useRevenueCat();



  return (
    <View
      style={{
        width: "85%",
        position: "absolute",
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        bottom: height(8),
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          present("s2")
         //setClickedOnBtn(true)
        }}
        disabled={loading}
        style={{
          height: size(70),
          width: size(70),
          alignSelf: "center",
          paddingHorizontal: 25,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 18,
          backgroundColor: "#151515",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4.65,
          elevation: 8,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Scan color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
