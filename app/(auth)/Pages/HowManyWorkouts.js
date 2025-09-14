import { FlatList, Pressable, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

export default function HowManyWorkouts() {
  const { workouts, setWorkouts } = useOnboarding(); // assume this stores the selected id

  const DATA = [
    { id: "0",   top: "0",   sub: "I haven’t worked out in a while.", label: "Haven’t worked out" },
    { id: "1-2", top: "1-2", sub: "Just getting started",             label: "Just getting started" },
    { id: "3-4", top: "3-4", sub: "Keeping a steady pace",            label: "Keeping a steady pace" },
    { id: "5-6", top: "5–6", sub: "Almost every day",                 label: "Almost every day" },
    { id: "7",   top: "7",   sub: "No days off",                      label: "No days off" },
  ];

  const renderItem = ({ item }) => {
    const isActive = workouts === item.id; // compare by unique id

    return (
      <Pressable
        onPress={() => {
          console.log("Pressed:", item.id);
          setWorkouts(item.id);            // store the id (unique)
          // If you also need the label elsewhere, store it in context too.
        }}
        style={{
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
    <>
      <AppBlurHeader />
      <FlatList
        data={DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: "90%",
          alignSelf: "center",
          paddingTop: height(5),
        }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
      />
    </>
  );
}
