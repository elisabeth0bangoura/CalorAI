// app/(auth)/signUp.jsx
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, ChevronLeft } from "lucide-react-native";
import "moment/locale/de";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogBox, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { height, size, width } from "react-native-responsive-sizes";

import { useCountryPhoneSheet } from "../Context/CountryPhoneSheetContext";
import { useOnboarding } from "../Context/OnboardingContext";
import { useSteps } from "../Context/StepsContext";

import AccomplishGoalsScreen from "./Pages/AccomplishGoalsScreen";
import AddExerciseCaloriesScreen from "./Pages/AddExerciseCaloriesScreen";
import AllDoneGeneratePlanScreen from "./Pages/AllDoneGeneratePlanScreen";
import BanticoAcurateChart from "./Pages/BanticoAcurateChart";
import BirthDayComponent from "./Pages/BirthDayComponent";
import DesiredWeight from "./Pages/DesiredWeight";
import DesiredWeightPart2 from "./Pages/DesiredWeightPart2";
import DietPreferenceScreen from "./Pages/DietPreferenceScreen";
import GenderFlatlist from "./Pages/GenderFlatlist";
import HaveYouUsedAnyOther from "./Pages/HaveYouUsedAnyOther";
import HeightWeightComponent from "./Pages/HeightWeightComponent";
import HowFastReachingGoal from "./Pages/HowFastReachingGoal";
import HowManyWorkouts from "./Pages/HowManyWorkouts";
import LoseMoreWIthBantico from "./Pages/LoseMoreWIthBantico";
import PlanGeneratingScreen from "./Pages/PlanGeneratingScreen";
import PlanReadyScreen from "./Pages/PlanReadyScreen";
import ProgressCompareScreen from "./Pages/ProgressCompareScreen";
import ReferralOptionsList from "./Pages/ReferralOptions";
import RequestNotificationsScreen from "./Pages/RequestNotificationsScreen";
import RolloverCaloriesScreen from "./Pages/RolloverCaloriesScreen";
import AuthHomeFinish from "./Pages/SIgnUpFinishScreen";
import SmokingFrequencyScreen from "./Pages/SmokingFrequencyScreen";
import TrustIntroScreen from "./Pages/TrustIntroScreen";
import UserCurrentFocus from "./Pages/UserCurrentFocus";
import WhatsStopingYou from "./Pages/WhatsStopingYou";
import ProgressLine from "./ProgressLine";

// NEW setup screens
import HabitSetupScreen from "./Pages/HabitSetupScreen";
import HealthSetupScreen from "./Pages/HealthSetupScreen";

// Goal routing groups
const WEIGHT_GOALS = ["lose", "gain", "maintain"];
const HEALTH_GOALS = ["diabetesPlan", "kidneyPlan", "heartPlan", "trackhealth"];
const HABIT_GOALS  = ["reduceCoffee", "stopSmoking"];

export default function SignUp() {
  LogBox.ignoreAllLogs(true);

  const params = useLocalSearchParams();
  const Email = params?.Email;
  const Password = params?.Password;
  const method = params?.method;

  const router = useRouter();
  const animation = useRef(null);

  const {
    gender,
    workouts,
    referral,
    HaveYouUsedAnyOtherPlatform,
    ft, setFt,
    inch, setInch,
    lb, setLb,
    cm, setCm,
    kg, setKg,

    // selection state
    goal,
    selectedConditions,
  } = useOnboarding();

  const { country, setCountry, phone, setPhone } = useCountryPhoneSheet();
  const [PhoneNumber, setPhoneNumber] = useState(phone);
  const [SixDigit, setSixDigit] = useState("");

  const fullText = "Your space to test ideas, get feedback, and move fast.";
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (index < fullText.length) {
          const next = prev + fullText.charAt(index);
          index++;
          return next;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const send6Digit = (text) => setSixDigit(text);

  const SendNumber = async () => {
    const e164 = "+" + country.callingCode + (phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    try {
      await axios.post(
        "https://sendauthcode-2md2a66daa-uc.a.run.app",
        { phoneNumber: e164 },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.log(err?.response?.data || err.message);
    }
  };

  const Verify6Digit = async () => {
    const e164 = "+" + country.callingCode + (phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    try {
      const res = await axios.post(
        "https://verifyauthcode-2md2a66daa-uc.a.run.app",
        { phoneNumber: e164, code: SixDigit }
      );
      if (res.data.success) {
        router.replace({
          pathname: "/(auth)/signUp2",
          params: {
            Email: Email,
            Phonenumber: e164,
            Password: Password,
            UserName: Firstname + " " + Lastname,
          },
        });
      } else {
        console.log("Invalid verification code");
      }
    } catch (err) {
      console.log(err);
    }
  };

  // --------- Pages (each receives `isActive`) ---------
  const Page0 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          What's your Gender?
        </Text>
        <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
          We’ll use this to personalize your plan.
        </Text>
        <GenderFlatlist />
      </View>
    ),
    []
  );

  const Page1 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          How often do you work out each week?
        </Text>
        <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
          This helps us tailor your plan to match your routine.
        </Text>
        <HowManyWorkouts />
      </View>
    ),
    []
  );

  const Page2  = useMemo(() => () => <View style={{ height: "100%", width: "100%" }}><ReferralOptionsList /></View>, []);
  const Page3  = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <Text style={{ fontSize: 28, width: "90%", marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
        Have you used any habit, nutrition, or calorie-tracking apps before?
      </Text>
      <HaveYouUsedAnyOther />
    </View>
  ), []);

  const Page4  = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><BanticoAcurateChart active={isActive} /></View>, []);
  const Page5  = useMemo(() => ({ isActive })  => <View style={{ height: "100%", width: "100%" }}><HeightWeightComponent active={isActive} /></View>, []);
  const Page6  = useMemo(() => ({ isActive })  => <View style={{ height: "100%", width: "100%" }}><BirthDayComponent active={isActive} /></View>, []);
  const Page7  = useMemo(() =>({ isActive })  => <View style={{ height: "100%", width: "100%" }}><UserCurrentFocus active={isActive} /></View>, []);

  // Branch screens
  const WeightA = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <DesiredWeight />
    </View>
  ), []);

  const WeightB = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <DesiredWeightPart2 />
    </View>
  ), []);

  const WeightC = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <HowFastReachingGoal />
    </View>
  ), []);

  const HealthPage = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <HealthSetupScreen
        goalIds={
          (selectedConditions?.length ?? 0) > 0
            ? selectedConditions
            : goal
            ? [goal]
            : []
        }
      />
    </View>
  ), [goal, selectedConditions]);

  const HabitPage = useMemo(() => () => (
    <View style={{ height: "100%", width: "100%" }}>
      <HabitSetupScreen goalId={goal} />
    </View>
  ), [goal]);

  const Page11 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><LoseMoreWIthBantico active={isActive} /></View>, []);
  const Page12 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><WhatsStopingYou active={isActive} /></View>, []);
  const Page13 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><SmokingFrequencyScreen active={isActive} /></View>, []);
  const Page14 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><DietPreferenceScreen active={isActive} /></View>, []);
  const Page15 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><AccomplishGoalsScreen active={isActive} /></View>, []);
  const Page16 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><ProgressCompareScreen active={isActive} /></View>, []);

  const Page17 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><TrustIntroScreen active={isActive} /></View>, []);
  const Page18 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><AddExerciseCaloriesScreen active={isActive} /></View>, []);
  const Page19 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><RolloverCaloriesScreen active={isActive} /></View>, []);
  const Page20 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><RequestNotificationsScreen active={isActive} /></View>, []);
  const Page21 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><AllDoneGeneratePlanScreen active={isActive} /></View>, []);
  const Page22 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><PlanGeneratingScreen active={isActive} /></View>, []);
  const Page23 = useMemo(() => ({ isActive }) => <View style={{ height: "100%", width: "100%" }}><PlanReadyScreen active={isActive} /></View>, []);

  const FinishPage = useMemo(
    () => ({ isActive }) => (
      <View style={{ height: "100%", width: "100%" }}>
        <AuthHomeFinish active={isActive} />
      </View>
    ),
    []
  );

  // --- Flow detection
  const isWeightFlow   = WEIGHT_GOALS.includes(goal);
  const isHabitFlow    = HABIT_GOALS.includes(goal);
  const hasConditions  = (selectedConditions?.length ?? 0) > 0;
  const isHealthFlow   = hasConditions || HEALTH_GOALS.includes(goal);

  // Order of pages
  const PAGES = useMemo(() => {
    const base = [Page0, Page1, Page2, Page3, Page4, Page5, Page6, Page7];

    const branch = [];
    if (isHealthFlow) branch.push(HealthPage);
    if (isHabitFlow)  branch.push(HabitPage);
    if (isWeightFlow) branch.push(WeightA, WeightB, WeightC);

    const tail = [
      Page11, Page12, Page13, Page14, Page15, Page16,
      Page17, Page18, Page19, Page20, Page21, Page22, Page23, FinishPage,
    ];

    return [...base, ...branch, ...tail];
  }, [isHealthFlow, isHabitFlow, isWeightFlow, HealthPage, HabitPage, WeightA, WeightB, WeightC]);

  // Steps wiring
  const { step, setStep } = useSteps();
  const total = PAGES.length;

  // Compute which steps should HIDE the footer
  const hiddenNavSteps = useMemo(() => {
    // Add full-screen pages here (no footer buttons)
    const hideNavForPages = [Page18, Page19, Page20, FinishPage];
    const idxSet = new Set();
    hideNavForPages.forEach((Pg) => {
      const idx = PAGES.indexOf(Pg);
      if (idx !== -1) idxSet.add(idx);
    });
    return idxSet;
  }, [PAGES, Page18, Page19, Page20, FinishPage]);

  // Horizontal pager animation
  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    if (step >= total) setStep(total - 1);
    translateX.value = withTiming(-step * width(100), { duration: 300 });
  }, [step, total, setStep, translateX]);

  // Validation to gate "Next"
  const canProceedFrom = (s) => {
    if (s === 0) return !!gender;
    if (s === 1) return !!workouts;
    if (s === 2) return !!referral;
    if (s === 3) return !!HaveYouUsedAnyOtherPlatform;
    if (s === 7) return !!goal || (selectedConditions?.length ?? 0) > 0;
    return true;
  };

  const goToStep = (newStep) => {
    if (newStep < 0 || newStep >= total) return;
    if (!canProceedFrom(step)) return;
    setStep(newStep);
  };

  const nextDisabled = !canProceedFrom(step);
  const footerHidden = hiddenNavSteps.has(step);

  return (
    <>
      <StatusBar style="dark" />
      <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
        <View style={{ top: height(6), width: "100%", zIndex: 1000, position: "absolute" }}>
          <ProgressLine step={Math.min(step + 1, total)} total={total} />
        </View>

        {/* Horizontal pager */}
        <Animated.View
          style={[
            {
              flexDirection: "row",
              width: `${100 * total}%`,
              flex: 1,
            },
            animatedStyle,
          ]}
        >
          {PAGES.map((Page, i) => (
            <View key={i} style={{ width: width(100) }}>
              <Page isActive={i === step} />
            </View>
          ))}
        </Animated.View>

        {/* Footer navigation */}
        {!footerHidden && (
          <View style={{ padding: 16 }}>
            {/* NEXT */}
            <TouchableOpacity
              onPress={() => goToStep(step + 1)}
              disabled={nextDisabled}
              accessibilityState={{ disabled: nextDisabled }}
              style={{
                position: "absolute",
                backgroundColor: "#151515",
                height: size(50),
                paddingHorizontal: 20,
                right: width(5),
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                bottom: height(12),
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.32,
                shadowRadius: 8,
                elevation: 5,
                opacity: nextDisabled ? 0.4 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: size(15), fontWeight: "700", marginRight: width(3) }}>
                  {step === total - 1 ? "Finish" : "Next"}
                </Text>
                <ArrowRight size={20} color={"#fff"} />
              </View>
            </TouchableOpacity>

            {/* BACK (to AuthHome on first step) */}
            {step === 0 ? (
              <TouchableOpacity
                onPress={() => router.replace("/(auth)/AuthHome")}
                style={{
                  position: "absolute",
                  backgroundColor: "#EDEFF1",
                  height: size(50),
                  paddingHorizontal: 20,
                  left: width(5),
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  bottom: height(12),
                }}
              >
                <ChevronLeft size={25} color={"#000"} />
              </TouchableOpacity>
            ) : (
              step > 0 && (
                <TouchableOpacity
                  onPress={() => goToStep(step - 1)}
                  style={{
                    position: "absolute",
                    backgroundColor: "#EDEFF1",
                    height: size(50),
                    paddingHorizontal: 20,
                    left: width(5),
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    bottom: height(12),
                  }}
                >
                   <MoveLeft size={25} style={{   }} />
                </TouchableOpacity>
              )
            )}
          </View>
        )}
      </View>
    </>
  );
}
