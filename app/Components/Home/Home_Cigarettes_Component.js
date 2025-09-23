import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

/* Firebase */
import { getAuth } from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "@react-native-firebase/firestore";

export default function DailyCigarettes_Component({ onFinish }) {
  const [mode, setMode] = useState("steps"); // "steps" | "edit"
  const [step, setStep] = useState(1);
  const [dailyCigs, setDailyCigs] = useState(10);
  const [goal, setGoal] = useState(null);

  // On mount, if both baseline & target exist -> jump straight to Edit view
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const uid = getAuth().currentUser?.uid;
        if (!uid) return;
        const db = getFirestore();
        const snap = await getDoc(doc(db, "users", uid));
        const hs = snap?.data?.()?.habitSettings || {};
        const baseline = hs.cigarettesPerDayBaseline;
        const target = hs.cigarettesPerDayTarget;

        const hasBaseline = Number.isFinite(Number(baseline));
        const hasTarget = Number.isFinite(Number(target));

        if (hasBaseline) setDailyCigs(Number(baseline));
        if (hasTarget) setGoal(Number(target));

        if (hasBaseline && hasTarget) {
          setMode("edit"); // skip steps if already configured
        }
      } catch (e) {
        // fail silently; wizard will show
      }
    };
    loadExisting();
  }, []);

  /* ===== Progress Bar (animated, used in steps mode) ===== */
  const progressAnim = useRef(new Animated.Value(0)).current;
  const totalSteps = 2;

  useEffect(() => {
    if (mode !== "steps") return;
    Animated.timing(progressAnim, {
      toValue: step / totalSteps,
      duration: 450,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step, mode]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  /* ===== Utilities ===== */
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  /* ===== Reusable Stepper ===== */
  const Stepper = ({ value, setValue, min = 0, max = 60 }) => {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);

    const onChangeText = (val) => {
      const onlyNums = val.replace(/[^0-9]/g, "");
      const parsed = onlyNums === "" ? 0 : parseInt(onlyNums, 10);
      setText(onlyNums);
      setValue(clamp(Number.isNaN(parsed) ? 0 : parsed, min, max));
    };

    const change = (d) => setValue((v) => clamp(v + d, min, max));

    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => change(-1)}
          disabled={value <= min}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value <= min ? "#C7C9CC" : "#000",
            marginRight: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: size(20), fontWeight: "700" }}>–</Text>
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={onChangeText}
          keyboardType={Platform.select({ ios: "number-pad", android: "numeric" })}
          maxLength={3}
          placeholder="0"
          placeholderTextColor="#9AA0A6"
          style={{
            flexGrow: 1,
            textAlign: "center",
            fontSize: size(22),
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "#E0E3E7",
            borderRadius: 12,
          }}
        />

        <TouchableOpacity
          onPress={() => change(1)}
          disabled={value >= max}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value >= max ? "#C7C9CC" : "#000",
            marginLeft: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: size(20), fontWeight: "700" }}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /* ===== Step 1 ===== */
  const renderStep1 = () => (
    <View style={{ marginTop: height(4) }}>
      {/* Progress bar */}
      <View style={{ height: 4, width: "100%", backgroundColor: "#F2F2F7" }}>
        <Animated.View
          style={{
            height: "100%",
            width: progressWidth,
            backgroundColor: "#000",
            borderRadius: 4,
          }}
        />
      </View>

      <View style={{ marginTop: height(6), marginHorizontal: width(8), alignItems: "center" }}>
        <Text style={{ fontSize: size(24), fontWeight: "700", textAlign: "center", marginBottom: height(2) }}>
          How many cigarettes do you smoke daily?
        </Text>
        <Text style={{ fontSize: size(16), color: "#5F6368", textAlign: "center", lineHeight: height(2.5) }}>
          This helps us understand your habit so we can guide you better.
        </Text>
      </View>

      <View
        style={{
          marginTop: height(6),
          marginHorizontal: width(10),
          padding: width(5),
          borderRadius: 16,
          backgroundColor: "#fff",
          shadowColor: "#000",
        }}
      >
        <Text style={{ fontSize: size(14), color: "#5F6368", marginBottom: height(2) }}>
          Cigarettes per day
        </Text>
        <Stepper value={dailyCigs} setValue={setDailyCigs} min={0} max={60} />
      </View>

      <TouchableOpacity
        onPress={() => setStep(2)}
        style={{
          position: "absolute",
          left: width(5),
          right: width(5),
          top: height(75),
          paddingVertical: 16,
          borderRadius: 18,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "700" }}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  /* ===== Step 2 ===== */
  const renderStep2 = () => {
    const recommended = Math.max(0, dailyCigs - 2);
    return (
      <View style={{ marginTop: height(4) }}>
        {/* Progress bar */}
        <View style={{ height: 4, width: "100%", backgroundColor: "#F2F2F7" }}>
          <Animated.View
            style={{
              height: "100%",
              width: progressWidth,
              backgroundColor: "#000",
              borderRadius: 4,
            }}
          />
        </View>

        <View style={{ marginTop: height(6), marginHorizontal: width(8), alignItems: "center" }}>
          <Text style={{ fontSize: size(24), fontWeight: "700", textAlign: "center", marginBottom: height(2) }}>
            Set your daily goal
          </Text>
          <Text style={{ fontSize: size(16), color: "#5F6368", textAlign: "center", lineHeight: height(2.5) }}>
            Try aiming a little lower than your current average ({dailyCigs}/day).
          </Text>
        </View>

        <View
          style={{
            marginTop: height(6),
            marginHorizontal: width(10),
            padding: width(5),
            borderRadius: 16,
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontSize: size(14), color: "#5F6368", marginBottom: height(2) }}>
            Goal (cigarettes per day)
          </Text>
          <Stepper value={goal ?? recommended} setValue={setGoal} min={0} max={dailyCigs} />

          <TouchableOpacity
            onPress={() => setGoal(recommended)}
            style={{
              marginTop: height(2),
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: "#000",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: size(14), fontWeight: "600" }}>
              Use suggested goal: {recommended}/day
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            position: "absolute",
            left: width(5),
            right: width(5),
            top: height(75),
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={{
              paddingVertical: 16,
              borderRadius: 15,
              backgroundColor: "#EDEFF1",
              height: size(50),
              paddingHorizontal: 20,
              left: width(5),
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={"#000"} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              const uid = getAuth().currentUser?.uid;
              const g = goal ?? recommended;
              if (uid) {
                const db = getFirestore();
                await setDoc(
                  doc(db, "users", uid),
                  {
                    habitSettings: {
                      cigarettesPerDayTarget: g,
                      cigarettesPerDayBaseline: dailyCigs,
                    },
                  },
                  { merge: true }
                );
              }
              onFinish && onFinish({ dailyCigs, goal: g });
              setMode("edit"); // switch to Edit after saving
            }}
            style={{
              width: size(160),
              paddingVertical: 16,
              borderRadius: 15,
              backgroundColor: "#000",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.32,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "700" }}>
              Finish
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ===== Edit View (shown if values already exist, or after Finish) ===== */
  const renderEditView = () => (
    <View style={{ width: "100%", height: "100%" }}>
      <Text
        style={{
          fontSize: size(25),
          fontWeight: "800",
          marginLeft: width(5),
          marginTop: height(5),
        }}
      >
        Edit Smoking Plan
      </Text>

      <Text
        style={{
          fontSize: size(16),
          marginLeft: width(5),
          marginTop: height(2),
          lineHeight: height(2.5),
          width: "90%",
          color: "#000",
        }}
      >
        Adjust your daily baseline and goal anytime. Changes save to your profile.
      </Text>

      {/* Card: Baseline */}
      <View
        style={{
          marginTop: height(4),
          marginHorizontal: width(5),
          padding: width(4),
          borderRadius: 16,
          backgroundColor: "#fff",

        }}
      >
        <Text style={{ fontSize: size(14), color: "#5F6368", marginBottom: height(1.5) }}>
          Baseline (average per day)
        </Text>
        <Stepper value={dailyCigs} setValue={setDailyCigs} min={0} max={60} />
      </View>

      {/* Card: Goal */}
      <View
        style={{
          marginTop: height(2),
          marginHorizontal: width(5),
          padding: width(4),
          borderRadius: 16,
          backgroundColor: "#fff",

        }}
      >
        <Text style={{ fontSize: size(14), color: "#5F6368", marginBottom: height(1.5) }}>
          Goal (cigarettes per day)
        </Text>
        <Stepper value={goal ?? 0} setValue={setGoal} min={0} max={dailyCigs || 60} />
      </View>

      {/* Buttons */}
      <View
        style={{
          position: "absolute",
          left: width(5),
          right: width(5),
          top: height(75),
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => setMode("steps")}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: "#EDEFF1",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Back to Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            const uid = getAuth().currentUser?.uid;
            const g = clamp(goal ?? 0, 0, dailyCigs || 60);
            if (uid) {
              const db = getFirestore();
              await setDoc(
                doc(db, "users", uid),
                {
                  habitSettings: {
                    cigarettesPerDayTarget: g,
                    cigarettesPerDayBaseline: dailyCigs,
                  },
                },
                { merge: true }
              );
            }
            onFinish && onFinish({ dailyCigs, goal: g });
          }}
          style={{
      
            
                backgroundColor: "#151515",
                height: size(50),
                paddingHorizontal: 20,
              
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.32,
                shadowRadius: 8,
                elevation: 5,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // If already configured -> Edit view; otherwise show wizard steps
  if (mode === "edit") return renderEditView();
  return step === 1 ? renderStep1() : renderStep2();
}
