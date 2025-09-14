import { useSheets } from "@/app/Context/SheetsContext";
import { Image } from "expo-image";
import { Flame, Goal, Handshake, HatGlasses, History, LineChart, Mail, RefreshCcw, Trash2, UserRound } from "lucide-react-native";
import {
    LogBox,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import SignOutButton from "./SignOutButton";





export default function Profile() {

  LogBox.ignoreAllLogs(true);
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
        marginTop: height(15),
        fontSize: size(16),
        color: "#BCC1CA",
        marginLeft: width(5),
        fontWeight: "800",
        
    }}>
       Personal
    </Text>


     <Text style={{
        marginTop: height(1),
        fontSize: size(25),
        color: "#000",
        marginLeft: width(5),
        fontWeight: "800",
        
    }}>
      Elisabeth Bangoura
    </Text>







     <Text style={{
        marginTop: height(5),
        fontSize: size(16),
        color: "#BCC1CA",
        marginLeft: width(5),
        fontWeight: "800",
        
    }}>
       Profile
    </Text>



    <TouchableOpacity onPress={() => {
        present("PerosnalDetails")
    }}
    style={{
        width: "90%",
        flexDirection: 'row',
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>

        <UserRound size={18} />
        <Text style={{
            marginLeft: width(5),
            fontSize: size(15),
            fontWeight: "700"
        }}>
            Personal details
        </Text>
    </TouchableOpacity>








    <TouchableOpacity onPress={() => {
        present("EditNutritionGoals")
    }}
    style={{
        width: "90%",
        flexDirection: 'row',
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>

        <Goal size={18} />
        <Text style={{
            marginLeft: width(5),
            fontSize: size(15),
            fontWeight: "700"
        }}>
          Edit your habit and nutrition goals
        </Text>
    </TouchableOpacity>




     <TouchableOpacity 
     style={{
        width: "90%",
        flexDirection: 'row',
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>

        <LineChart size={18} />
        <Text style={{
            marginLeft: width(5),
            fontSize: size(15),
            fontWeight: "700"
        }}>
         Habits & weight history
        </Text>
    </TouchableOpacity>
















         <Text style={{
        marginTop: height(5),
        fontSize: size(16),
        color: "#BCC1CA",
        marginLeft: width(5),
        fontWeight: "800",
        
    }}>
       Preferences
    </Text>



    <TouchableOpacity style={{
        width: "90%",
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>
        <View style={{
            flexDirection: 'row',
        }}> 
        <Flame size={18} />
        <Text style={{
            marginLeft: width(5),
            marginBottom: height(1),
            fontSize: size(15),
            fontWeight: "700"
        }}>
          Add burned calories
        </Text>
        </View>

          <Text style={{
            marginLeft: width(10),
            fontSize: size(14),
            fontWeight: "700",
            color: "#BCC1CA",
        }}>
         Add burned calories back to daily goal
        </Text>
    </TouchableOpacity>










    <TouchableOpacity style={{
        width: "90%",
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>
        <View style={{
            flexDirection: 'row',
        }}> 
        <History size={18} />
        <Text style={{
            marginLeft: width(5),
            marginBottom: height(1),
            fontSize: size(15),
            fontWeight: "700"
        }}>
          Rollover calories
        </Text>
        </View>

          <Text style={{
            marginLeft: width(10),
            fontSize: size(14),
            fontWeight: "700",
            color: "#BCC1CA",
        }}>
        Add up to 200 left over calories from yesterday into today's daily goal
        </Text>
    </TouchableOpacity>
















    <TouchableOpacity style={{
        width: "90%",
        marginLeft: width(5),
        paddingVertical: 12,
        marginTop: height(2),

    }}>
        <View style={{
            flexDirection: 'row',
        }}> 
        <RefreshCcw size={18} />
        <Text style={{
            marginLeft: width(5),
            marginBottom: height(1),
            fontSize: size(15),
            fontWeight: "700"
        }}>
         Auto adjust macros
        </Text>
        </View>

          <Text style={{
            marginLeft: width(10),
            fontSize: size(14),
            fontWeight: "700",
            color: "#BCC1CA",
        }}>
       When editing calories or macronutrients, automatically adjust the other values proportionally
        </Text>
    </TouchableOpacity>














 <Text style={{
 marginTop: height(5),
 fontSize: size(25),
 color: "#000",
 marginLeft: width(5),
 fontWeight: "800",
        
 }}>
 More
</Text>




<ScrollView horizontal  showsHorizontalScrollIndicator={false}
style={{
    height: "auto",
    paddingVertical: 12,
    marginTop: height(2),
    width: "90%",
  //  backgroundColor: "yellow",
    alignSelf: 'center'
}}>


<TouchableOpacity style={{
    backgroundColor: "#F1F3F9",
    height: size(170),
    width: size(160),
    marginRight: width(5),
    
    borderRadius: 15
}}>

<Handshake size={25} color={"#691AF5"}
style={{
    marginLeft: width(5),
    marginTop: height(4)
}} />
<Text style={{
    fontWeight: "800",
    fontSize: size(14),
    lineHeight: height(2.5),
    position: 'absolute',
    bottom: height(5),
    marginLeft: width(5),
    width: "90%",
    color: "#000"
}}>
    Terms and Conditions
</Text>
</TouchableOpacity>





<TouchableOpacity style={{
    backgroundColor: "#F1F3F9",
    height: size(170),
    width: size(160),
    marginRight: width(5),
    borderRadius: 15
}}>


<HatGlasses size={25} color={"#000"}
style={{
    marginLeft: width(5),
    marginTop: height(4)
}} />
<Text style={{
    fontWeight: "800",
    fontSize: size(14),
    lineHeight: height(2.5),
    position: 'absolute',
    bottom: height(5),
    marginLeft: width(5),
    width: "90%",
    color: "#000"
}}>
  Privacy Policy
</Text>

</TouchableOpacity>







<TouchableOpacity style={{
    backgroundColor: "#F1F3F9",
    height: size(170),
    width: size(160),
    marginRight: width(5),
    borderRadius: 15
}}>

<Mail size={25} color={"#000"}
style={{
    marginLeft: width(5),
    marginTop: height(4)
}} />
<Text style={{
    fontWeight: "800",
    fontSize: size(14),
    lineHeight: height(2.5),
    position: 'absolute',
    bottom: height(5),
    marginLeft: width(5),
    width: "90%",
    color: "#000"
}}>
  Email Support
</Text>
</TouchableOpacity>





















<TouchableOpacity style={{
    backgroundColor: "#F1F3F9",
    height: size(170),
    width: size(160),
    marginRight: width(5),
    borderRadius: 15
}}>

<Trash2 size={25} color={"#000"}
style={{
    marginLeft: width(5),
    marginTop: height(4)
}} />
<Text style={{
    fontWeight: "800",
    fontSize: size(14),
    lineHeight: height(2.5),
    position: 'absolute',
    bottom: height(5),
    marginLeft: width(5),
    width: "90%",
    color: "#000"
}}>
 Delete Account
</Text>
</TouchableOpacity>

</ScrollView>










<SignOutButton />











<View style={{

    marginTop: height(7),
    alignItems: 'center',
    alignSelf: 'center',
   
}}> 
        <View style={{
            height: size(30),
            width: size(30),
        }}> 
        <Image source={require("../../../assets/App_Logo_grey_Color.png")}
        style={{
            height: "100%",
            width: "100%"
        }} contentFit="contain" />
</View>
        <Text style={{
             fontWeight: "700",
             fontSize: size(13),
             marginTop: height(1),
             color: "#A3A3A3"
        }}>
           Version 1.0.0
        </Text>
</View>






</ScrollView>


   </View>
  );
}

