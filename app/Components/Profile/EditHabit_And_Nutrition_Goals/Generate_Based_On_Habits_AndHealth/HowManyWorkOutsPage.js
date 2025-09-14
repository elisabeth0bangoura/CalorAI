import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

export default function HowManyWorkOutsPage() {
  const { workouts, setWorkouts } = useEditNutrition("0"); // default key

  const DATA = [
    { id: "0",   top: "0",   sub: "I haven’t worked out in a while.", label: "Haven’t worked out" },
    { id: "1-2", top: "1-2", sub: "Just getting started",             label: "Just getting started" },
    { id: "3-4", top: "3-4", sub: "Keeping a steady pace",            label: "Keeping a steady pace" },
    { id: "5-6", top: "5–6", sub: "Almost every day",                 label: "Almost every day" },
    { id: "7",   top: "7",   sub: "No days off",                      label: "No days off" },
  ];

  // Set default to first option if none is selected yet
  useEffect(() => {
    if (!workouts) {
      setWorkouts(DATA[0].id);
    }
  }, [workouts, setWorkouts]);

  const renderItem = ({ item }) => {
    const isActive = workouts === item.id;

    return (
      <Pressable
        onPress={() => setWorkouts(item.id)}
        style={{
          //sheight: size(70),
          justifyContent: "center",
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 20,
          width: "48%",
          alignSelf: "center",
          marginBottom: 12,
          backgroundColor: isActive ? "#151515" : "#F1F3F9",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: size(16),
              marginLeft: width(5),
              fontWeight: "800",
              color: isActive ? "#fff" : "#000",
            }}
          >
            {item.top}
          </Text>

          <Text
            style={{
              fontSize: size(12),
              marginTop: height(0.5),
              width: "85%",
              marginLeft: width(5),
              fontWeight: "700",
              color: isActive ? "#fff" : "#BCC1CA",
            }}
            numberOfLines={2}
          >
            {item.sub}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ height: "100%", width: "100%" }}>
      <Text
        style={{
          fontSize: size(28),
         marginTop: height(5),
          lineHeight: height(4),
          marginLeft: width(5),
          fontWeight: "700",
        }}
      >
        How often do you work out each week?
      </Text>
      <Text
        style={{
          fontSize: size(14),
          marginTop: height(1),
          marginLeft: width(5),
          fontWeight: "700",
          color: "#BCC1CA",
        }}
      >
        This helps us tailor your plan to match your routine.
      </Text>

      <FlatList
        style={{ marginTop: height(5) }}
        data={DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: "90%", alignSelf: "center" }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        extraData={workouts} // re-render when selection changes
      />
    </View>
  );
}