// ProgressComponent.js
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

import BMIWidget from "./BMIWidget";
import MyWeightAndStrikesComponent from "./MyWeightAndStrikes";
import TotalCalories from "./TotalCalories";
import WeightProgressChart from "./YourWeightProgressChart";






export default function ProgressComponent() {
  // (Optional) sample categories you might use elsewhere
  const categories = [
    { id: "protein", label: "Protein", grams: 80, color: "#691AF5" },
    { id: "carbs", label: "Carbs", grams: 220, color: "#00CE39" },
    { id: "sugar", label: "Sugar", grams: 60, color: "#FFA2E2" },
    { id: "fat", label: "Fat", grams: 70, color: "#F7931A" },
  ];
  const KCAL = { protein: 4, carbs: 4, sugar: 4, fat: 9 };
  const data = categories.map((c) => ({
    name: c.label,
    value: Math.round((c.grams || 0) * (KCAL[c.id] || 0)),
    color: c.color,
    grams: c.grams,
  }));

  // Ranges: 20D / 90D / 1Y / ALL
  const ranges = useMemo(
    () => [
      { key: "30D", label: "30D" },
      { key: "90D", label: "90D" },
      { key: "1Y", label: "1Y" },
      { key: "ALL", label: "ALL" },
    ],
    []
  );
  const [range, setRange] = useState("90D");

  return (
    <ScrollView
      style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}
      contentContainerStyle={{ paddingBottom: height(20), paddingTop: height(13) }}
      showsVerticalScrollIndicator={false}
    >
   
      {/* Streak + Weight cards */}
      <MyWeightAndStrikesComponent range={range} />
   {/* Range selector */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: width(5),
            paddingRight: width(5),
            alignItems: "center",
          }}
          style={{
            width: "100%",
            height: height(10),
            marginTop: height(3),
            backgroundColor: "transparent",
          }}
        >
          {ranges.map((r) => {
            const isActive = r.key === range;
            return (
              <TouchableOpacity
                key={r.key}
                activeOpacity={0.9}
                onPress={() => setRange(r.key)}
                style={{
                  height: size(40),
                  marginRight: width(5),
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  minWidth: 30,
              
                }}
              >
                <Text
                  style={{
                    fontSize: size(16),
                    fontWeight: "600",
                    letterSpacing: 0.3,
                    color: isActive ? "#000" : "#A6B0B8",
                  }}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Weight progress (pass the selected range) */}
      <View style={{ width: "90%", marginTop: height(4), alignSelf: "center" }}>
        <WeightProgressChart range={range} />
      </View>


    <View style={{ width: "90%", marginTop: height(5), alignSelf: "center" }}>
      <TotalCalories range={range} />
    </View>




    <View style={{ width: "90%", marginTop: height(5), alignSelf: "center" }}>
      <BMIWidget range={range} />
    </View>




    </ScrollView>
  );
}
