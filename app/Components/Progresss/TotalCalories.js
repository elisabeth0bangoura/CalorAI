// BubbleChartComponent.js
import { Platform, Text, View } from 'react-native';

import { useState } from 'react';
import { height, size, width } from 'react-native-responsive-sizes';
import MonthScroller from "./MonthScroller";




export default function TotalCalories() { 
  const [month, setMonth] = useState(null); // {key,label,date,year,monthIndex}



  return (

    
   
   <View style={{

   }}>

<Text style={{
  fontSize: size(18),
  fontWeight: "800",
  marginLeft: width(5),
  marginBottom: height(1)
}}>
  Total Calories
</Text>



<Text style={{
  fontSize: size(30),
   marginBottom: height(2),
  fontWeight: "800",
  marginLeft: width(5)
}}>
  1,039 cal
</Text>




        <MonthScroller
                monthsBack={6}
                monthsAhead={12}
                onChange={(m) => setMonth(m)}
                locale="en-US"
              />
        


 <View style={{
    width: "100%",
    paddingVertical: 40,
    alignSelf: 'center',
    borderRadius: 15,
    flexDirection: 'row',
    marginTop: height(2.5),
    justifyContent: 'center',
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
  width: "90%",
  overflow: 'hidden',
  alignSelf: 'center',
 // backgroundColor: 'yellow',
  justifyContent: "space-between", // pushes them apa
  flexDirection: 'row'
}}>



<View style={{
 height: height(4),
  width: "40%",
  
  borderRadius: 10,
  backgroundColor: "#F7931A"
}}>

</View>




<View style={{
  height: height(4),
  width: "20%",
  borderRadius: 10,
  backgroundColor: "#0058FF"
}}>

</View>



<View style={{
 height: height(4),
  width: "35%",
  borderRadius: 10,
  backgroundColor: "#632EFF"
}}>

</View>
</View>


    </View>
    
   </View>

  );
}
