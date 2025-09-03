// app/(auth)/AuthHome.jsx
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer } from "expo-video";
import { useRef, useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

// Firebase v23 (namespaced)
import firestore, { doc, getFirestore, setDoc } from "@react-native-firebase/firestore";

import { Image } from "expo-image";
import { useOnboarding } from "../../Context/OnboardingContext";
import AppBlurBottom from "../AppBlurBottom";
import { googleSignIn } from "../GoogleSignUp/googleSignIn";
import { signUpWithApple } from "../signUpWithApple";


import { getAuth } from '@react-native-firebase/auth';







export default function SignUpFinishScreen() {
  globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;


   const auth = getAuth();
  const user = auth.currentUser;


  const router = useRouter();
  const [loading, setLoading] = useState({ apple: false, google: false, email: false });
  const lottieRef = useRef(null);

  const tap = async (fn) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return fn?.();
  };




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
  } = useOnboarding()


  const decideNext = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const snap = await firestore().collection("users").doc(user.uid).get();
      const completed = !!snap.data()?.onboardingCompleted;
      router.replace(completed ? "/(tabs)" : "/(auth)/signUp");
    } catch {
      router.replace("/(auth)/signUp");
    }
  };

  const onApple = async () => {
    if (loading.apple) return;
    setLoading((s) => ({ ...s, apple: true }));
    try {
      const userCred = await signUpWithApple();
      if (userCred) {
        const user = userCred.user ?? auth().currentUser ?? null;
        const email = user?.email ?? "";
        const uid = user?.uid ?? "";
       
      const db = getFirestore();
      await setDoc(
        doc(db, 'users', user.uid),           // <-- users/{uid}
        {

        updatedAt: new Date().toString(),                       // pass anything else you want to store
       email: email,
        uid: uid,
        gender: gender,
        workouts: workouts,
        referral:referral,
        HaveYouUsedAnyOtherPlatform: HaveYouUsedAnyOtherPlatform,
        RequestNotifications: RequestNotifications,

        // current height/weight + unit info
      ft: ft, 
        inch: inch, 
        lb: lb,
        cm: cm, 
        kg: kg,
        unitSystem: unitSystem,
        weightUnit: weightUnit,

        // goal weight selected on the ruler page
        goalWeightKg: goalWeightKg,
        goalWeightLb: goalWeightLb,
        goalWeightUnit: goalWeightUnit,
        

        // birthday
        year: year,
         month: month, 
         day: day,

        // goals
        goal: goal,
        selectedConditions: selectedConditions, 

        // configs
        diabetesSettings: diabetesSettings,
        kidneySettings: kidneySettings,
        heartSettings: heartSettings,
        habitSettings: habitSettings,
        HowFast: HowFast,
        WhatsStoppingYou: WhatsStoppingYou,
            SmokingFrequencyId: SmokingFrequency.id,
          SmokingFrequencyLabel: SmokingFrequency.label, 
           SmokingFrequencyValue: SmokingFrequency.value,

        // diet preference (NEW)
        dietPreferenceId: dietPreferenceId,
        AccomplishGoal: AccomplishGoal,
        AddExerciseCalories: AddExerciseCalories,
        RolloverCalories: RolloverCalories, 
    },
    { merge: true }
  );


  router.replace("/(tabs)")
  


      }
    } catch (e) {
      Alert.alert("Apple Sign-in failed", e?.message || "Please try again.");
    } finally {
      setLoading((s) => ({ ...s, apple: false }));
    }
  };

  const onGoogle = async () => {
    if (loading.google) return;
    setLoading((s) => ({ ...s, google: true }));
    try {
      const cred = await googleSignIn(); // returns { userCredential }
      if (cred) {
        const user = cred?.userCredential?.user ?? auth().currentUser ?? null;
        const email = user?.email ?? "";
        const uid = user?.uid ?? "";



  const db = getFirestore();
  await setDoc(
    doc(db, 'users', user.uid),           // <-- users/{uid}
    {

        updatedAt: new Date().toString(),                       // pass anything else you want to store
       email: email,
        uid: uid,
        gender: gender,
        workouts: workouts,
        referral:referral,
        HaveYouUsedAnyOtherPlatform: HaveYouUsedAnyOtherPlatform,
        RequestNotifications: RequestNotifications,

        // current height/weight + unit info
      ft: ft, 
        inch: inch, 
        lb: lb,
        cm: cm, 
        kg: kg,
        unitSystem: unitSystem,
        weightUnit: weightUnit,

        // goal weight selected on the ruler page
        goalWeightKg: goalWeightKg,
        goalWeightLb: goalWeightLb,
        goalWeightUnit: goalWeightUnit,
        

        // birthday
        year: year,
         month: month, 
         day: day,

        // goals
        goal: goal,
        selectedConditions: selectedConditions, 

        // configs
        diabetesSettings: diabetesSettings,
        kidneySettings: kidneySettings,
        heartSettings: heartSettings,
        habitSettings: habitSettings,
        HowFast: HowFast,
        WhatsStoppingYou: WhatsStoppingYou,
            SmokingFrequencyId: SmokingFrequency.id,
          SmokingFrequencyLabel: SmokingFrequency.label, 
           SmokingFrequencyValue: SmokingFrequency.value,

        // diet preference (NEW)
        dietPreferenceId: dietPreferenceId,
        AccomplishGoal: AccomplishGoal,
        AddExerciseCalories: AddExerciseCalories,
        RolloverCalories: RolloverCalories, 
    },
    { merge: true }
  );


  router.replace("/(tabs)")
  
     
       /* router.push({
          pathname: "/(auth)/signUp",
          params: { Email: email, method: "google", uid },
        }); */
      }
    } catch (e) {
      if (e?.message !== "canceled") {
        Alert.alert("Google Sign-in failed", e?.message || "Please try again.");
      }
    } finally {
      setLoading((s) => ({ ...s, google: false }));
    }
  };

  const onEmail = async () => {
    if (loading.email) return;
    setLoading((s) => ({ ...s, email: true }));
    try {
      router.replace("/(auth)/Login");
    } finally {
      setLoading((s) => ({ ...s, email: false }));
    }
  };

  // 🎥 expo-video player
  const source = require("../../../assets/AnimationSignUp.mov");
  const player = useVideoPlayer(source, (p) => {
    p.audioMixingMode = "mixWithOthers";
    p.muted = true;
    p.volume = 0;
    p.loop = true;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = false;
    p.play();
  });

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <StatusBar style="dark" />

      {/* soft gradient for legibility */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height(28),
          backgroundColor: "transparent",
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.0)" }} />
        <View style={{ height: "70%", backgroundColor: "rgba(255,255,255,0.9)" }} />
      </View>

      {/* Headline */}
      <Text
        style={{
          fontSize: size(34),
          position: "absolute",
          width: "85%",
          top: height(14),
          zIndex: 1000,
          fontWeight: "800",
          alignSelf: "center",
          lineHeight: size(38),
          color: "#111",
          textShadowColor: "rgba(0,0,0,0.06)",
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }}
      >
        Sign up to save your progress
      </Text>

      {/* Actions */}
      <View
        style={{
          position: "absolute",
          alignSelf: "center",
          zIndex: 1000,
          bottom: height(12),
          width: "100%",
        }}
      >
        <TouchableOpacity
          onPress={onApple}
          disabled={loading.apple}
          style={{
            height: size(60),
            alignSelf: "center",
            marginTop: height(2),
            borderWidth: 1,
            borderColor: "#999",
            width: "90%",
            justifyContent: "center",
            borderRadius: size(16),
            paddingHorizontal: size(20),
            alignItems: "center",
            flexDirection: "row",
            opacity: loading.apple ? 0.6 : 1,
          }}
        >
          <View style={{ height: size(15), marginRight: width(3), width: size(15) }}>
            <Image
              source={require("../../../assets/brands/Apple_Black.png")}
              style={{ height: "100%", width: "100%" }}
            />
          </View>

          <Text style={{ fontSize: size(14), fontWeight: "800" }}>Sign up with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onGoogle}
          disabled={loading.google}
          style={{
            height: size(60),
            marginTop: height(3),
            alignSelf: "center",
            justifyContent: "center",
            width: "90%",
            borderRadius: size(16),
            paddingHorizontal: size(20),
            alignItems: "center",
            flexDirection: "row",
            backgroundColor: "#151515",
            opacity: loading.google ? 0.6 : 1,
            ...Platform.select({
              ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.5, shadowRadius: 10 },
              android: { elevation: 8, shadowColor: "#ccc" },
            }),
          }}
        >
          <View style={{ height: size(15), width: size(15) }}>
            <Image
              source={require("../../../assets/brands/google.png")}
              style={{ height: "100%", width: "100%" }}
            />
          </View>
          <Text numberOfLines={1} style={{ fontSize: size(14), fontWeight: "800", marginLeft: width(1), color: "#fff" }}>
            Sign Up with Google
          </Text>
        </TouchableOpacity>
      </View>

      <AppBlurBottom />
    </View>
  );
}
