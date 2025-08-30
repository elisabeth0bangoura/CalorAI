
// ProgressLine.js

import { Text, TouchableOpacity } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

export default function GenderFlatlist() {

 

const {
gender, 
setGender,
} = useOnboarding()





  return (
  <>



     <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Female");
                  setGender("Female");
                }}
                style={{
                  height: size(60),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "90%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: gender  == "Female" ? "#151515" : "#F1F3F9",
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: gender == "Female" ? "#fff" : "#000",
                  }}
                >
                 Female
                </Text>
              </TouchableOpacity>
  
   <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Male");
                  setGender("Male");
                }}
                style={{
                  height: size(60),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "90%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: gender  == "Male" ? "#151515" : "#F1F3F9",
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: gender == "Male" ? "#fff" : "#000",
                  }}
                >
                 Male
                </Text>
              </TouchableOpacity>







                <TouchableOpacity
                onPress={() => {
                  console.log("Pressed:", "Other");
                  setGender("Other");
                }}
                style={{
                  height: size(60),
                  justifyContent: "center",
                  borderRadius: 10,
                  width: "90%",
                  alignSelf: "center",
                  top: height(5),
                  marginBottom: 12,
                  backgroundColor: gender == "Other" ? "#151515" : "#F1F3F9",
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    marginLeft: width(5),
                    fontWeight: "700",
                    color: gender == "Other" ? "#fff" : "#000",
                  }}
                >
                 Other
                </Text>
              </TouchableOpacity>
  
  </>
  );
}


