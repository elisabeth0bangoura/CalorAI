// WeightTimelineByDay.js  (AutoAdjustMacros sheet)
import { useSheets } from "@/app/Context/SheetsContext";
import { Mail, MapPin, MoveLeft } from "lucide-react-native";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => (typeof lb === "number" ? lb * KG_PER_LB : undefined);
const kgToLb = (kg) => (typeof kg === "number" ? kg / KG_PER_LB : undefined);

const ROW_MIN_HEIGHT = 10;
const RAIL_W = 0;
const LINE = "#E5E7EB";
const DOT = "#111";

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHeader(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Termms_Conditions() {
 
    
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
    <>
      <ScrollView style={{ 
        width: "100%", 
        height:  height(100)
        

     }} contentContainerStyle={{
        paddingBottom: height(50)
     }}>

    <View style={{
        width: "90%",
        alignSelf: 'center',
    }}>


        <Text
          style={{
            fontSize: size(25),
            fontWeight: "800",
            lineHeight: height(3.8),
            marginTop: height(5),
          }}
        >
         Bantico – Licensed Application End User License Agreement (EULA)
        </Text>



         <Text
          style={{
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(5),
            fontWeight: "500"
          }}
        >
        <Text style={{fontWeight: "700"}}>IMPORTANT:</Text> By downloading, installing, or using Bantico 
        (the “Licensed Application”), you agree to be bound by the terms of 
        this End User License Agreement (“Agreement”). If you do not agree, 
        do not use Bantico.
        </Text>





          <View
          style={{
          
          }}
        >
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
            1. Scope of License
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
        Bantico grants you a limited, non-transferable, 
        non-exclusive license to use the Licensed Application on any 
        Apple-branded device you own or control, as permitted by the App Store 
        Usage Rules. You may not copy, modify, reverse-engineer, 
        distribute, or sublicense the Licensed Application except as permitted by law.
        </Text>
        </View>



















       <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
          2. Health Disclaimer
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
       Bantico is a nutrition and health tracking app intended <Text style={{
            fontWeight: "700",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
      for informational and educational purposes only.
        </Text>
        </Text>

          <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
       	• Bantico does <Text style={{ fontWeight: "700",}}>not provide</Text> medical advice.
        </Text>


     <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
    <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>

    <Text
        style={{
        flex: 1,
        marginLeft: 8,
        fontSize: size(15),
        lineHeight: height(3.8),
        fontWeight: '500',
        }}
    >
        Bantico does <Text style={{ fontWeight: '700' }}>not diagnose, treat, cure, or prevent any disease.</Text>
    </Text>
    </View>





<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
    Always consult a qualified healthcare professional before making decisions related to diet,
    exercise, or medical conditions. Your reliance on any information provided within Bantico is
    <Text style={{ fontWeight: '700' }}> at your own risk.</Text>
  </Text>
</View>
    
        </View>





       <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
         3. Consent to Use of Data
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
     You agree that Bantico may collect and process anonymized 
     technical and usage data for the purpose of improving services and providing updates. 
     Personal data is handled in accordance with our [Privacy Policy].
    </Text>

    
        </View>











       <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
        4. External Services
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
    Bantico may integrate third-party services (e.g., food databases, 
    AI-based suggestions). You agree to use these services at your sole risk. 
    Bantico is not responsible for third-party content, accuracy, or availability.
    </Text>

    
        </View>




















       <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
       5. Termination
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
  This Agreement is effective until terminated by you or Bantico. 
  Your rights will terminate automatically if you fail to comply with any of its terms. 
  Upon termination, you must stop using the Licensed Application.
    </Text>

    
        </View>













       <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
       6. NO WARRANTY
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
The Licensed Application is provided “AS IS” and “AS AVAILABLE” without warranties of any kind.
 Bantico disclaims all warranties, including but not limited to fitness for a particular purpose, 
 accuracy, or non-infringement. Bantico does not guarantee that the app will meet your health 
 goals or provide error-free results.

    </Text>

    
        </View>













     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
      7. Limitation of Liability
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
        To the maximum extent permitted by law, Bantico and its affiliates shall 
        not be liable for any damages, including indirect, incidental, or consequential 
        damages, arising from your use of the Licensed Application. In no event shall Bantico’s 
        liability exceed fifty dollars ($50).

    </Text>

    
        </View>
   























     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
    8. Export Restrictions
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
       You may not export or re-export Bantico except as authorized by U.S. and international law.

    </Text>

    
        </View>
   



















     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
  9. Governing Law
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
      If you are a U.S. resident, this Agreement is governed by the laws of California. 
      If you reside in the EU, Switzerland, Norway, or Iceland, the governing law and 
      forum shall be the laws and courts of your usual place of residence.

    </Text>

    
        </View>
   

















     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
            marginBottom: height(2)
        }}>
 10. Contact
        </Text>
        


  <View style={{ flexDirection: "row", marginBottom: height(2) }}>
    <MapPin size={18} color="black" style={{ marginRight: 6 }} />
    <Text style={{ fontSize: 15 }}>Bantico Ltd –{"\n"}20 Wenlock Road {"\n"}
    London
    {"\n"}N1 7GU
    England
    </Text>
  </View>

  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
    <Mail size={18} color="black" style={{ marginRight: 6 }} />
    <Text style={{ fontSize: 15 }}>support@bantico.com</Text>
  </View>
</View>

    
        </View>
   
  






















   
   
          </ScrollView>



             <TouchableOpacity
        onPress={() => {
          // keep sheet id consistent with this screen name
          dismiss("Termms_Conditions");
        }}
        hitSlop={8}
        style={{
          top: height(78),
          zIndex: 100,
          paddingVertical: 14,
          flexDirection: "row",
          width: size(125),
          left: width(5),
          height: size(50),
          paddingHorizontal: 20,
          alignItems: "center",
          position: "absolute",
          borderRadius: 15,
          backgroundColor: "#000",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 2, height: 1 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
            },
            android: { elevation: 4, shadowColor: "#ccc" },
          }),
        }}
      >
        <MoveLeft size={18} color="#fff" />
        <Text
          style={{
            color: "#fff",
            marginLeft: width(5),
            fontSize: size(14),
            fontWeight: "700",
          }}
        >
          Done
        </Text>
      </TouchableOpacity>

    </>
  );
}