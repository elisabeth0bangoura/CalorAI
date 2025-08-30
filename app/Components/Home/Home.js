

import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import * as Haptics from "expo-haptics";
import { Candy, Coffee, CupSoda, Droplet, Egg, Flame, GlassWater, Leaf, Plus, Utensils, Wheat } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import Swiper from 'react-native-swiper';
import { useSheets } from "../../Context/SheetsContext";
import TwoRowMonthlyHeatmap from "./WeeklyCalendar";













export default function Home() {
    const [selected, setSelected] = useState(new Date());

    const userId = getAuth().currentUser.uid;

    
  const { register, present, dismiss, dismissAll } = useSheets()
  const s = { padding: 16, gap: 12 }

    const {
      isS2Open, setIsS2Open,
      isS3Open, setIsS3Open
    } = useSheets()
  

  // 🍝 Pasta with Tomato Sauce

const foods = [
  {
    title: "Pasta with Tomato Sauce",
    image: "https://images.unsplash.com/photo-1604908177522-d1a24a4f8f99",
    calories: 420,
    protein: 12,
    carbs: 82,
    fats: 6,
  },
  {
    title: "Grilled Chicken with Vegetables",
    image: "https://images.unsplash.com/photo-1604908177062-8a97efeb62ab",
    calories: 350,
    protein: 35,
    carbs: 18,
    fats: 12,
  },
  {
    title: "Greek Salad",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
    calories: 220,
    protein: 6,
    carbs: 10,
    fats: 18,
  },
  {
    title: "Sushi Rolls (Salmon & Avocado)",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
    calories: 310,
    protein: 14,
    carbs: 42,
    fats: 9,
  },
  {
    title: "Omelette with Spinach",
    image: "https://images.unsplash.com/photo-1606755962773-0c9c5d6be3dd",
    calories: 280,
    protein: 20,
    carbs: 4,
    fats: 21,
  },
];












const ProgressBar = (props) => {
  const {
    height = 2,
    progress = 0,                 // 0..100
    animated = true,
    indeterminate = false,
    progressDuration = 1100,
    indeterminateDuration = 1100,
    onCompletion = () => {},      // safe default
    backgroundColor = "#000",
    trackColor = "#fff",
  } = props;

  const [timer] = useState(new Animated.Value(0));
  const [width] = useState(new Animated.Value(0));
  const loopRef = useRef(null);

  const startAnimation = useCallback(() => {
    if (indeterminate) {
      // reset timer and start loop
      timer.setValue(0);
      const anim = Animated.timing(timer, {
        duration: indeterminateDuration,
        toValue: 1,
        useNativeDriver: true,
        isInteraction: false,
      });
      loopRef.current = Animated.loop(anim);
      loopRef.current.start();
    } else {
      // animate width (cannot use native driver for width)
      Animated.timing(width, {
        duration: animated ? progressDuration : 0,
        toValue: Math.max(0, Math.min(progress, 100)),
        useNativeDriver: false,
      }).start(() => {
        if (typeof onCompletion === "function") {
          onCompletion();
        }
      });
    }
  }, [
    animated,
    indeterminate,
    indeterminateDuration,
    onCompletion,
    progress,
    progressDuration,
    timer,
    width,
  ]);

  const stopAnimation = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }
    Animated.timing(width, {
      duration: 200,
      toValue: 0,
      useNativeDriver: false, // width => must be false
      isInteraction: false,
    }).start();
  }, [width]);

  useEffect(() => {
    if (indeterminate || typeof progress === "number") {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => {
      // cleanup on unmount
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [indeterminate, progress, startAnimation, stopAnimation]);

  const styleAnimation = indeterminate
    ? {
        transform: [
          {
            translateX: timer.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [-0.6 * 320, -0.5 * 0.8 * 320, 0.7 * 320],
            }),
          },
          {
            scaleX: timer.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.0001, 0.8, 0.0001],
            }),
          },
        ],
      }
    : {
        width: width.interpolate({
          inputRange: [0, 100],
          outputRange: ["0%", "100%"],
        }),
      };

  const styles = StyleSheet.create({
    container: {
      width: "100%",
      height,
      overflow: "hidden",
      borderRadius: height / 2,
      backgroundColor: trackColor,
    },
    progressBar: {
      flex: 1,
      borderRadius: height / 2,
      backgroundColor,
    },
  });

  return (
    <View style={{ width: "100%" }}>
      <Animated.View style={styles.container}>
        <Animated.View style={[styles.progressBar, styleAnimation]} />
      </Animated.View>
    </View>
  );
};


















 const renderItem = ({ item }) => (
    <View style={{
      height: size(80),
    //  backgroundColor: 'pink',
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderRadius: 20,
      width: "90%",
      alignSelf: 'center',
      flexDirection: 'row',
      
      marginBottom: height(1),
    }}>

  

    <View style={{
      alignItems: 'center',
      width: 30,
      justifyContent: 'center',
     // backgroundColor: 'yellow',
      height: 50,
      alignSelf: 'center',
    }}> 
      <Utensils  size={25} />
 <View style={{
        height: size(30),
        position: 'absolute',
        width: 1,
         alignSelf: 'center',
        top: height(5.8),
        backgroundColor: '#000'
      }}>

      </View>
     </View>

       <View style={{
       
         marginLeft: width(5),
         width: "90%"
       }}>

      
      <Text style={{
        fontSize: size(15),
        fontWeight: "800",
        width: "70%"
       
      }}>
          {item.title}
      </Text>



        <Text style={{

            fontSize: 14,
            fontWeight: "bold",
             position: 'absolute',
             right: 0,
        }}>+{item.calories} cal</Text>





      <Text style={{
        color: "#BBC1CB",
        marginTop: height(0.5)
      }}> 
        20.35
      </Text>



</View>



      







      


    
    </View>
  );









{
  /*

"Add Widget" button

At the end of the grid, show a card with a + sign (like iOS home screen).

Tap it → opens a modal with available widgets:

Water

Calories

Coffee

Smoking

Alcohol

Steps

Custom (e.g. "Meditation", "Supplements")
  */
}








  return (
   
   <View style={{
    backgroundColor: "#fff",
    height: "100%",
    width: "100%"
   }}>



<ScrollView style={{
  height: "100%",
  paddingTop: height(12),
  width: "100%",
  backgroundColor: '#fff'
}}>



<View style={{ marginTop: height(0),  }}>
<TwoRowMonthlyHeatmap
        db={getFirestore()}
        userId={userId}
        monthsAhead={4}   // Aug (current) + Sep, Oct, Nov, Dec
        monthsBack={0}    // start at current month
        gap={4}
        
      />
</View>









<TouchableOpacity style={{
  marginLeft: width(5),
  marginTop: height(2),
  flexDirection: 'row',
}}>
  <Plus size={16} />

  <Text style={{
    marginLeft: width(2),
    fontSize: size(17),
    fontWeight: "800",
  }}>
    Add widget
  </Text>
</TouchableOpacity>



 <Swiper 
 onIndexChanged={() => {
    // light tap when the page changes
    Haptics.selectionAsync();
    // or: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }}
 style={styles.wrapper}
 showsButtons={false}
 activeDot={
 <View style={{
  backgroundColor: '#000',
  width: size(40), 
  height: 8, 
  borderRadius: 4, 
  marginLeft: 3, 
  marginRight: 3, 
  marginTop: 3, 
  marginBottom: 3,}} 
/>}
dot={
<View style={{
  backgroundColor:'#D3DAE0', 
  width: 8, 
  height: 8,
  borderRadius: 4, 
  marginLeft: 3,
   marginRight: 3, 
   marginTop: 3, 
   marginBottom: 3,
}} />
}
 paginationStyle={{ bottom: 40 }} >

 <View style={styles.slide1}>
         



  <View style={{
        height: height(20),
        width: "90%",
        paddingBottom: height(5),
        alignSelf: 'center',
        borderRadius: 19,
        borderWidth: "#D3DAE0",
        marginTop: height(1.8),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#151515',
          ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
    }}>


      <View style={{
        flexDirection: 'row',
        width: "95%",
       
        alignItems: 'center'
      }}>
 

        <View style={{
           marginTop: height(5),
          marginLeft: width(5)
        }}>
        <Text style={{
            fontSize: size(35),
           fontWeight: "bold",
            
            color: '#fff',
           
        }}>
            500
        </Text>

           <Text style={{
           fontSize: size(13),
           color: '#fff',
          fontWeight: "800"
        }}>
           Calories left
        </Text>

 </View>


<View style={{
   marginTop: height(5),
   marginLeft: width(22)
}}> 

       <CircularProgressBase
      value={60}
      radius={60}
      duration={2000}
      inActiveStrokeWidth={9}
      activeStrokeWidth={9}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#FFCF2D"
      inActiveStrokeColor="#fff"
    >
      <Flame size={25} color="#fff" />
    </CircularProgressBase>
</View>



</View>


    </View>

  <View style={{
  height: height(32),
  flexDirection: 'row',
  width: "90%",
  alignSelf: 'center',
  gap: 10,
  justifyContent: "space-between", // pushes them apart
}}>

    <View style={{
        height: height(20),
        width: size(180),
        borderRadius: 20,
        borderWidth: "#D3DAE0",
        marginTop: height(2),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
    }}>



     <CircularProgressBase
      value={60}
      radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#0057FF"
      inActiveStrokeColor="#D3DAE0"
    >
      <GlassWater size={25} color="#000" />
    </CircularProgressBase>

        <Text style={{
           fontSize: size(20),
           marginTop: height(2),
           fontWeight: "bold",
           marginBottom: height(1)
        }}>
            450 ml
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800"
         
        }}>
           Watter Left
        </Text>

    </View>













  <View style={{
        height: height(20),
        width: size(180),
        borderRadius: 20,
        borderWidth: "#D3DAE0",
        marginTop: height(2),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
         ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
    }}>





     <CircularProgressBase 
      value={60}
      radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#C15217"
      inActiveStrokeColor="#D3DAE0"
    >
      <Coffee size={25} color="#000" />
    </CircularProgressBase>


         <Text style={{
           fontSize: size(20),
           marginTop: height(2),
           fontWeight: "bold",
            textAlign: 'center',
           marginBottom: height(1)
        }}>
            1
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800"
         
        }}>
           Cup of Coffee
        </Text>

       


    </View>
    </View>







        </View>
        <View style={styles.slide2}>

         
         <View style={{
          flexDirection: 'row',
          height: height(20),
          alignSelf: 'center',
          marginTop: height(1.8),
          width: "90%",
         // backgroundColor: 'yellow',
           
          justifyContent: "space-between", // pushes them apart
         }}>
          <View style={{
            width: "48%",
             height: "100%",
            backgroundColor: '#fff',
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: "center",
              ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
            
          }}>


      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            30 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Protein Left
        </Text>


  <CircularProgressBase
      value={60}
     radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#632EFF"
      inActiveStrokeColor="#D3DAE0"
    >
      <Egg size={25} color="#000" />
    </CircularProgressBase>

      


          </View>

          <View style={{
            width: "48%",
            height: "100%",
            justifyContent: 'center',
            alignItems: 'center',
             backgroundColor: '#fff',
            borderRadius: 15,
               ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
          }}>



      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            20 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Carbs Left
        </Text>


        <CircularProgressBase
            value={60}
           radius={35}
            duration={2000}
            inActiveStrokeWidth={6}
            activeStrokeWidth={6}
            showProgressValue={false}
            maxValue={200}
            activeStrokeColor="#F7931A"
            inActiveStrokeColor="#D3DAE0"
          >
            <Wheat size={25} color="#000" />
          </CircularProgressBase>

          </View>

         
         
         </View>










         <View style={{
          
          marginTop: height(2),
          height: height(20),
          alignSelf: 'center',
          width: "90%",
          backgroundColor: '#151515',
          borderRadius: 15,
          marginBottom: height(2),
           ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
         }}>



         <View style={{
          flexDirection: 'row',
              marginLeft: width(5),
           marginTop: height(2),
           alignItems: 'center'
         }}>

     

         <Text style={{
         
          fontSize: size(20),
          fontWeight: "800",
          color: "#fff",
      
         }}>
          Health Score
         </Text>


         <Text style={{
          position: 'absolute',
          right: width(5),
          color: "#fff",
          fontWeight: "700"
         }}>
          70/100
         </Text>

    </View>

         <View style={{
          marginTop: height(2),
          width: "90%",
           alignSelf: 'center'
         }}>
            <ProgressBar progress={60} height={8} backgroundColor="#5BC951" />
         </View>

          <Text style={{
            fontSize: size(13),
            width: "90%",
            marginLeft: width(5),
            color: "#fff",
            marginTop: height(2),
            lineHeight: height(2.5)
          }}>
            You're below your calorie, carb, and fat goals, but need to increase protein for effective weight loss. Keep focusing on boosting protein intake!
          </Text>

         </View>
          
        </View>
       
       
       
       
       
       
       
       
       
       
       
       
       
       
       
       
       
        <View style={styles.slide3}>
               <View style={{
          flexDirection: 'row',
          height: height(20),
          alignSelf: 'center',
          marginTop: height(1.8),
          width: "90%",
         // backgroundColor: 'yellow',
           
          justifyContent: "space-between", // pushes them apart
         }}>
          <View style={{
            width: "48%",
             height: "100%",
            backgroundColor: '#fff',
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: "center",
              ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
            
          }}>


      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            30 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Fiber Left
        </Text>


  <CircularProgressBase
      value={60}
     radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#5BC951"
      inActiveStrokeColor="#D3DAE0"
    >
      <Leaf size={25} color="#000" />
    </CircularProgressBase>

      


          </View>

          <View style={{
            width: "48%",
            height: "100%",
            justifyContent: 'center',
            alignItems: 'center',
             backgroundColor: '#fff',
            borderRadius: 15,
               ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
          }}>



      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            20 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Sugar Left
        </Text>


        <CircularProgressBase
            value={60}
           radius={35}
            duration={2000}
            inActiveStrokeWidth={6}
            activeStrokeWidth={6}
            showProgressValue={false}
            maxValue={200}
            activeStrokeColor="#FFA2E2"
            inActiveStrokeColor="#D3DAE0"
          >
            <Candy size={25} color="#000" />
          </CircularProgressBase>

          </View>

         </View>












    <View style={{
          flexDirection: 'row',
          height: height(20),
          alignSelf: 'center',
          marginTop: height(1.8),
          width: "90%",
         // backgroundColor: 'yellow',
           
          justifyContent: "space-between", // pushes them apart
         }}>



 <View style={{
            width: "48%",
            height: "100%",
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            borderRadius: 15,
               ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
          }}>


      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            30 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Fat Left
        </Text>


  <CircularProgressBase
      value={60}
      radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#FDFF50"
      inActiveStrokeColor="#D3DAE0"
    >
      <Droplet size={25} color="#000" />
    </CircularProgressBase>

      

          </View>
          <View style={{
            width: "48%",
            height: "100%",
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            borderRadius: 15,
               ...Platform.select({
            ios: {
             shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: {
              elevation: 6,
              shadowColor: '#00000050',
            }
          })
          }}>


      <Text style={{
           fontSize: size(20),
           fontWeight: "800",
           marginBottom: height(1)
        }}>
            30 g
        </Text>

           <Text style={{
           fontSize: size(13),
           fontWeight: "800",
           marginBottom: height(2)
         
        }}>
           Sodium Left
        </Text>


  <CircularProgressBase
      value={60}
      radius={35}
      duration={2000}
      inActiveStrokeWidth={6}
      activeStrokeWidth={6}
      showProgressValue={false}
      maxValue={200}
      activeStrokeColor="#1E90FF"
      inActiveStrokeColor="#D3DAE0"
    >
      <CupSoda size={25} color="#000" />
    </CircularProgressBase>

      

          </View>
       
 </View>





        
        </View>
      </Swiper>












































 <Text style={{
        fontSize: size(17),
      marginTop: height(0),
      marginLeft: width(5),
      fontWeight: "bold"
    }}>
     Recently eaten
    </Text>



<Text style={{marginLeft: width(5), fontSize: size(16), marginTop: height(2) }}>
  Today
</Text>

 <FlatList style={{
  marginTop: height(2)
 }} contentContainerStyle={{
  paddingBottom: height(18)
 }}
        data={foods}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
      />


</ScrollView>









       </View>



  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
  },
  card: {
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    padding: 10,
    elevation: 2,
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  text: {
    fontSize: 14,
    marginTop: 4,
  },




 wrapper: {
    height: height(55), // give Swiper a fixed height once
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    
  },

  slide1: {
    paddingTop: height(2)
   
   
  },
  slide2: {
      paddingTop: height(2)
   
   
  },
  slide3: {
       
     paddingTop: height(2)
  
  },
  
});









{
  /*


<View
  style={{
    flexDirection: "row",
    width: 200,
    marginLeft: width(0),
    marginTop: height(2),
  //  backgroundColor: "pink",
    alignItems: "center", // keeps everything vertically aligned
    justifyContent: "space-between", // spreads groups evenly
  }}
>
  {/* Protein *
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <Beef size={18} />
    <Text style={{ fontSize: 14, marginLeft: 4 }}>
      {item.protein}g
    </Text>
  </View>

  {/* Carbs *
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <Wheat size={18} />
    <Text style={{ fontSize: 14, marginLeft: 4 }}>
      {item.carbs}g
    </Text>
  </View>

  {/* Fats *
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <Droplets size={18} />
    <Text style={{ fontSize: 14, marginLeft: 4 }}>
      {item.fats}g
    </Text>
  </View>
</View>


  */
}