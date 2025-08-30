// DesiredWeight.js
import { Text, View } from "react-native";
import { height, size } from "react-native-responsive-sizes";





export default function DesiredWeightPart2() {
 
  

  return (
    <View style={{ height: "100%", justifyContent: 'center', alignContent: 'center', width: "100%", backgroundColor: "#fff" }}>
    


        <Text style={{ fontSize: size(30), textAlign: 'center', alignSelf: 'center', width: "90%", fontWeight: "700" }}>
         <Text style={{color: "#0057FF"}}>8 kg</Text> is achievable with steady habits.
        </Text>
        <Text
          style={{
            fontSize: size(14),
            marginTop: height(2),
            alignSelf: 'center',
            textAlign: 'center',
            width: "85%", 
            fontWeight: "700",
            color: "#999",
          }}
        >
         We’ll chart a steady plan so progress lasts.
        </Text>

      

    </View>
  );
}
