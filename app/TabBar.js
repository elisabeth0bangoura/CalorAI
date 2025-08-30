
// Tabbar.js
import { Text, TouchableOpacity, View } from "react-native"
import { height, size, width } from "react-native-responsive-sizes"
import { useSheets } from "./Context/SheetsContext"

export default function Tabbar() {
  const {
    register, present, dismiss, dismissAll,
    isS2Open, setIsS2Open,
    isS3Open, setIsS3Open
  } = useSheets()


  
  return (
  
      <View style={{
        flexDirection :'row',
        width: "85%",
        position: 'absolute',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        bottom: height(8),
         gap: width(2),
        justifyContent: "space-between", // pushes them apart
      }}>

          <TouchableOpacity  
           activeOpacity={0.8}
           onPress={() => present("s1")}
            style={{
               height: size(60),
                 width: width(42),
                paddingHorizontal: 25,
               
                
                
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 18,
                backgroundColor: '#151515',
                  shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.30,
                shadowRadius: 4.65,
                elevation: 8,
            }}>
            <Text style={{
                color: '#fff',
                fontSize: size(17),
                fontWeight: "bold"
            }}>
                Search
            </Text>
        </TouchableOpacity>





            

          <TouchableOpacity  
           activeOpacity={0.8}
          onPress={() => {
            // setIsS2Open(true)
            present("s2")
           
          }}
            style={{
                height: size(60),
                 width: width(42),
                paddingHorizontal: 25,
              
        
               
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 18,
                backgroundColor: '#151515',
                  shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.30,
                shadowRadius: 4.65,
                elevation: 8,
            }}>
            <Text style={{
                color: '#fff',
                fontSize: size(17),
                fontWeight: "bold"
            }}>
                Camera
            </Text>
        </TouchableOpacity>
</View>

  )
}
