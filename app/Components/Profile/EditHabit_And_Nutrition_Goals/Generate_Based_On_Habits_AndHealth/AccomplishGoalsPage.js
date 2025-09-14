// AccomplishGoalsScreen.js
import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import {
  Apple,
  BicepsFlexed,
  Cigarette,
  Coffee,
  Sparkles,
  SunMedium,
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { FlatList, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

const ROW_BG = "#F6F7FB";
const ROW_BG_SELECTED = "#151515";

const GOAL_OPTIONS = [
  { id: "eat_healthier",      label: "Eat and live healthier",       Icon: Apple },
  { id: "boost_energy_mood",  label: "Boost my energy and mood",     Icon: SunMedium },
  { id: "stay_consistent",    label: "Stay motivated and consistent", Icon: BicepsFlexed },
  { id: "body_confidence",    label: "Feel better about my body",    Icon: Sparkles },
  { id: "quit_smoking",       label: "Quit smoking",                 Icon: Cigarette },
  { id: "reduce_caffeine",    label: "Cut back on coffee",           Icon: Coffee },
];

function Row({ item, selectedId, onPress }) {
  const { Icon } = item;
  const isSelected = selectedId === item.id;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item.id)}
      style={{
        width: "90%",
        alignSelf: "center",
        marginVertical: 10,
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: isSelected ? ROW_BG_SELECTED : ROW_BG,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          height: 44,
          width: 44,
          borderRadius: 12,
          marginRight: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={size(18)} color={isSelected ? "#fff" : "#111"} />
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
    </TouchableOpacity>
  );
}

export default function AccomplishGoalsPage({ initialId = null, onContinue }) {
  const { AccomplishGoal, setAccomplishGoal } = useEditNutrition();
  const data = useMemo(() => GOAL_OPTIONS, []);

  // Set default selection: use initialId if provided, otherwise first item
  useEffect(() => {
    if (!AccomplishGoal) {
      const fallback = initialId && data.some(d => d.id === initialId)
        ? initialId
        : data[0]?.id;
      if (fallback) setAccomplishGoal(fallback);
    }
  }, [AccomplishGoal, initialId, data, setAccomplishGoal]);

  return (
    <>
      <ScrollView
        style={{ height: height(120), width: "100%" }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: height(35) }}
      >
    
    
    <Text style={{ fontSize: 28, marginTop: height(5), marginLeft: width(5), fontWeight: "700" }}>

          What would you like to accomplish?
        </Text>

        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingTop: height(3), paddingBottom: height(18) }}
          renderItem={({ item }) => (
            <Row item={item} selectedId={AccomplishGoal} onPress={setAccomplishGoal} />
          )}
          extraData={AccomplishGoal} // ensure re-render on selection change
        />
      </ScrollView>
    </>
  );
}