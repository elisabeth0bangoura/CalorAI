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

export default function Privacy_Policy() {
 
    
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

        Privacy Policy – Bantico Ltd
        </Text>



         <Text
          style={{
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(5),
            fontWeight: "500"
          }}
        >
        <Text style={{fontWeight: "700"}}>Effective Date:</Text> September 15, 2025
        </Text>

  <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
        Bantico Ltd (“Bantico,” “we,” “our,” or “us”) 
        respects your privacy and is committed to protecting your personal data. 
        This Privacy Policy explains how we collect, use, and safeguard your 
        information when you use our mobile application (“App”), available on the Apple App 
        Store and Google Play Store.
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
           1. Information We Collect
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
       When you use Bantico, we may collect the following types of information:
        </Text>
        </View>









       <View>




<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
  Account Information:
    <Text style={{  fontWeight: '500'  }}> name, email address, and password when you register.</Text>
  </Text>
</View>
      



<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
 	 Subscription & Payment Information: <Text style={{  fontWeight: '500'  }}> {"\n"}processed securely by Apple App Store or Google Play. Bantico does not store your full payment details.
    </Text>
  </Text>
</View>
      






  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
 	Health & Nutrition Data: <Text style={{  fontWeight: '500'  }}> {"\n"}information you voluntarily provide such as dietary habits, weight, activity logs, or health goals.
    </Text>
  </Text>
</View>
     






  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
 Device & Usage Information: <Text style={{  fontWeight: '500'  }}> {"\n"}device model, operating system, app version, crash logs, and usage patterns to help us improve performance.
    </Text>
  </Text>
</View>





  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
 Support Requests: <Text style={{  fontWeight: '500'  }}> {"\n"}when you contact us, we may collect details of your inquiry.
    </Text>
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
        2. How We Use Information
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
        We use your data to:
        </Text>



  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
 Provide, personalize, and improve Bantico’s services. 
  </Text>
</View>





  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Process subscriptions and deliver premium features.
  </Text>
</View>



<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Communicate important updates (e.g., subscription status, security notices).
  </Text>
</View>





<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Perform analytics to improve app functionality.  
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
        3. Subscriptions, Billing & Refund Policy
        </Text>
        
       
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
	Bantico offers subscription-based services that renew automatically unless canceled.
</Text>
</View>

  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
 Subscriptions are managed directly through the <Text style={{  fontWeight: '700'  }}> App Store</Text> or <Text style={{  fontWeight: '700'  }}>Google Play Store.</Text>
  </Text>
</View>

    



 <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
You may cancel your subscription at any time via your store account settings.
</Text>
</View>




  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
    Refund Policy: <Text style={{  fontWeight: '500'  }}>Payments are non-refundable for the current billing period. If you cancel, you will continue to have access until the end of the paid period, but no refunds will be issued for that month.
    </Text>
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
    4. Sharing of Information
 </Text>
        
 <Text style={{
 fontWeight: "500",
 fontSize: size(15),
 lineHeight: height(3.8),
 marginTop: height(2),
 }}>
  We do not sell your personal data. We may share limited data only with:
 </Text>


  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
  Service Providers: <Text style={{  fontWeight: '500'  }}>for hosting, analytics, and payment processing.
    </Text>
  </Text>
</View>


<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '700' }}>
Legal Authorities: <Text style={{  fontWeight: '500'  }}>if required by applicable law, regulation, or legal process.
    </Text>
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
      5. Data Retention
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
We retain personal data only for as long as necessary to provide Bantico’s 
services or as required by law. You may request deletion of your account 
and associated data at any time by contacting us.


    </Text>

    
        </View>













     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
     6. Security
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
       We use reasonable technical and organizational measures to protect your 
       information. However, no method of storage or transmission is 100% secure, 
       and we cannot guarantee absolute security.

    </Text>

    
        </View>
   























     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
   7. Children’s Privacy
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
     Bantico is <Text style={{fontWeight: "700"}}>not intended for children under 13 years old</Text> (or the minimum 
     legal age in your country). We do not knowingly collect information from children. 
     If we become aware that a child has provided us with personal information, we will delete it immediately.

    </Text>

    
        </View>
   



















     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
      8. International Users
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
    If you are accessing Bantico from outside the country in which our servers are located,
    please note that your information may be transferred and processed across borders 
    in accordance with this Privacy Policy.

    </Text>

    
        </View>
   













     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
      9. Your Rights
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
   Depending on your location, you may have rights under GDPR, 
   CCPA, or other data protection laws, including the right to:

    </Text>



  
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Access and receive a copy of your data.
</Text>
</View>



<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Correct or update inaccurate data.
</Text>
</View>
    



 <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Request deletion of your data.
</Text>
</View>





 <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: height(2) }}>
  <Text style={{ fontSize: size(15), lineHeight: height(3.8) }}>{'\u2022'}</Text>
  <Text style={{ flex: 1, marginLeft: 8, fontSize: size(15), lineHeight: height(3.8), fontWeight: '500' }}>
Withdraw consent for processing (where applicable).
</Text>
</View>
    

 <Text style={{
 fontWeight: "500",
 fontSize: size(15),
 lineHeight: height(3.8),
 marginTop: height(2),
 }}>
To exercise these rights, please contact us (see Section 10).

 </Text>
 </View>
   









     <View>
        <Text style={{
            fontWeight: "700",
              fontSize: size(18),
            lineHeight: height(3.8),
            marginTop: height(5),
        }}>
     10. Changes to This Privacy Policy
        </Text>
        
        <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
            marginTop: height(2),
        }}>
    We may update this Privacy Policy from time to time. 
    If we make significant changes, we will notify you by posting a 
    notice within the App or through other appropriate means.


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
 11. Contact
        </Text>
        


  <Text style={{
            fontWeight: "500",
            fontSize: size(15),
            lineHeight: height(3.8),
             marginBottom: height(1),
 
        }}>
  you have any questions about this Privacy Policy, please contact:

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
          dismiss("Privacy_Policy");
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