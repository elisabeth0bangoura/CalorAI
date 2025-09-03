
// ProgressLine.js

import { Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";









export default function HowMuchDoYouSmoke() {

 

const {
 workouts, 
 setWorkouts
} = useOnboarding()





  return (
  <>


   <AppBlurHeader />


    <View style={{
      width: "90%",
      alignSelf: 'center',
       marginTop: height(2),
      flexDirection: 'row',
      justifyContent: "space-between", // pushes them apart
    }}> 
     <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Just getting started");
                  setWorkouts("Just getting started");
                }}
                style={{
                  height: size(70),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "48%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: workouts  == "Just getting started" ? "#151515" : "#F1F3F9",
                }}
              >
                <View>
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "800",
                    color: workouts == "Just getting started" ? "#fff" : "#000",
                  }}
                >
                0-2
                </Text>


                 <Text
                  style={{
                    fontSize: size(12),
                    marginTop: height(0.5),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: workouts == "Just getting started" ? "#fff" : "#BCC1CA",
                  }}
                >
                Just getting started
                </Text>
                 </View>
              </TouchableOpacity>
  
   <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Keeping a steady pace");
                  setWorkouts("Keeping a steady pace");
                }}
                style={{
                  height: size(70),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "48%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: workouts  == "Keeping a steady pace" ? "#151515" : "#F1F3F9",
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "800",
                    color: workouts == "Keeping a steady pace" ? "#fff" : "#000",
                  }}
                >
                3-4
                </Text>


                 <Text
                  style={{
                    fontSize: size(12),
                    marginTop: height(0.5),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: workouts == "Keeping a steady pace" ? "#fff" : "#BCC1CA",
                  }}
                >
                Keeping a steady pace
                </Text>
              </TouchableOpacity>

</View>



  <View style={{
      width: "90%",
      alignSelf: 'center',
      marginTop: height(2),
      flexDirection: 'row',
      justifyContent: "space-between", // pushes them apart
    }}> 

                <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Almost every day");
                  setWorkouts("Almost every day");
                }}
                style={{
                  height: size(70),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "48%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: workouts == "Almost every day" ? "#151515" : "#F1F3F9",
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "800",
                    color: workouts == "Almost every day" ? "#fff" : "#000",
                  }}
                >
                5–6
                </Text>

                  <Text
                  style={{
                    fontSize: size(12),
                    marginTop: height(0.5),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: workouts == "Almost every day" ? "#fff" : "#BCC1CA",
                  }}
                >
                Almost every day
                </Text>
              </TouchableOpacity>






                <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "No days off");
                  setWorkouts("No days off");
                }}
                style={{
                  height: size(70),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "48%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: workouts == "No days off" ? "#151515" : "#F1F3F9",
                }}
              >

                 <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "800",
                    color: workouts == "No days off" ? "#fff" : "#000",
                  }}
                >
                7
                </Text>
                 <Text
                  style={{
                    fontSize: size(12),
                    marginTop: height(0.5),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: workouts == "No days off" ? "#fff" : "#BCC1CA",
                  }}
                >
                No days off
                </Text>
              </TouchableOpacity>

              </View>
  
  </>
  );
}


