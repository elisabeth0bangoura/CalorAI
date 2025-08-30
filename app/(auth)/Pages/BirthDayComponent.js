// BirthdaySimple.js
import { Picker } from "@react-native-picker/picker";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader2 from "./AppBlurHeader2";




const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const daysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();

export default function BirthdaySimple() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = useMemo(
    () => Array.from({ length: 100 - 13 + 1 }, (_, i) => currentYear - 13 - i), // 13–100 y/o
    [currentYear]
  );

  const [year, setYear] = useState(currentYear - 20);
  const [month, setMonth] = useState(0); // 0..11
  const [day, setDay] = useState(1);

  const maxDay = useMemo(() => daysInMonth(month, year), [month, year]);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay]); // keep day valid

  const submit = () => {
    const dob = new Date(year, month, day);
    console.log("DOB:", dob.toISOString().slice(0, 10));
  };

  const wheelStyle = { height: 180, width: "100%" };
  const itemStyle  = { fontSize: 18, fontWeight: "700", color: "#111" };

  return (
  <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      {/* Title & sub */}
      <Text
        style={{
          fontSize: 28,
          marginTop: height(14),
          marginLeft: width(5),
          fontWeight: "700",
        }}
      >
       When is your Birthday?
      </Text>
        
        
      <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
        This helps us tailor your plan.
      </Text>



         <View
                style={{
                  width: "100%",
                  marginLeft: width(5),
                  top: height(17),
                 
                }}
              >
               
                  <Text
                    style={{
                      fontSize: size(14),
                      fontWeight: "800",
                      color: "#111",
                      zIndex: 1000,
                    }}
                  >
                    Select your Birthday
                  </Text>

                  <AppBlurHeader2 />
                </View>
                
         

      <View style={{ flexDirection: "row", height: 500 ,  justifyContent: "space-between",   top: height(14)}}>


        
        {/* Month */}
        <View style={{ width: "42%", borderRadius: 12, overflow: "hidden", }}>
          <Picker
            selectedValue={month}
            onValueChange={setMonth}
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {MONTHS.map((m, i) => (
              <Picker.Item key={m} label={m} value={i} />
            ))}
          </Picker>
        </View>

        {/* Day */}
        <View style={{ width: "25%", borderRadius: 12, overflow: "hidden",  }}>
          <Picker
            selectedValue={day}
            onValueChange={setDay}
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <Picker.Item key={String(d)} label={String(d)} value={d} />
            ))}
          </Picker>
        </View>

        {/* Year */}
        <View style={{ width: "30%", borderRadius: 12, overflow: "hidden",  }}>
          <Picker
            selectedValue={year}
            onValueChange={setYear}
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {years.map((y) => (
              <Picker.Item key={String(y)} label={String(y)} value={y} />
            ))}
          </Picker>
        </View>
      </View>

    
    
    </View>
  );
}
