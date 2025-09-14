// app/(auth)/Pages/StepsSetupScreen.js
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import * as Haptics from "expo-haptics";
import { doc, setDoc } from "firebase/firestore";
import { Check } from "lucide-react-native";
import { useState } from "react";
import {
    Alert,
    FlatList,
    Platform,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../../Context/OnboardingContext";




const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const parseSteps = (t) => {
  const digits = (t || "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
};

function DailyStepsSelector({ value, onChange, step = 500 }) {
  const presets = [3000, 5000, 7000, 8000, 10000, 12000, 15000];
  const [input, setInput] = useState(String(value ?? ""));

  const setVal = (n) => {
    const clamped = clamp(n, 0, 50000);
    setInput(String(clamped));
    onChange?.(clamped);
  };

  const dec = () => setVal((value || 0) - step);
  const inc = () => setVal((value || 0) + step);

  return (
    <View style={{ marginTop: height(6) }}>
      {/* Input + +/- */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={dec}
          style={{
            width: 44, height: 40,  borderWidth: 1,
                borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: "#fff",
            alignItems: "center", justifyContent: "center", marginRight: 10,
          }}
        >
          <Text style={{ fontSize: size(18), fontWeight: "800" }}>−</Text>
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            height: 40,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            backgroundColor: "#fff",
            flex: 1,
          }}>

          <TextInput
            value={input}
            onChangeText={(t) => setInput(t)}
            onBlur={() => setVal(parseSteps(input))}
            keyboardType="number-pad"
            style={{
              flex: 1,
              fontSize: size(14),
              fontWeight: "700",
              color: "#111",
              paddingVertical: 0,
            }}
            placeholder="e.g. 10,000"
          />
          <Text style={{ marginLeft: 6, color: "#6B7280", fontWeight: "600" }}>steps</Text>
        </View>

        <Pressable
          onPress={inc}
          style={{
            width: 44, height: 40,  borderWidth: 1,
                borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: "#fff",
            alignItems: "center", justifyContent: "center", marginLeft: 10,
          }}
        >
          <Text style={{ fontSize: size(18), fontWeight: "800" }}>+</Text>
        </Pressable>
      </View>

      {/* Presets */}
      <FlatList contentContainerStyle={{
        paddingLeft: width(5),
         paddingRight: width(5)
      }}
       style={{ 
        paddingVertical: size(7),
        width: "100%",
        top: height(2),
       // backgroundColor: 'yellow',
      }}
        data={presets}
        horizontal
        keyExtractor={(n) => String(n)}
        renderItem={({ item }) => {
          const selected = Number(value) === item;
          return (
            <Pressable
              onPress={() => setVal(item)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginRight: 8,
                 ...Platform.select({
                      ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.05, shadowRadius: 10 },
                      android: { elevation: 1, shadowColor: "#ccc" },
                    }),
                marginTop: 12,
                backgroundColor: selected ? "#111" : "#fff",
              }}
            >
              <Text style={{ color: selected ? "#fff" : "#111", fontWeight: "800", fontSize: size(12) }}>
                {item.toLocaleString()}
              </Text>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

export default function DailyStepsComponent() {
  const { db, uid } = useOnboarding(); // from your context
  const [steps, setSteps] = useState(8000);
  const [saving, setSaving] = useState(false);

  const onPressSave = async () => {
    if (!getAuth().currentUser.uid) {
      Alert.alert("Not signed in");
      return;
    }
    try {
      setSaving(true);
      await setDoc(doc(getFirestore(), "users", getAuth().currentUser.uid), { stepsPerDayTarget: steps }, { merge: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", `Daily step goal set to ${steps.toLocaleString()}`);
    } catch (e) {
      Alert.alert("Save failed", e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ height: "100%", width: "100%",
     padding: 20, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 24, fontWeight: "800",marginTop: height(5), }}>Daily Step Goal</Text>
      <DailyStepsSelector value={steps} onChange={setSteps} />

      <TouchableOpacity
        onPress={onPressSave}
        disabled={saving}
        style={{
         top: height(80),
                  paddingVertical: 14,
                  flexDirection: 'row',
                  width: size(140),
                  right: width(5),
                  height: size(50),
                    paddingHorizontal: 20,
                 
                  alignItems: "center",
                  position: 'absolute',
                  borderRadius: 15,
                  backgroundColor: saving ? '#BCC1CA' : '#000',
                   ...Platform.select({
                      ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.4, shadowRadius: 10 },
                      android: { elevation: 4, shadowColor: "#ccc" },
                    }),
                }}
      >
        <Text style={{ color: "#fff", fontSize: size(14), fontWeight: "800" }}>
          {saving ? "Saving…" : "Save"}
        </Text>
        <Check color={"#fff"} size={18} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
}
