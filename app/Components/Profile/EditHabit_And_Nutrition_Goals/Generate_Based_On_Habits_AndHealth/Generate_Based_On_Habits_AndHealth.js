// Generate_Based_On_Habits_AndHealth.js
import { useEditNutrition } from "@/app/Context/EditNutritionContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, serverTimestamp } from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MoveLeft, MoveRight } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AccomplishGoalsPage from "./AccomplishGoalsPage";
import DesiredWeightPage from "./DesiredWeight";
import HeightWeightPage from "./HeightWeightPage";
import HowFastReachingGoalPage from "./HowFastReachingGoalPage";
import HowManyWorkOutsPage from "./HowManyWorkOutsPage";
import ProgressLine from "./ProgressLine"; // <- adjust path if needed






export default function Generate_Based_On_Habits_AndHealth() {
  const router = useRouter();

    const {
      register, present, dismiss, dismissAll,
      isS2Open, setIsS2Open,
      isS3Open, setIsS3Open,
      isS4Open, setIsS4Open,
      isS5Open, setIsS5Open,
      isS6Open, setIsS6Open,
      isS7Open, setIsS7Open,
      isS8Open, setIsS8Open,
      isS9Open, setIsS9Open,
      isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
      isTargetWeightOpen, setIsTargetWeightOpen,
      isCurrentWeightOpen, 
      setIsCurrentWeightOpen,
      isHeightComponentOpen, 
      setIsHeightComponentOpen,
      isBirthDayComponentOpen, 
      setIsBirthDayComponentOpen,
      isDailyStepsComponentOpen,
      setIsDailyStepsComponentOpen,
      isEditNutritionGoalsComponentOpen, 
      setIsEditNutritionGoalsComponentOpen,
      isGenerate_Based_On_Habits_AndHealth, 
      setIsGenerate_Based_On_Habits_AndHealth,
    } = useSheets();





    const {
        gender, setGender,
        Conheight, setConheight,
        Conweight, setConweight,
        workouts, setWorkouts,
        referral, setReferral,
        HaveYouUsedAnyOtherPlatform, setHaveYouUsedAnyOtherPlatform,
        BanticoAcurateChartPageState, setBanticoAcurateChartPageState,
        RequestNotifications, setRequestNotifications,

        // current height/weight + unit info
        ft, setFt, inch, setInch, lb, setLb,
        cm, setCm, kg, setKg,
        unitSystem, setUnitSystem,
        weightUnit, setWeightUnit,

        // goal weight selected on the ruler page
        goalWeightKg, setGoalWeightKg,
        goalWeightLb, setGoalWeightLb,
        goalWeightUnit, setGoalWeightUnit,
        setGoalWeight,

        // birthday
        year, setYear, month, setMonth, day, setDay,

        // goals
        goal, setGoal: selectGoal,
        selectedConditions, setSelectedConditions, toggleCondition, clearConditions, setConditions,

        // configs
        diabetesSettings, setDiabetesSettings,
        kidneySettings, setKidneySettings,
        heartSettings, setHeartSettings,
        habitSettings, setHabitSettings,
        HowFast, setHowFast,
        WhatsStoppingYou, setWhatsStoppingYou,
        SmokingFrequency, setSmokingFrequency,

        // diet preference (NEW)
        dietPreferenceId, setDietPreferenceId,
        AccomplishGoal, setAccomplishGoal,
        AddExerciseCalories, setAddExerciseCalories,
        RolloverCalories, setRolloverCalories,
        // helpers
        years,
    } = useEditNutrition()

























const handleSave = useCallback(async () => {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
     console.log("Not signed in", "Please log in first.");
      return;
    }
    const db = getFirestore();
    const ref = doc(db, "users", uid);

    const payload = {
      gender,
      workouts,
      weightUnit,           // "kg" | "lb"
      unitSystem,           // "metric" | "imperial"
      goalWeight: {
        kg: goalWeightKg ?? null,
        lb: goalWeightLb ?? null,
        unit: goalWeightUnit ?? null,
      },
      birthday: {
        year: year ?? null,
        month: month ?? null,
        day: day ?? null,
      },
      conditions: selectedConditions ?? [],
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload, { merge: true });
    Alert.alert("Saved", "Your profile was updated.");

    // navigate only after successful save
    router.push("/(auth)/complete");
  } catch (e) {
    console.error(e);
    Alert.alert("Save failed", e?.message ?? "Please try again.");
  }
}, [
  gender, workouts, weightUnit, unitSystem,
  goalWeightKg, goalWeightLb, goalWeightUnit,
  year, month, day, selectedConditions, router,
]);

const isFinish = step >= total;

  

  // ---- STEP STATE (1-based) ----
  const [step, setStep] = useState(1);

  // Replace these with your real step components
  const steps = useMemo(() => [
  <HowManyWorkOutsPage key="one" />, 
  <HeightWeightPage key="two" />, 
  <AccomplishGoalsPage key="three" />,
   <DesiredWeightPage key="four" />,
<HowFastReachingGoalPage key="five" />,
], 

  
[]);
  const total = steps.length;

  const goNext = () => {
    if (step >= total) {
      router.push("/(auth)/complete"); // change to your route
      return;
    }
    setStep((s) => Math.min(total, s + 1));
  };

  const goBack = () => {
    if (step <= 1) return;
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
         
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
       
      

          {/* Right: spacer matching left width */}
          <View style={{ minWidth: 60 }} />
        </View>

        {/* Progress */}
        <ProgressLine step={step} total={total} />

        {/* Body */}
        <View style={{ flex: 1 }}>{steps[step - 1]}</View>

        {/* Footer / Next */}
        <View style={{ padding: 16, zIndex: 1000, position: 'absolute' }}>
       <Pressable
  onPress={isFinish ? handleSave : goNext}
  hitSlop={8}
  style={{
    top: height(80),
    paddingVertical: 14,
    flexDirection: "row",
    width: size(140),
    left: width(60),
    height: size(50),
    paddingHorizontal: 20,
    alignItems: "center",
    position: "absolute",
    borderRadius: 15,
    backgroundColor: "#000",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 4, shadowColor: "#ccc" },
    }),
  }}
>
  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
    {isFinish ? "Finish" : "Next"}
  </Text>

  {/* Show arrow only when not finished */}
  {!isFinish ? (
    <MoveRight size={18} color="#fff" style={{ position: "absolute", right: width(5) }} />
  ) : null}
</Pressable>






             {/* Left: Back (hidden on step 1) */}
          {step > 1 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              style={{
                 top: height(80),
              paddingVertical: 14,
              flexDirection: "row",
              width: size(60),
              left: width(5),
              height: size(50),
              paddingHorizontal: 20,
              alignItems: "center",
              position: "absolute",
              borderRadius: 15,
              backgroundColor: "#EDEFF1",
             
               }}
            >
                 <MoveLeft size={25} style={{   }} />
           
            </Pressable>
          ) : (
            // Spacer to keep title centered when Back is hidden
               <Pressable
              onPress={() => {
                dismiss("Generate_Based_On_Habits_AndHealth")
              }}
              hitSlop={10}
              style={{
              top: height(80),
              paddingVertical: 14,
              flexDirection: "row",
              width: size(60),
              left: width(5),
              height: size(50),
              paddingHorizontal: 20,
              alignItems: "center",
              position: "absolute",
              borderRadius: 15,
              backgroundColor: "#EDEFF1",
             
               }}
            >
                 <MoveLeft size={25} style={{   }} />
           
            </Pressable>
          )}


        </View>
      </View>
    </>
  );
}


