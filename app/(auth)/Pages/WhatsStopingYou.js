// ObstaclesScreen.js
import {
  BarChart3,
  Clock,
  Cookie,
  Lightbulb,
  Users,
} from "lucide-react-native";
import { useMemo } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";

const ROW_BG = "#F6F7FB";
const ROW_BG_SELECTED = "#151515";

const OPTIONS = [
  { id: "consistency", label: "Hard to stay consistent", Icon: BarChart3 },
  { id: "snacking",    label: "Snacking & takeout",      Icon: Cookie },
  { id: "support",     label: "Little accountability",    Icon: Users },
  { id: "time",        label: "Packed schedule",          Icon: Clock },
  { id: "ideas",       label: "Need meal ideas",          Icon: Lightbulb },
];

const OptionRow = ({ item, selected, onPress }) => {
  const { Icon } = item;
  const isSelected = selected === item.id;

  return (
    <Pressable
      onPress={() => onPress(item.id)}
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















export default function WhatsStopingYou({ onContinue }) {

  const {
    WhatsStoppingYou, setWhatsStoppingYou,
  } = useOnboarding()




  
  const data = useMemo(() => OPTIONS, []);

  return (

    <>

    <AppBlurHeader />
   
     
       <ScrollView style={{ height: "100%", width: "100%" }}
       showsVerticalScrollIndicator={false}
       contentContainerStyle={{
           paddingBottom: height(20)
       }}>
      <Text
        style={{
          fontSize: size(28),
          lineHeight: 38,
          marginTop: height(14),
          marginLeft: width(5),
          marginRight: width(5),
          fontWeight: "800",
          color: "#111",
        }}
      >
        What’s getting in the way of your goals?
      </Text>

      {/* Options */}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingTop: height(3), paddingBottom: height(18) }}
        renderItem={({ item }) => (
          <OptionRow item={item} selected={WhatsStoppingYou} onPress={setWhatsStoppingYou} />
        )}
      />

   
   
    </ScrollView>

        </>
  );
}
