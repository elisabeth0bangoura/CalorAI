// EditNutritionGoalsScreen.js
import { useSheets } from '@/app/Context/SheetsContext';
import { Cigarette, Coffee, Egg, Flame, WandSparkles, Wheat } from 'lucide-react-native';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';
import { ScrollView } from 'react-native-gesture-handler';
import { height, size, width } from 'react-native-responsive-sizes';
import AppBlurBottom from './AppBlurBottom';


const COLORS = {
  bg: '#ffffff',
  card: '#F4F5F7',
  text: '#0F0F12',
  sub: '#7B7F87',
  divider: '#ECEEF1',
  cal: '#111111',
  protein: '#632EFF',
  carbs: '#F7931A',
  fat: '#FCDB2A',
  fiber: '#A87DD8',
  sugar: '#FF89A0',
  sodium: '#D7A44A',
  coffee: "#C15217",
  cigarette: "#F7931A"
};

const ringProps = {
  radius: 28,
  activeStrokeWidth: 6,
  inActiveStrokeWidth: 6,
  inActiveStrokeOpacity: 0.15,
  strokeLinecap: 'round',
  rotation: -90,
};

export default function EditHabit_And_Nutrition_Goals() {
  const [showMicros, setShowMicros] = useState(true);


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
  
  


 const [openCategory, setOpenCategory] = useState(false);
  const data = {
    calories: { current: 1074, goal: 2200, unit: 'kcal' },
    protein:  { current: 104,  goal: 150,  unit: 'g' },
    carbs:    { current: 97,   goal: 250,  unit: 'g' },
    fat:      { current: 29,   goal: 70,   unit: 'g' },
    fiber:    { current: 25,   goal: 30,   unit: 'g' },
    sugar:    { current: 40,   goal: 50,   unit: 'g' },
    sodium:   { current: 2300, goal: 2300, unit: 'mg' },
     coffee:   { current: 3, goal: 1, unit: 'cups' },
    cigarette:   { current: 10, goal: 2, unit: 'amount' },
  };

  const clampPct = (c, g) => {
    if (!g || g <= 0) return 0;
    const p = (c / g) * 100;
    return Math.max(0, Math.min(100, p));
  };

  return (
  <>

      <ScrollView
        style={{ height: height(100), width: "100%" }}
        contentContainerStyle={{  paddingBottom: height(25),  }}
     

      >
        <Text style={{ 
            fontSize: size(25),
            marginLeft: width(5),
             marginTop: height(5), 
             fontWeight: '800', 
             color: COLORS.text, 
             lineHeight: 40 
            }}>
          Edit Nutrition Goals
        </Text>



            <View style={{
                width: "90%",
                  alignSelf: 'center',
               marginTop: height(5),
                height: size(100),
                flexDirection: 'row'
            }}>

        
           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.calories.current, data.calories.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.cal}
            inActiveStrokeColor={COLORS.cal}
          >
            <Flame size={18} color={COLORS.cal} />
          </CircularProgressBase>


            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
                Calorie Goal
            </Text>


              <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                1074
            </Text>
             </View>


        </View>







            <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.protein.current, data.protein.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.protein}
            inActiveStrokeColor={COLORS.protein}
          >
            <Egg size={18} color={COLORS.protein} />
          </CircularProgressBase>


           <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
                Protein Goal
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                104
            </Text>
             </View>

        </View>







              <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.carbs.current, data.carbs.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.carbs}
            inActiveStrokeColor={COLORS.carbs}
          >
            <Wheat size={18} color={COLORS.carbs} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
                Carbs Goal
            </Text>


            <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                97
            </Text>
             </View>
        </View>






          <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.fat.current, data.fat.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.fat}
            inActiveStrokeColor={COLORS.fat}
          >
            <Flame size={18} color={COLORS.fat} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
                 Fat Goal
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                29
            </Text>
             </View>
        </View>




         

<TouchableOpacity
  onPress={() => setOpenCategory(prev => !prev)}  // toggeln!
  style={{
    marginLeft: width(5),
    paddingVertical: height(2),
    paddingHorizontal: width(5),
  }}
>
  <Text style={{ fontWeight: "600", fontSize: size(16) }}>
    {openCategory ? "Hide micronutrients" : "Show micronutrients"}
  </Text>
</TouchableOpacity>








    {openCategory && (
        <>
  

          <View style={{
            marginTop: height(5),
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>
   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.fiber.current, data.fiber.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.fiber}
            inActiveStrokeColor={COLORS.fiber}
          >
            <Flame size={18} color={COLORS.fiber} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
               Fiber Goal
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                25
            </Text>
             </View>
        </View>








           <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>
   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.sugar.current, data.sugar.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.sugar}
            inActiveStrokeColor={COLORS.sugar}
          >
            <Flame size={18} color={COLORS.sugar} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
              Sugar Goal
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                40
            </Text>
             </View>
        </View>
      
      


















           <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.sodium.current, data.sodium.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.sodium}
            inActiveStrokeColor={COLORS.sodium}
          >
            <Flame size={18} color={COLORS.sodium} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
             Sodium Goal
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                2300
            </Text>
             </View>
        </View>




















           <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.coffee.current, data.coffee.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.coffee}
            inActiveStrokeColor={COLORS.coffee}
          >
            <Coffee size={18} color={COLORS.coffee} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
             Reduce Coffine
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                5
            </Text>
             </View>
        </View>








           <View style={{
                width: "90%",
                  alignSelf: 'center',
                height: size(100),
                flexDirection: 'row'
            }}>

   

           <CircularProgressBase
            {...ringProps}
            value={clampPct(data.cigarette.current, data.cigarette.goal)}
            maxValue={100}
            activeStrokeColor={COLORS.cigarette}
            inActiveStrokeColor={COLORS.cigarette}
          >
            <Cigarette size={18} color={COLORS.cigarette} />
          </CircularProgressBase>

            <View style={{
                marginLeft: width(5),
            }}>
            <Text style={{
              
            }}>
             Reduce Smoking
            </Text>


             <Text style={{
               fontWeight: "700",
               fontSize: size(18)
            }}>
                20
            </Text>
             </View>
        </View>

      </>

         )

}






      
      </ScrollView>




         <TouchableOpacity onPress={() => {
          present("Generate_Based_On_Habits_AndHealth")
         }}
         style={{
            height: size(50),
            borderWidth: 1,
            width: "90%",
            zIndex: 1000,
            position: 'absolute',
            bottom: height(15),
            alignSelf: 'center',
            borderRadius: 15,
            borderColor: "#000",
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
        }}>

            <WandSparkles size={18} style={{
                marginRight: width(3)
            }}  />
            <Text>
                Generate based on habits and health
            </Text>
        </TouchableOpacity>
        

        

  
        <AppBlurBottom />


        
     </>
  );
}