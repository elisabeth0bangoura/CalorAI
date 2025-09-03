// DietPreferenceScreen.js
import { Drumstick, Fish, Leaf, Sprout } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";

const ROW_BG = "#F6F7FB";
const ROW_BG_SELECTED = "#151515";

const OPTIONS = [
  { id: "balanced",    label: "Balanced",    helper: "No strict rules",         Icon: Drumstick },
  { id: "pescatarian", label: "Pescatarian", helper: "Fish & seafood included", Icon: Fish },
  { id: "vegetarian",  label: "Vegetarian",  helper: "No meat",                  Icon: Leaf },
  { id: "vegan",       label: "Vegan",       helper: "100% plant-based",         Icon: Sprout },
];

function OptionRow({ item, selectedId, onPress }) {
  const { Icon } = item;
  const isSelected = selectedId === item.id;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item.id)}
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
        <Icon size={size(18)} color={isSelected ? "#fff" : "#111"} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: size(16),
            fontWeight: "800",
            color: isSelected ? "#fff" : "#111",
          }}
        >
          {item.label}
        </Text>
        {!!item.helper && (
          <Text
            style={{
              marginTop: 4,
              fontSize: size(12.5),
              fontWeight: "700",
              color: isSelected ? "rgba(255,255,255,0.7)" : "#8E9198",
            }}
          >
            {item.helper}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DietPreferenceScreen({ initialId = null, onContinue }) {
  const { dietPreferenceId, setDietPreferenceId } = useOnboarding();
  const data = useMemo(() => OPTIONS, []);

  // Seed from prop exactly once if nothing chosen yet
  useEffect(() => {
    if (!dietPreferenceId && initialId) {
      const valid = OPTIONS.some(o => o.id === initialId);
      if (valid) setDietPreferenceId(initialId);
    }
  }, [dietPreferenceId, initialId, setDietPreferenceId]);

  const handleSelect = (id) => setDietPreferenceId(id);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Title & subcopy */}
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
        Do you follow a specific eating pattern?
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
        Pick what fits most days—you can change it anytime.
      </Text>

      {/* Options */}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingTop: height(3), paddingBottom: height(18) }}
        renderItem={({ item }) => (
          <OptionRow item={item} selectedId={dietPreferenceId} onPress={handleSelect} />
        )}
      />

      {/* If you have a continue button elsewhere, call onContinue?.() there */}
    </View>
  );
}
