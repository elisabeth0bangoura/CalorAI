// UserCurrentFocus.js
import { useState } from "react";
import { FlatList, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

// Lucide icons
import {
    Cigarette,
    Coffee,
    Dumbbell,
    Flame,
    Minus
} from "lucide-react-native";
import AppBlurHeader from "../../AppBlurHeader";

// ── Goal sets with icons (single or multiple) ───────────────────────────
export const GOAL_SETS = {
  healthFirst: [
    {
      id: "lose",
      label: "Lose body fat",
      helper: "Health & leanness",
      icons: [Flame],
    },
    {
      id: "maintain",
      label: "Hold current weight",
      helper: "Consistency",
      icons: [Minus],
    },
    {
      id: "gain",
      label: "Increase muscle & weight",
      helper: "Healthy gain",
      icons: [Dumbbell],
    },

    // ✅ each of these now uses ONE icon
     {
      id: "stopSmoking",
      label: "Quit smoking",
      helper: "Improve health & recovery",
      icons: [Cigarette], // single icon
    },
    {
      id: "reduceCoffee",
      label: "Cut back on caffeine",
      helper: "Better sleep & steady energy",
      icons: [Coffee], // single icon
    },
  ],
};

export default function UserCurrentFocus() {
  const GOALS = GOAL_SETS.healthFirst;
  const [goal, setGoal] = useState(null);

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
   <AppBlurHeader />

  

<ScrollView style={{
     height: "100%", width: "100%",
}}  contentContainerStyle={{ 
    paddingTop:  height(14),
    paddingBottom: height(20) 
}}>

          <Text style={{ fontSize: 28,  marginLeft: width(5), fontWeight: "700" }}>
          How often do you work out each week?
        </Text>
        <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
          This helps us tailor your plan to match your routine.
        </Text>



      <FlatList 
        style={{ marginTop: height(4) }}
        data={GOALS}
        keyExtractor={(i) => i.id}
       
        renderItem={({ item }) => {
          const isSelected = goal === item.id;
          return (
            <TouchableOpacity
              onPress={() => setGoal(item.id)}
              activeOpacity={0.85}
              style={{
                width: "90%",
                alignSelf: "center",
                marginVertical: 8,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: isSelected ? "#151515" : "#F1F3F9",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flexDirection: "row", marginRight: width(5) }}>
                  {(item.icons || []).map((IconCmp, idx) => (
                    <IconCmp
                      key={idx}
                      size={size(18)}
                      color={isSelected ? "#fff" : "#111"}
                      style={{ marginRight: idx < (item.icons?.length ?? 0) - 1 ? 6 : 0 }}
                    />
                  ))}
                </View>

                <Text
                  style={{
                   fontSize: size(16),
                    fontWeight: "800",
                    color: isSelected ? "#fff" : "#111",
                  }}
                >
                  {item.label}
                </Text>
              </View>

              {!!item.helper && (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: size(12),
                    marginLeft: width(10),
                    fontWeight: "600",
                    color: isSelected ? "rgba(255,255,255,0.7)" : "#BCC1CA",
                  }}
                >
                  {item.helper}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

       </ScrollView>
    </View>
  );
}
