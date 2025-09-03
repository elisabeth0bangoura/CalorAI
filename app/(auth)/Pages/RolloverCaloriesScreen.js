import { Flame } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";
import { useSteps } from "../../Context/StepsContext";

export default function RolloverCaloriesScreen({
  active = false,          // 👈 gets isActive from SignUp
  onChoose,
  maxCarry = 200,
  yesterdayGoal = 500,
  yesterdayBurn = 350,
  todayGoalBase = 500,
  carry = 150,
}) {
  const { next, prev, step } = useSteps();

  const yCalsLeft = Math.max(0, yesterdayGoal - yesterdayBurn);
  const todayGoalWithCarry = todayGoalBase + carry;



  const {
     RolloverCalories, setRolloverCalories,
  } = useOnboarding()

  // --- ANIMATION CONTROL FOR RINGS ---
  const TARGET = 60; // set your target values here (per ring if different)
  const [ring1, setRing1] = useState(0);
  const [ring2, setRing2] = useState(0);
  const [ring3, setRing3] = useState(0);

  useEffect(() => {
    let t1, t2, t3;
    if (active) {
      // small staggers feel nicer
      t1 = setTimeout(() => setRing1(TARGET), 50);
      t2 = setTimeout(() => setRing2(TARGET), 200);
      t3 = setTimeout(() => setRing3(TARGET), 350);
    } else {
      // reset so it re-animates when you return
      setRing1(0);
      setRing2(0);
      setRing3(0);
    }
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, [active]);

  const cardShadow = Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.09, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 6, shadowColor: "#00000050" },
  });

  const soft = "#F4F6FA";
  const ink = "#141518";
  const mute = "#868B94";

  return (
    <View style={{ height: "90%", alignSelf: 'center', width: "100%", backgroundColor: "#fff" }}>
      {/* Title */}
      <View style={{ marginLeft: width(5), marginTop: height(14) }}>
        <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "800", color: ink, width: "92%" }}>
          Do you want to see alternative products?
        </Text>
      </View>

      {/* Main card */}
      <View style={{ height: "50%", width: "90%", marginTop: height(8), borderRadius: 20, alignSelf: 'center', backgroundColor: '#F1F3F7' }}>
        <View style={{ width: "90%", backgroundColor: "#fff", borderRadius: 15, alignSelf: 'center', height: height(33), marginTop: height(-1), ...cardShadow }}>
          <Text style={{ fontSize: size(25), marginTop: height(3), width: "90%", marginLeft: width(5), fontWeight: "800", color: "#000" }}>
            Low Fat Milk 250 ml
          </Text>

          <View style={{ marginLeft: width(5), flexDirection: "row", alignItems: 'center', marginTop: height(2) }}>
            <View style={{ height: size(70), width: size(70), justifyContent: 'center', alignItems: 'center', borderRadius: size(70)/2, backgroundColor: '#111' }}>
              <Flame size={30} strokeWidth={3} color={'#fff'} />
            </View>
            <Text style={{ fontWeight: "800", marginLeft: width(5), fontSize: size(28), color: '#000' }}>256</Text>
          </View>

          {/* Rings */}
          <View style={{ marginLeft: width(5), marginTop: height(2), flexDirection: 'row' }}>
            <View>
              <CircularProgress
                value={ring1}           // 👈 state-driven
                radius={35}
                activeStrokeWidth={5}
                inActiveStrokeWidth={5}
                duration={900}
                progressValueColor={'#000'}
                maxValue={200}
                activeStrokeColor="#632EFF"
                inActiveStrokeColor="#E6E9EF"
                reAnimateOnValueChange   // 👈 re-run on value changes
                showProgressValue        // shows "60"
              />
            </View>

            <View style={{ marginLeft: width(10) }}>
              <CircularProgress
                value={ring2}
                radius={35}
                activeStrokeWidth={5}
                inActiveStrokeWidth={5}
                duration={900}
                progressValueColor={'#000'}
                maxValue={200}
                activeStrokeColor="#F7931A"
                inActiveStrokeColor="#E6E9EF"
                reAnimateOnValueChange
                showProgressValue
              />
            </View>

            <View style={{ marginLeft: width(10) }}>
              <CircularProgress
                value={ring3}
                radius={35}
                activeStrokeWidth={5}
                inActiveStrokeWidth={5}
                duration={900}
                progressValueColor={'#000'}
                maxValue={200}
                activeStrokeColor="#0057FF"
                inActiveStrokeColor="#E6E9EF"
                reAnimateOnValueChange
                showProgressValue
              />
            </View>
          </View>
        </View>
      </View>

      {/* Alternatives */}
      <View style={{ alignSelf: 'center', width: "90%", flexDirection: 'row', top: height(-30) }}>
        <View style={{ width: width(43), backgroundColor: "#fff", borderRadius: 15, height: height(22), marginTop: height(6), ...cardShadow }}>
          <Text style={{ fontSize: size(16), marginTop: height(5), width: "90%", textAlign: 'center', alignSelf: 'center', fontWeight: "800", color: "#000" }}>
            Unsweetened  Oat Milk (light)
          </Text>
          <Text style={{ color: '#5BC951', marginTop: height(2), alignSelf: 'center', fontSize: size(18), fontWeight: "800" }}>-30cal</Text>
          <Text style={{ color: '#000', marginTop: height(2), fontSize: size(14), alignSelf: 'center' }}>less</Text>
        </View>

        <View style={{ width: width(43), backgroundColor: "#fff", borderRadius: 15, marginLeft: width(3), height: height(22), top: height(10), ...cardShadow }}>
          <Text style={{ fontSize: size(16), marginTop: height(5), width: "90%", textAlign: 'center', alignSelf: 'center', fontWeight: "800", color: "#000" }}>
            Unsweetened Almond Milk
          </Text>
          <Text style={{ color: '#FF1B1E', marginTop: height(2), alignSelf: 'center', fontSize: size(18), fontWeight: "800" }}>+10cal</Text>
          <Text style={{ color: '#000', marginTop: height(2), fontSize: size(14), alignSelf: 'center' }}>more</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={{ position: "absolute", top: height(82), alignSelf: 'center', flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => { setRolloverCalories("no"); next(); }} activeOpacity={0.9}
          style={{ backgroundColor: "#1A1A1A", height: size(52), borderRadius: 16, alignItems: "center", justifyContent: "center", width: "45%", marginRight: width(3) }}>
          <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "800" }}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setRolloverCalories("yes"); next(); }} activeOpacity={0.9}
          style={{ backgroundColor: "#1A1A1A", height: size(52), borderRadius: 16, alignItems: "center", justifyContent: "center", width: "45%", marginLeft: width(3) }}>
          <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "800" }}>Yes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
