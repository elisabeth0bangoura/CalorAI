// ./Cameras/Home.js
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { collection, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { useDailyLeft } from "@/app/Context/DailyLeftContext";
import { useDailyTargets } from "@/app/Context/DailyPlanProvider";
import * as Haptics from "expo-haptics";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  InteractionManager,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { height, size, width } from "react-native-responsive-sizes";
import { useSheets } from "../../Context/SheetsContext";
import RollingMetric from "../../RollingMetric";

import { Image } from "expo-image";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import TwoRowMonthlyHeatmap from "./WeeklyCalendar";

import LottieView from "lottie-react-native";
import {
  Candy,
  Coffee,
  CupSoda,
  Droplet,
  Egg,
  Flame,
  GlassWater,
  Leaf,
  Plus,
  Wheat
} from "lucide-react-native";

/* ---------- Smooth, low-churn Ring (CircularProgressBase) ---------- */
const Ring = memo(function Ring({
  value = 0,
  max = 1,
  radius = 35,
  inW = 6,
  aW = 6,
  aC = "#000",
  iC = "#D3DAE0",
  index = 0,           // optional stagger index
  animate = true,      // animate this update?
  baseDuration = 600,  // base duration, scales with delta
  children,
}) {
  const safeMax = Math.max(1, Number(max ?? 1));
  const safeVal = Math.max(0, Math.min(safeMax, Math.round(Number(value ?? 0))));

  const [prev, setPrev] = useState(safeVal); // previous to animate from
  const delta = Math.abs(safeVal - prev);
  const duration = animate
    ? Math.min(1000, Math.max(280, Math.round(baseDuration * (0.25 + delta / Math.max(1, safeMax)))))
    : 0;
  const delay = animate ? Math.min(400, index * 80) : 0;

  useEffect(() => {
    if (prev !== safeVal) setPrev(safeVal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeVal]);

  return (
    <CircularProgressBase
      initialValue={prev}
      value={safeVal}
      maxValue={safeMax}
      duration={duration}
      delay={delay}
      radius={radius}
      inActiveStrokeWidth={inW}
      activeStrokeWidth={aW}
      showProgressValue={false}
      activeStrokeColor={aC}
      inActiveStrokeColor={iC}
      clockwise
      {...(Platform.OS === "android"
        ? { renderToHardwareTextureAndroid: true }
        : { shouldRasterizeIOS: true })}
    >
      {children}
    </CircularProgressBase>
  );
});

/* ---------- Tiny progress bar (Animated width) ---------- */
const ProgressBar = memo(function ProgressBar({
  height: h = 8,
  progress = 0,
  duration = 300,
  bg = "#5BC951",
  track = "#2A2A2A",
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(progress, 100)),
      duration,
      useNativeDriver: false,
    }).start();
  }, [progress, duration, anim]);
  return (
    <View style={{ width: "100%" }}>
      <View
        style={{
          width: "100%",
          height: h,
          overflow: "hidden",
          borderRadius: h / 2,
          backgroundColor: track,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            borderRadius: h / 2,
            backgroundColor: bg,
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
});

/* ---------- Header (heavy) split out & memoized ---------- */
const HeaderView = memo(function HeaderView({
  userId,
  vals,
  maxes,
  animateRings,
  sleeping = false, // 👈 don’t render heavy stuff when sheets are open
}) {
  const [showSwiper, setShowSwiper] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Pager refs/state
  const pagerRef = useRef(null);
  const [pagerIndex, setPagerIndex] = useState(0);
  const lastHapticTsRef = useRef(0);

  // Lazy-mount heavy UI ONLY when not sleeping
  useEffect(() => {
    if (sleeping) {
      setShowSwiper(false);
      setShowHeatmap(false);
      return;
    }
    let t1 = setTimeout(() => setShowSwiper(true), 120);
    let t2;
    InteractionManager.runAfterInteractions(() => {
      t2 = setTimeout(() => setShowHeatmap(true), 300);
    });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sleeping]);

  const onPagerSelected = useCallback(({ nativeEvent }) => {
    setPagerIndex(nativeEvent.position);
    // light haptic, throttled (just in case some ROM fires multiple)
    const now = Date.now();
    if (now - lastHapticTsRef.current > 150) {
      lastHapticTsRef.current = now;
      try { Haptics.selectionAsync && Haptics.selectionAsync(); } catch {}
    }
  }, []);


    const animation = useRef(null);
  useEffect(() => {
    // You can control the ref programmatically, rather than using autoPlay
    // animation.current?.play();
  }, []);





  return (
    <View style={{ paddingTop: height(12), backgroundColor: "#fff" }}>
      {/* Heatmap (lazy / skeleton while sleeping) */}
      <View style={{ minHeight: height(8), justifyContent: "center" }}>
        {!sleeping && showHeatmap ? (
          <TwoRowMonthlyHeatmap
            db={getFirestore()}
            userId={userId}
            monthsAhead={4}
            monthsBack={0}
            gap={4}
          />
        ) : (
          <View
            style={{
              height: height(8),
              width: "90%",
              alignSelf: "center",
              backgroundColor: "#F6F7F9",
              borderRadius: 10,
            }}
          />
        )}
      </View>

      {/* Add widget */}
      <TouchableOpacity
        onPress={() => {
          if (!sleeping) Haptics.selectionAsync();
        }}
        disabled={sleeping}
        style={{
          marginLeft: width(5),
          marginTop: height(2),
          flexDirection: "row",
          alignItems: "center",
          opacity: sleeping ? 0.5 : 1,
        }}
      >
        <Plus size={16} />
        <Text style={{ marginLeft: width(2), fontSize: size(17), fontWeight: "800" }}>
          Add widget
        </Text>
      </TouchableOpacity>

      {/* PagerView (fixed height so the page can scroll vertically) */}
      {!sleeping && showSwiper ? (
        <>
          <PagerView
            ref={pagerRef}
            style={{ height: height(48), width: "100%" }}
            initialPage={0}
            onPageSelected={onPagerSelected}
            offscreenPageLimit={1}          // keep 1 neighbor alive
            pageMargin={12}                 // tiny gap between pages (helps perf feel)
            overScrollMode="never"          // Android bounce disable
            scrollEnabled
          >
            {/* Slide 1 */}
            <View key="slide-1" style={{ paddingTop: height(2) }}>
              {/* Big calories card */}
              <View
                style={{
                  height: height(20),
                  width: "90%",
                  alignSelf: "center",
                  borderRadius: 19,
                  marginTop: height(1.8),
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#151515",
                  ...(Platform.OS === "ios"
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.05,
                        shadowRadius: 10,
                      }
                    : { elevation: 2, shadowColor: "#00000030" }),
                }}
              >

                <View style={{
                   borderRadius: 19,
                  height: "100%",
                  width: "100%",
                   position: 'absolute',
                  overflow: 'hidden'
                }}>

    

                 <LottieView
                  autoPlay
                  ref={animation}
                  style={{
                    
                    width: 500,
                    height:500,
                  }} contentFit="contain"
                  // Find more Lottie files at https://lottiefiles.com/featured
                  source={require("../../../assets/CaloriesBackground.json")}
                />

                  </View>
                <View style={{ flexDirection: "row", width: "95%", alignItems: "center" }}>
                  <View style={{ marginTop: 0, marginLeft: width(5) }}>
                    <RollingMetric
                      value={vals.caloriesLeft}
                      toFixed={0}
                      color="#000"
                     
                      numberStyle={{ fontSize: size(35) }}
                    />
                    <Text
                      style={{
                        fontSize: size(13),
                        color: "#000",
                        marginLeft: width(2),
                        marginTop: height(1),
                        fontWeight: "800",
                      }}
                    >
                      Calories left
                    </Text>
                  </View>

                  <View style={{ marginTop: 0, marginLeft: width(15) }}>
                    <Ring
                      value={vals.caloriesLeft}
                      max={maxes.calories}
                      radius={60}
                      inW={9}
                      aW={9}
                      aC="#FFCF2D"
                      iC="#2A2A2A"
                      index={0}
                      animate={animateRings}
                    >
                      <Flame size={25} color="#000" />
                    </Ring>
                  </View>
                </View>
              </View>

              {/* Small cards row */}
              <View
                style={{
                  height: height(32),
                  flexDirection: "row",
                  width: "90%",
                  alignSelf: "center",
                  justifyContent: "space-between",
                }}
              >
                {/* Water */}
                <View
                  style={{
                    height: height(20),
                    width: "48%",
                    borderRadius: 20,
                    marginTop: height(2),
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <Ring
                    value={vals.waterLeft}
                    max={maxes.waterMl}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#0057FF"
                    iC="#D3DAE0"
                    index={1}
                    animate={animateRings}
                  >
                    <GlassWater size={25} color="#000" />
                  </Ring>
                  <RollingMetric
                    label="left"
                    value={vals.waterLeft}
                    unit="ml"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text style={{ marginTop: height(1), fontSize: size(13), fontWeight: "800" }}>
                    Water Left
                  </Text>
                </View>

                {/* Coffee */}
                <View
                  style={{
                    height: height(20),
                    width: "48%",
                    borderRadius: 20,
                    marginTop: height(2),
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <Ring
                    value={vals.coffeeLeft}
                    max={maxes.coffeeCups}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#C15217"
                    iC="#D3DAE0"
                    index={2}
                    animate={animateRings}
                  >
                    <Coffee size={25} color="#000" />
                  </Ring>
                  <RollingMetric
                    label="left"
                    value={vals.coffeeLeft}
                    unit="cup"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text style={{ marginTop: height(1), fontSize: size(13), fontWeight: "800" }}>
                    Coffee Left
                  </Text>
                </View>
              </View>
            </View>

            {/* Slide 2 */}
            <View key="slide-2" style={{ paddingTop: height(2) }}>
              <View
                style={{
                  flexDirection: "row",
                  height: height(20),
                  alignSelf: "center",
                  marginTop: height(1.8),
                  width: "90%",
                  justifyContent: "space-between",
                }}
              >
                {/* Protein */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.proteinLeft}
                    unit="g"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Protein Left
                  </Text>
                  <Ring
                    value={vals.proteinLeft}
                    max={maxes.proteinG}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#632EFF"
                    iC="#D3DAE0"
                    index={0}
                    animate={animateRings}
                  >
                    <Egg size={25} color="#000" />
                  </Ring>
                </View>

                {/* Carbs */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.carbsLeft}
                    unit="g"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Carbs Left
                  </Text>
                  <Ring
                    value={vals.carbsLeft}
                    max={maxes.carbsG}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#F7931A"
                    iC="#D3DAE0"
                    index={1}
                    animate={animateRings}
                  >
                    <Wheat size={25} color="#000" />
                  </Ring>
                </View>
              </View>

              {/* Health card */}
              <View
                style={{
                  marginTop: height(2),
                  height: height(20),
                  alignSelf: "center",
                  width: "90%",
                  backgroundColor: "#151515",
                  borderRadius: 15,
                  marginBottom: height(2),
                  ...(Platform.OS === "ios"
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                      }
                    : { elevation: 2, shadowColor: "#00000030" }),
                }}
              >


                    <View style={{
                   borderRadius: 15,
                  height: "100%",
                  width: "100%",
                   position: 'absolute',
                  overflow: 'hidden'
                }}>

    

                 <LottieView
                  autoPlay
                  ref={animation}
                  style={{
                    
                    width: 500,
                    height:500,
                  }} contentFit="contain"
                  // Find more Lottie files at https://lottiefiles.com/featured
                  source={require("../../../assets/HealthScoreBackground.json")}
                />

                 </View>


                <View
                  style={{
                    flexDirection: "row",
                    marginLeft: width(5),
                    marginTop: height(2),
                    alignItems: "center",
                  }}
                >


          

                  <Text style={{ fontSize: size(20), fontWeight: "800", color: "#000" }}>
                    Health Score
                  </Text>
                  <Text
                    style={{
                      position: "absolute",
                      right: width(5),
                      color: "#000",
                      fontWeight: "700",
                    }}
                  >
                    70/100
                  </Text>
                </View>

                <View style={{ marginTop: height(2), width: "90%", alignSelf: "center" }}>
                  <ProgressBar progress={60} height={8} bg="#5BC951" />
                </View>

                <Text
                  style={{
                    fontSize: size(13),
                    width: "90%",
                    marginLeft: width(5),
                    color: "#000",
                    marginTop: height(2),
                    lineHeight: height(2.5),
                  }}
                >
                  You're below your calorie, carb, and fat goals, but need to increase protein for
                  effective weight loss. Keep focusing on boosting protein intake!
                </Text>
              </View>
            </View>

            {/* Slide 3 */}
            <View key="slide-3" style={{ paddingTop: height(2) }}>
              <View
                style={{
                  flexDirection: "row",
                  height: height(20),
                  alignSelf: "center",
                  marginTop: height(1.8),
                  width: "90%",
                  justifyContent: "space-between",
                }}
              >
                {/* Fiber */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.fiberLeft}
                    unit="g"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Fiber Left
                  </Text>
                  <Ring
                    value={vals.fatLeft}
                    max={maxes.fatG}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#FDFF50"
                    iC="#D3DAE0"
                    index={0}
                    animate={animateRings}
                  >
                    <Leaf size={25} color="#000" />
                  </Ring>
                </View>

                {/* Sugar */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.sugarLeft}
                    unit="g"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Sugar Left
                  </Text>
                  <Ring
                    value={vals.sugarLeft}
                    max={maxes.sugarG}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#FFA2E2"
                    iC="#D3DAE0"
                    index={1}
                    animate={animateRings}
                  >
                    <Candy size={25} color="#000" />
                  </Ring>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  height: height(20),
                  alignSelf: "center",
                  marginTop: height(1.8),
                  width: "90%",
                  justifyContent: "space-between",
                }}
              >
                {/* Fat (sat) */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.satFatLeft}
                    unit="g"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Fat Left
                  </Text>
                  <Ring
                    value={vals.satFatLeft}
                    max={maxes.satFatG}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#FDFF50"
                    iC="#D3DAE0"
                    index={2}
                    animate={animateRings}
                  >
                    <Droplet size={25} color="#000" />
                  </Ring>
                </View>

                {/* Sodium */}
                <View
                  style={{
                    width: "48%",
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                        }
                      : { elevation: 1, shadowColor: "#00000020" }),
                  }}
                >
                  <RollingMetric
                    label="left"
                    value={vals.sodiumLeft}
                    unit="mg"
                    toFixed={0}
                    color="#000"
                    numberStyle={{ marginTop: height(1), fontSize: size(20) }}
                  />
                  <Text
                    style={{
                      fontSize: size(13),
                      marginTop: height(1),
                      marginBottom: height(2),
                      fontWeight: "800",
                    }}
                  >
                    Sodium Left
                  </Text>
                  <Ring
                    value={vals.sodiumLeft}
                    max={maxes.sodiumMg}
                    radius={35}
                    inW={6}
                    aW={6}
                    aC="#1E90FF"
                    iC="#D3DAE0"
                    index={3}
                    animate={animateRings}
                  >
                    <CupSoda size={25} color="#000" />
                  </Ring>
                </View>
              </View>
            </View>
          </PagerView>

          {/* Pagination dots (like your Swiper) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            {[0, 1, 2].map((i) =>
              i === pagerIndex ? (
                <View
                  key={`dot-${i}`}
                  style={{
                    backgroundColor: "#000",
                    width: size(40),
                    height: 8,
                    borderRadius: 4,
                    marginHorizontal: 3,
                    marginVertical: 3,
                  }}
                />
              ) : (
                <View
                  key={`dot-${i}`}
                  style={{
                    backgroundColor: "#D3DAE0",
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginHorizontal: 3,
                    marginVertical: 3,
                  }}
                />
              )
            )}
          </View>
        </>
      ) : (
        <View
          style={{
            height: height(55),
            width: "90%",
            alignSelf: "center",
            backgroundColor: "#F6F7F9",
            borderRadius: 16,
            marginTop: height(2),
          }}
        />
      )}

      <Text
        style={{
          fontSize: size(17),
          marginTop: height(2),
          marginLeft: width(5),
          fontWeight: "bold",
        }}
      >
        Recently eaten
      </Text>
      <Text style={{ marginLeft: width(5), fontSize: size(16), marginTop: height(2) }}>
        Today
      </Text>
    </View>
  );
});

/* =================== HOME =================== */
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [userId, setUserId] = useState(getAuth().currentUser?.uid ?? null);
  const [foods, setFoods] = useState([]);

  const { setCurrentItemId, setCurrentItem } = useCurrentScannedItemId();
  const { present } = useSheets();

  const { targets } = useDailyTargets();
  const { left, today } = useDailyLeft();

  // Sheets busy flag: sleep when ANY sheet is open
  const sheets = useSheets();
  const sheetsBusy =
    sheets.isS2Open || sheets.isS3Open || sheets.isS4Open || sheets.isS5Open ||
    sheets.isS6Open || sheets.isS7Open || sheets.isS8Open || sheets.isS9Open;

  /* ---------- Animation window controls ---------- */
  const [animateRings, setAnimateRings] = useState(false);
  const animateTimer = useRef(null);
  const prevValsRef = useRef(null);

  const openAnimWindow = useCallback((ms = 800) => {
    if (sheetsBusy) return; // never animate while covered
    setAnimateRings(true);
    if (animateTimer.current) clearTimeout(animateTimer.current);
    animateTimer.current = setTimeout(() => {
      setAnimateRings(false);
      animateTimer.current = null;
    }, ms);
  }, [sheetsBusy]);

  // Hard stop animations if a sheet opens
  useEffect(() => {
    if (sheetsBusy && animateTimer.current) {
      clearTimeout(animateTimer.current);
      animateTimer.current = null;
      setAnimateRings(false);
    }
  }, [sheetsBusy]);

  /* ---------- Auth + Firestore (RecentlyEaten) ---------- */
  const foodsIdsRef = useRef([]);
  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    let unsubFoods;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setFoods([]);
        foodsIdsRef.current = [];
        setUserId(null);
        setLoading(false);
        setErr("Not signed in");
        return;
      }
      setUserId(user.uid);

      // If a sheet is open, don't attach the heavy listener
      if (sheetsBusy) {
        setLoading(false);
        return;
      }

      const colRef = collection(db, "users", user.uid, "RecentlyEaten");
      unsubFoods = onSnapshot(
        colRef,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const ids = rows.map((r) => r.id).join("|");
          if (ids !== foodsIdsRef.current.join("|")) {
            foodsIdsRef.current = rows.map((r) => r.id);
            setFoods(rows);
            openAnimWindow(700); // animate rings when meals list changes
          }
          setErr(null);
          setLoading(false);
        },
        (e) => {
          console.warn("[RecentlyEaten] onSnapshot error:", e);
          setErr(String(e?.message || e));
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubFoods) unsubFoods();
      if (unsubAuth) unsubAuth();
      if (animateTimer.current) {
        clearTimeout(animateTimer.current);
        animateTimer.current = null;
      }
    };
  }, [openAnimWindow, sheetsBusy]);

  /* ---------- List item ---------- */
  const onPressFood = useCallback(
    (item) => {
      setCurrentItemId(item.id);
      setCurrentItem(item);
      present("s8");
    },
    [present, setCurrentItem, setCurrentItemId]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPressFood(item)}
        disabled={sheetsBusy}
        style={{
          height: size(80),
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 20,
          width: "90%",
          alignSelf: "center",
          flexDirection: "row",
          marginBottom: height(1),
          opacity: sheetsBusy ? 0.6 : 1,
          backgroundColor: "#fff",
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.03,
                shadowRadius: 6,
              }
            : { elevation: 1, shadowColor: "#00000020" }),
        }}
      >
        <View
          style={{
            alignItems: "center",
            width: size(50),
            borderRadius: size(50) / 2,
            justifyContent: "center",
            height: size(50),
            alignSelf: "center",
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: item.image_cloud_url }}
            style={{ height: "100%", width: "100%" }}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
          />
        </View>

        <View style={{ marginLeft: width(5), width: "90%" }}>
          <Text style={{ fontSize: size(15), fontWeight: "800", width: "70%" }} numberOfLines={1}>
            {item?.items?.[0]?.name ?? "Item"}
          </Text>

          <Text style={{ fontSize: 14, fontWeight: "bold", position: "absolute", right: width(5) }}>
            +{Math.round(Number(item?.items?.[0]?.calories_kcal || 0))} cal
          </Text>

          <Text style={{ color: "#BBC1CB", marginTop: height(0.5) }}>20.35</Text>
        </View>
      </TouchableOpacity>
    ),
    [onPressFood, sheetsBusy]
  );

  const keyExtractor = useCallback((item, i) => item?.id ?? String(i), []);

  /* ===== Memoized derived numbers for the header ===== */
  const vals = useMemo(() => {
    const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    return {
      caloriesLeft: Math.max(0, n(targets?.calories) - n(today?.caloriesToday)),
      waterLeft: Math.max(0, n(targets?.waterMl) - n(today?.waterToday)),
      coffeeLeft: Math.max(0, n(targets?.coffeeCups) - n(today?.coffeeToday)),
      proteinLeft: Math.max(0, n(targets?.proteinG) - n(today?.proteinToday)),
      carbsLeft: Math.max(0, n(targets?.carbsG) - n(today?.carbsToday)),
      fiberLeft: Math.max(0, n(targets?.fiberG) - n(today?.fiberToday)),
      fatLeft: Math.max(0, n(targets?.fatG) - n(today?.fatToday)),
      satFatLeft: Math.max(0, n(targets?.satFatG) - n(today?.fatToday)),
      sugarLeft: Math.max(0, n(targets?.sugarG) - n(today?.sugarToday)),
      sodiumLeft: Math.max(0, n(targets?.sodiumMg) - n(today?.sodiumToday)),
    };
  }, [targets, today]);

  // Open animation window when vals change (but not while sleeping)
  useEffect(() => {
    if (sheetsBusy) return;
    if (!prevValsRef.current) {
      prevValsRef.current = vals;
      return;
    }
    const prev = prevValsRef.current;
    const changed = Object.keys(vals).some((k) => vals[k] !== prev[k]);
    if (changed) openAnimWindow(900);
    prevValsRef.current = vals;
  }, [vals, openAnimWindow, sheetsBusy]);

  /* ===== Memoized max values ===== */
  const maxes = useMemo(() => {
    const atLeast1 = (x) => Math.max(1, Number(x ?? 1));
    return {
      calories: atLeast1(targets?.calories),
      waterMl: atLeast1(targets?.waterMl),
      coffeeCups: atLeast1(targets?.coffeeCups),
      proteinG: atLeast1(targets?.proteinG),
      carbsG: atLeast1(targets?.carbsG),
      fiberG: atLeast1(targets?.fiberG),
      fatG: atLeast1(targets?.fatG),
      satFatG: atLeast1(targets?.satFatG),
      sugarG: atLeast1(targets?.sugarG),
      sodiumMg: atLeast1(targets?.sodiumMg),
    };
  }, [targets]);

  return (
    <View style={{ backgroundColor: "#fff", height: "100%", width: "100%" }}>
      <Animated.FlatList
        data={foods}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <HeaderView
            userId={userId}
            vals={vals}
            maxes={maxes}
            animateRings={!sheetsBusy && animateRings}
            sleeping={sheetsBusy}
          />
        }
        ListHeaderComponentStyle={{ backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: height(18) }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}    
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={4}
        updateCellsBatchingPeriod={80}
        scrollEnabled={!sheetsBusy}
        getItemLayout={(_, index) => {
          const row = size(80) + height(1);
          return { length: row, offset: row * index, index };
        }}
      />
    </View>
  );
}
