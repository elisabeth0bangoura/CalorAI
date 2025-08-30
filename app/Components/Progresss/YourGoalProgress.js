import React from 'react';
import { Platform, Text, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';





const data = [
  { timestamp: 1625945400000, value: 33575.25 },
  { timestamp: 1625946300000, value: 33545.25 },
  { timestamp: 1625947200000, value: 33510.25 },
  { timestamp: 1625948100000, value: 33215.25 },
];

export default function LineChartComponent() {
  return (


    <>
    
    
      <Text style={{
                 fontSize: size(18),
                  fontWeight: "800",
                  marginLeft: width(5),
                  marginBottom: height(3)
              }}>
                Your Goal Progress
              </Text>



          <View style={{
            flexDirection: 'row',
            width: "60%",
            marginLeft: width(5),
           marginBottom: height(1),
          //  backgroundColor: 'yellow',
            height: size(40),
            justifyContent: "space-between", // pushes them apart

            
          }}>
            <Text style={{
              fontSize: size(16),
              fontWeight: "700",
              color: "#A6B0B8",
            }}>
              30d
            </Text>

             <Text style={{
              fontSize: size(16),
              color: "#000",
               fontWeight: "700",
            }}>
              90d
            </Text>

             <Text style={{
              fontSize: size(16),
              color: "#A6B0B8",
               fontWeight: "700",
            }}>
              1Y
            </Text>

            <Text style={{
              fontSize: size(16),
              color: "#A6B0B8",
               fontWeight: "700",
            }}>
              All
            </Text>
          </View>

  
    <View style={{
      width: "100%",
      paddingVertical: 40,
      alignSelf: 'center',
      borderRadius: 15,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: "#f1f1f1",
        ...Platform.select({
                  ios: {
                   shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                  },
                  android: {
                    elevation: 6,
                    shadowColor: '#000',
                  }
                })
    }}>


    
    
      
      


      <View style={{
        flexDirection: 'row',
        alignItems: 'center'
      }}>

      <View style={{
        height: height(4),
        width: width(20),
        backgroundColor: "#691AF5",
       borderRadius: 10,
       marginLeft: width(5),
        marginBottom: height(2),
      }}>

      </View>

      <Text style={{
        top: height(-1),
        marginLeft: width(5),
      }}>
        Calories
      </Text>

     </View>




      <View style={{
        flexDirection: 'row',
        alignItems: 'center'
      }}>


       <View style={{
        height: height(4),
        width: width(65),
         borderRadius: 10,
         marginLeft: width(5),
        backgroundColor: "#C15217",
         marginBottom: height(2),
      }}>

      </View>


      <Text style={{
        top: height(-1),
        marginLeft: width(5),
      }}>
        Coffee
      </Text>


      </View>




  <View style={{
        flexDirection: 'row',
        alignItems: 'center'
      }}>


       <View style={{
        height: height(4),
        width: width(35),
        marginLeft: width(5),
         borderRadius: 10,
        backgroundColor: "#0057FF",
         marginBottom: height(2),
      }}>

      </View>

      <Text style={{
        top: height(-1),
        marginLeft: width(5),
      }}>
        Water
      </Text>

      </View>
    </View>

      </>
  );
}
