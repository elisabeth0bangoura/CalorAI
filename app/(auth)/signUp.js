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
import GenderFlatlist from "./Pages/GenderFlatlist";
import ProgressLine from "./ProgressLine";

import "moment/locale/de";
import BanticoAcurateChart from "./Pages/BanticoAcurateChart";
import BirthDayComponent from "./Pages/BirthDayComponent";
import DesiredWeight from "./Pages/DesiredWeight";
import DesiredWeightPart2 from "./Pages/DesiredWeightPart2";
import HaveYouUsedAnyOther from "./Pages/HaveYouUsedAnyOther";
import HeightWeightComponent from "./Pages/HeightWeightComponent";
import HowFastReachingGoal from "./Pages/HowFastReachingGoal";
import HowManyWorkouts from "./Pages/HowManyWorkouts";
import LoseMoreWIthBantico from "./Pages/LoseMoreWIthBantico";
import ReferralOptionsList from "./Pages/ReferralOptions";
import UserCurrentFocus from "./Pages/UserCurrentFocus";
// ✅ import from the CountryPhoneSheet file (NOT "./countries")

// 🔹 adjust this path to your context file

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
    BanticoAcurateChartPageState,
    setBanticoAcurateChartPageState,
    ft, setFt,
    inch, setInch,
    lb, setLb,
    cm, setCm,
    kg, setKg
  } = useOnboarding(); // <-- using onboarding context

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

  const send6Digit = (text) => {
    setSixDigit(text);
  };

  const SendNumber = async () => {
    const e164 =
      "+" + country.callingCode + (phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    try {
      const res = await axios.post(
        "https://sendauthcode-2md2a66daa-uc.a.run.app",
        { phoneNumber: e164 },
        { headers: { "Content-Type": "application/json" } }
      );
      console.log(res.data);
    } catch (err) {
      console.log(err?.response?.data || err.message);
    }
  };

  const Verify6Digit = async () => {
    const e164 =
      "+" + country.callingCode + (phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");

    await axios
      .post("https://verifyauthcode-2md2a66daa-uc.a.run.app", {
        phoneNumber: e164,
        code: SixDigit,
      })
      .then((res) => {
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
      })
      .catch((err) => {
        console.log(err);
      });
  };

  // ✅ Memoize each page component so their component types are stable (no remounts)
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

  const Page2 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <ReferralOptionsList />
      </View>
    ),
    []
  );

  const Page3 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, width: "90%", marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          Have you used any habit, nutrition, or calorie-tracking apps before?
        </Text>
        <HaveYouUsedAnyOther />
      </View>
    ),
    []
  );

const Page4 = useMemo(
  () => ({ isActive }) => (
    <View style={{ height: "100%", width: "100%" }}>
      <BanticoAcurateChart active={isActive} />
    </View>
  ),
  []
);


  const Page5 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <HeightWeightComponent />
      </View>
    ),
    []
  );

  const Page6 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <BirthDayComponent />
      </View>
    ),
    []
  );

  const Page7 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <UserCurrentFocus />
      </View>
    ),
    []
  );

  const Page8 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <DesiredWeight />
      </View>
    ),
    []
  );


  const Page9 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <DesiredWeightPart2 />
      </View>
    ),

    []
  );



  const Page10 = useMemo(
    () => () => (
      <View style={{ height: "100%", width: "100%" }}>
        <HowFastReachingGoal />
      </View>
    ),

    []
  );





const Page11 = useMemo(
  () => ({ isActive }) => (
    <View style={{ height: "100%", width: "100%" }}>
      <LoseMoreWIthBantico active={isActive} />
    </View>
  ),
  []
);












  // Pages array is now stable across renders
const PAGES = useMemo(
  () => [Page0, Page1, Page2, Page3, Page4, Page5, Page6, Page7, Page8, Page9, Page10, Page11],
  [] // no deps needed; Page* are stable
);


  const [step, setStep] = useState(0);
  const total = PAGES.length;

  // ✅ shared value for horizontal slide
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ✅ gating helper: require gender on step 0, workouts on step 1, etc.
  const canProceedFrom = (s) => {
    if (s === 0) return !!gender;
    if (s === 1) return !!workouts;
    if (s === 2) return !!referral;
    if (s === 3) return !!HaveYouUsedAnyOtherPlatform;
    if (s === 5) return !!HeightWeightComponent; // (kept as-is)
    return true;
  };

  const goToStep = (newStep) => {
    if (newStep < 0 || newStep >= total) return;
    if (!canProceedFrom(step)) return; // block leaving current step if not ready

    translateX.value = withTiming(-newStep * width(100), { duration: 300 });
    setStep(newStep);
  };

  const nextDisabled = !canProceedFrom(step);

  return (
    <>
      <StatusBar style="dark" />
      <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
        <View style={{ top: height(6), width: "100%", zIndex: 1000, position: 'absolute' }}>
          <ProgressLine step={step + 1} total={total} />
        </View>

        {/* ✅ One Animated.View holding all pages side-by-side */}
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

        <View style={{ padding: 16 }}>
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

          {step == 0 && (
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
          )}

          {step > 0 && (
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
              <ChevronLeft size={25} color={"#000"} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}
