// SmokingFrequencyScreen.js
import { Ban, Cigarette } from "lucide-react-native";
import { useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

const ROW_BG = "#F6F7FB";
const ROW_BG_SELECTED = "#151515";

const OPTIONS = [
  { id: "none",     label: "0 times (I don’t smoke)", Icon: Ban,       value: { timesPerWeek: 0 } },
  { id: "1-2",      label: "1–2 times per week",      Icon: Cigarette, value: { range: [1, 2],   timesPerWeek: 2 } },
  { id: "3-5",      label: "3–5 times per week",      Icon: Cigarette, value: { range: [3, 5],   timesPerWeek: 5 } },
  { id: "6-10",     label: "6–10 times per week",     Icon: Cigarette, value: { range: [6, 10],  timesPerWeek: 10 } },
  { id: "10-plus",  label: "More than 10 per week",   Icon: Cigarette, value: { min: 11,         timesPerWeek: 11 } },
];

const OptionRow = ({ item, selected, onPress }) => {
  const { Icon } = item;
  const isSelected = selected?.id === item.id;

  return (


    <Pressable
      onPress={() => onPress(item)}
      activeOpacity={0.9}
      style={{
        width: "90%",
        alignSelf: "center",
        marginVertical: 8,
        paddingVertical: 16,
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
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Icon size={18} color={isSelected ? "#fff" : "#111"} />
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
    </Pressable>
  );
};

export default function SmokingFrequencyScreen({ onContinue }) {
  
  const {
    SmokingFrequency, setSmokingFrequency
  } = useOnboarding()


  
  const data = useMemo(() => OPTIONS, []);

  return (
    <>
    <AppBlurHeader />
   
     
       <ScrollView style={{ height: "100%", width: "100%" }}
       showsVerticalScrollIndicator={false}
       contentContainerStyle={{
           paddingBottom: height(5)
       }}>
      <Text
        style={{
          fontSize: 32,
          lineHeight: 38,
          marginTop: height(14),
          marginLeft: width(5),
          marginRight: width(5),
          fontWeight: "800",
          color: "#111",
        }}
      >
        Do you smoke?
      </Text>
      <Text
        style={{
          fontSize: size(14),
          marginTop: height(1),
          marginLeft: width(5),
          marginRight: width(5),
          fontWeight: "700",
          color: "#BCC1CA",
        }}
      >
        Choose how often in a typical week.
      </Text>

      {/* Options */}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingTop: height(3), paddingBottom: height(18) }}
        renderItem={({ item }) => (
          <OptionRow item={item} selected={SmokingFrequency} onPress={setSmokingFrequency} />
        )}
      />


    </ScrollView>

     </>


  );
}
