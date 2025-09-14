import { useSheets } from "@/app/Context/SheetsContext";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";



import { getAuth } from '@react-native-firebase/auth';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';





export default function PersonalDetails() {
  const [userData, setUserData] = useState(null);


  const {
    register, present, dismiss, dismissAll,
    isS2Open, setIsS2Open,
    isS3Open, setIsS3Open,
    isS4Open, setIsS4Open,
    isS5Open, setIsS5Open,
    isS6Open, setIsS6Open,
    isS7Open, setIsS7Open,
    isS8Open, setIsS8Open,
    isS9Open, setIsS9Open,
   isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
   isTargetWeightOpen, setIsTargetWeightOpen,
  } = useSheets();






  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      const db = getFirestore();
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists) setUserData(snap.data());
 
    })();
  }, []);












 
  
  return (
   
   <View style={{
    height: "100%",
    width: "100%",
    backgroundColor: "#fff",
   }}>


    <ScrollView style={{
        height: "100%",
         backgroundColor: "#fff",
        width: "100%"
    }} contentContainerStyle={{
        paddingBottom: height(20)
    }}> 
    <Text style={{
        marginTop: height(5),
        fontSize: size(25),
        color: "#000",
        marginLeft: width(5),
        fontWeight: "800",
        
    }}>
       Personal Details
    </Text>










    <TouchableOpacity onPress={() => {
         present("TargetWeight")
    }}
    style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(5),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
            fontSize: size(15),
             fontWeight: "700"
        }}>
            Target weight
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
            {
            userData?.weightUnit == "kg"
            ?
            userData?.goalWeightKg + userData?.goalWeightUnit
            :
             userData?.goalWeightLb + "LB"
            }
            
        </Text>
</View>


        <View style={{
            position: 'absolute',
            paddingHorizontal: 20,
       
            right: width(0)
        }}>
            <Text style={{
                color: '#000',
                fontWeight: "700"
            }}>
             Change the goal
            </Text>
        </View>

    </TouchableOpacity>














    <TouchableOpacity onPress={() => {
        present("CurrentWeight")
    }}
    style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(2),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
             fontSize: size(15),
             fontWeight: "700"
        }}>
           Current weight
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
             {userData?.kg} {userData?.weightUnit}
         
        </Text>
</View>


        <View style={{
            position: 'absolute',
            right: width(2)
        }}>
            <ChevronRight size={25} color={"#ACB6BE"} />
        </View>

    </TouchableOpacity>



















    <TouchableOpacity onPress={() => {
        present("HeightComponent")
    }}
    style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(2),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
            fontSize: size(15),
             fontWeight: "700"
        }}>
          Height
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
           {userData?.cm} cm
        </Text>
</View>


        <View style={{
            position: 'absolute',
            right: width(2)
        }}>
            <ChevronRight size={25} color={"#ACB6BE"} />
        </View>

    </TouchableOpacity>
















    <View onPress={() => {
        present("BirthDay")
    }}
    style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(2),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
            fontSize: size(15),
             fontWeight: "700"
        }}>
          Birth date
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
           {userData?.day + "." + userData?.month + "." + userData?.year}  
        </Text>
</View>



    </View>



















<View style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(2),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
            fontSize: size(15),
             fontWeight: "700"
        }}>
          Gender
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
            {userData?.gender} 
        </Text>
</View>



    </View>



















<TouchableOpacity onPress={() => {
 present("DailyStepsComponent")
 }}
style={{
        flexDirection: "row",
        width: "90%",
        marginTop: height(2),
        alignSelf: 'center',

    }}>

        <View> 

        <Text style={{
            marginBottom: height(1),
            fontSize: size(15),
             fontWeight: "700"
        }}>
          Daily steps
        </Text>



         <Text style={{
            marginBottom: height(1),
            fontWeight: "bold",
            color: "#ACB6BE"
        }}>
           {userData?.steps == null ? "10,000" : userData?.steps} steps
        </Text>
        </View>


        <View style={{
            position: 'absolute',
            right: width(2)
        }}>
            <ChevronRight size={25} color={"#ACB6BE"} />
        </View>

    </TouchableOpacity>


</ScrollView>


   </View>
  );
}

