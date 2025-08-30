// ./Cameras/ScanFood_PageAfterScan.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";

import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import * as LucideIcons from "lucide-react-native";
import { ArrowLeft, Flame } from "lucide-react-native";
import CircularProgress from "react-native-circular-progress-indicator";
import Animated, {
  interpolate,
  Easing as REAEasing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import LoadingPage from "./LoadingPage";


/* ---------------- Mini ring ---------------- */
function MiniRing({
  value,
  color,
  radius = 40,
  duration = 2000,
  maxValue = 200,
  isS3Open,
  strokeWidth = 16,
}) {
  const progressRef = useRef(null);
  const sv = useSharedValue(0);
  const [display, setDisplay] = useState("0");

  useDerivedValue(() => {
    runOnJS(setDisplay)(String(Math.round(sv.value)));
  }, [sv]);

  const start = useCallback(() => {
    try {
      progressRef.current?.reAnimate?.(0, value, duration);
    } catch {
      progressRef.current?.reAnimate?.();
      progressRef.current?.play?.();
    }
    sv.value = 0;
    sv.value = withTiming(value, { duration, easing: REAEasing.linear });
  }, [value, duration, sv]);

  useEffect(() => {
    start();
  }, [start, isS3Open]);

  const DIAMETER = radius * 2;

  return (
    <View style={{ alignSelf: "center", width: DIAMETER, height: DIAMETER, position: "relative" }}>
      <CircularProgress
        ref={progressRef}
        value={value}
        initialValue={0}
        maxValue={maxValue}
        radius={radius}
        duration={duration}
        activeStrokeColor={color}
        activeStrokeWidth={strokeWidth}
        inActiveStrokeColor="#EFF3F7"
        inActiveStrokeWidth={strokeWidth}
        showProgressValue={false}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: size(18), fontWeight: "800", color: "#000" }}>{display}</Text>
      </View>
    </View>
  );
}

/* -------------- Parallax header sizes -------------- */
const { width: SCREEN_WIDTH, height: SCREEN_H } = Dimensions.get("window");
const IMG_HEIGHT = Math.round(SCREEN_H * 0.35);
































export default function PageAfterScan() {

    const { imageUrl, cloudUrl, result, raw, logs, list, partial,  title, calories, protein, carbs, fat, sugar,
    fiber,
    sodium,
    scannedAt,
    formatScannedAt,
    healthScore,
      scanBusy, // 👈 global flag from context
    alternatives,
     } = useScanResults();

    

  const insets = useSafeAreaInsets();
  const { isS3Open, present, dismiss } = useSheets();

const [showLoading, setShowLoading] = useState(true);
const [ready, setReady] = useState(false);


  
  // at the top of PageAfterScan (with your other hooks)
const ingredients = React.useMemo(
  () => (Array.isArray(list) ? list.filter(Boolean) : []),
  [list]
);
  const hasAnything = useMemo(() => {
    const items = list ?? [];
    return items.length > 0 || (partial?.scan_summary?.ingredients?.length ?? 0) > 0;
  }, [list, partial]);

// when sheet opens, reset loader
useEffect(() => {
  if (isS3Open) {
    setShowLoading(true);
    setReady(false);
  }
}, [isS3Open]);

// when data is in place, flip ready=true
useEffect(() => {
  if (hasAnything) {
    setReady(true);
  }
}, [hasAnything]);





  const FAB_H = size(58);
  const bottomPad = (insets?.bottom ?? 0) + FAB_H + height(10);

  /* -------- Parallax bits (Reanimated) -------- */
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT],
            [2, 1, 1]
          ),
        },
      ],
    };
  });

  const topBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, IMG_HEIGHT * 0.6], [0, 1]),
    };
  });

  const headerUri =
    partial?.scan_summary?.image_url ??
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1600&auto=format&fit=crop";

  // put this array near the top of the component (or inline as shown below)
  const macros = [
    { value: 60,  color: "#222", icon: "Heart", iconColorBg: "#fff", IconCOlor: "#000", label: "Health Score", amt: healthScore+"/10" },
    { value: 80,  color: "#fff", icon: "Sprout", iconColorBg: "#222", IconCOlor: "#fff", label: "Fiber",   amt: fiber+"g" },
    { value: 120, color: "#fff", icon: "Wheat", iconColorBg: "#222", IconCOlor: "#fff", label: "Sugar",   amt: sugar+"g" },
    { value: 90,  color: "#fff",  icon: "Droplet",  iconColorBg: "#222", IconCOlor: "#fff", label: "Sodium",     amt: sodium+"g" },
  ];

  return (
    <>
     {showLoading ? (
    <LoadingPage isDone={!scanBusy} onDone={() => setShowLoading(false)} />
      ) : (

    <View style={{ height: height(100), backgroundColor: "#fff" }}>



     


      {/* Fading top bar */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: height(8),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: "#E9EEF5",
            zIndex: 20,
          },
          topBarAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: size(16), marginTop: height(1), fontWeight: "700" }}>
          Scanned at {formatScannedAt(scannedAt)}
        </Text>
      </Animated.View>

      {/* MAIN SCROLL with Parallax header */}
      <Animated.ScrollView
        onScroll={onScroll}
        ref={scrollRef}
        style={{ height: "100%"}}
        contentContainerStyle={{
          backgroundColor: "#fff",
          paddingBottom: bottomPad,
          // remove flexGrow; let content decide height. If page is short, it won't fake “full” height.
        }}
        // key bits
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        overScrollMode="always"
        bounces
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={16}
      >
        {/* Parallax header image */}
        <Animated.Image
          source={{ uri: imageUrl }}
          style={[
            {
              width: SCREEN_WIDTH,
              height: IMG_HEIGHT,
            },
            imageAnimatedStyle,
          ]}
          resizeMode="cover"
        />

        {/* Page content */}
        <View style={{ backgroundColor: "#fff" }}>
          <View style={{ width: "100%" }}>


            <Text style={{
              fontSize: size(16),
              marginTop: height(4),
              marginBottom: height(0),
              marginLeft: width(5),
              color: "#B4BBC1",
              fontWeight: "800",
              width: "85%",
              lineHeight: height(2.5)
            }}>
            Edit the detected dish or add ingredients — tap Edit.
            </Text>
            <View style={{
              flexDirection: 'row',
               marginTop: height(4),
                marginLeft: width(5),
             
            }}> 
             <Text style={{ fontSize: size(30), width: "65%", fontWeight: "700" }}>
              {title} 

             </Text>


             <TouchableOpacity onPress={() => {
                present("s6")
             }}
             style={{
             //backgroundColor: '#fff',
              height: size(40),
              top: 0,
              right: width(5),
              position: 'absolute',
              borderRadius: 10,
             // borderWidth: 1,
              //borderColor: "#222",
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: size(25),
              marginRight: width(1)
             }}>

              <View style={{flexDirection: 'row'}}>
                
                <LucideIcons.Pencil size={18} color={"#000"} strokeWidth={4} />
                  <Text style={{marginLeft: width(2), fontWeight: "700", fontSize: size(16)}}>Edit</Text>
               </View>  
             </TouchableOpacity>











               
             </View>




            {/* Swiper section */}
            <View
              style={{ height: height(45) }}
              // ↓ keep parent vertical scroll working when dragging slightly diagonal
              pointerEvents="box-none"
            >
              <Swiper
                loop={false}
                showsButtons={false}
                removeClippedSubviews={false}
                // ↓ avoid vertical lock by requiring a clearer horizontal intent
                // (small vertical drags go to parent)
                horizontal
                index={0}
                autoplay={false}
                paginationStyle={{ bottom: height(-4) }}
                dot={
                  <View
                    style={{
                      backgroundColor: "rgba(0,0,0,0.18)",
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      marginHorizontal: 4,
                    }}
                  />
                }
                activeDot={
                  <View
                    style={{
                      backgroundColor: "#000",
                      width: 40,
                      height: 8,
                      borderRadius: 4,
                      marginHorizontal: 4,
                    }}
                  />
                }
              >
                {/* Slide 1 */}
                <View>
                  <View
                    style={{
                      width: "90%",
                      marginTop: height(4),
                      borderRadius: 20,
                      alignSelf: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 20,
                      height: height(16),
                      borderWidth: 1,
                      borderColor: "#F1F3F9",
                      backgroundColor: "#fff",
                      ...Platform.select({
                        ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.04, shadowRadius: 10 },
                        android: { elevation: 5, shadowColor: "#00000050" },
                      }),
                    }}
                  >
                    <Text style={{ fontSize: size(17), fontWeight: "bold", marginLeft: width(5) }}>Calories</Text>

                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: height(2), marginLeft: width(5) }}>
                      <View
                        style={{
                          height: size(65),
                          width: size(65),
                          borderRadius: size(65) / 2,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "#222",
                        }}
                      >
                        <Flame size={25} strokeWidth={3} color={"#fff"} />
                      </View>

                      <Text style={{ fontSize: size(40), marginLeft: width(3), fontWeight: "700" }}>{calories}</Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      width: "90%",
                      marginTop: height(-1),
                      alignSelf: "center",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: "31%",
                        height: height(20),
                        marginTop: height(4),
                        borderRadius: 20,
                        paddingHorizontal: 20,
                        paddingVertical: 20,
                        borderWidth: 1,
                        borderColor: "#F1F3F9",
                        backgroundColor: "#fff",
                        ...Platform.select({
                          ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                          android: { elevation: 2, shadowColor: "#00000050" },
                        }),
                      }}
                    >
                      <MiniRing value={protein} color="#632EFF" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                      <Text style={{ fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>{protein}g</Text>
                      <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>Protein</Text>
                    </View>

                    <View
                      style={{
                        width: "31%",
                        height: height(20),
                        marginTop: height(4),
                        borderRadius: 20,
                        paddingHorizontal: 20,
                        paddingVertical: 20,
                        borderWidth: 1,
                        borderColor: "#F1F3F9",
                        backgroundColor: "#fff",
                        ...Platform.select({
                          ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                          android: { elevation: 2, shadowColor: "#00000050" },
                        }),
                      }}
                    >
                      <MiniRing value={carbs} color="#F7931A" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                      <Text style={{ fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>{carbs}g</Text>
                      <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>Carbs</Text>
                    </View>

                    <View
                      style={{
                        width: "31%",
                        height: height(20),
                        marginTop: height(4),
                        borderRadius: 20,
                        paddingHorizontal: 20,
                        paddingVertical: 20,
                        borderWidth: 1,
                        borderColor: "#F1F3F9",
                        backgroundColor: "#fff",
                        ...Platform.select({
                          ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                          android: { elevation: 2, shadowColor: "#00000050" },
                        }),
                      }}
                    >
                      <MiniRing value={fat} color="#0058FF" strokeWidth={8} radius={40} duration={2000} maxValue={200} isS3Open={isS3Open} />
                      <Text style={{ fontSize: size(18), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>{fat}g</Text>
                      <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>Fat</Text>
                    </View>
                  </View>
                </View>

                {/* Slide 2 placeholder */}
                <FlatList
                  style={{ marginTop: height(4) }}
                  data={macros}
                  keyExtractor={(_, i) => String(i)}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={{
                    width: "90%",
                    alignSelf: "center",
                    marginTop: height(1),
                    paddingBottom: height(1),
                  }}
                  columnWrapperStyle={{
                    justifyContent: "space-between",
                    marginBottom: height(1.5),
                  }}
                  renderItem={({ item }) => {
                    const IconComponent = LucideIcons[item.icon];
                    return (
                      <View
                        style={{
                          height: 170,
                          width: "48%",
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: "#F1F3F9",
                          backgroundColor: item.color,
                          ...Platform.select({
                            ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                            android: { elevation: 2, shadowColor: "#00000050" },
                          }),
                        }}
                      >
                        {IconComponent && (
                          <View
                            style={{
                              backgroundColor: item.iconColorBg,
                              height: size(40),
                              width: size(40),
                              borderRadius: size(40) / 2,
                              marginLeft: width(4),
                              marginTop: height(2),
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <IconComponent size={22} color={item.IconCOlor} />
                          </View>
                        )}

                        <Text
                          style={{
                            color: item.color == "#222" ? "#fff" : "#000",
                            marginLeft: width(5),
                            marginTop: height(2),
                            fontWeight: "700",
                            fontSize: size(24),
                          }}
                        >
                          {item.amt}
                        </Text>

                        <Text
                          style={{
                            color: item.color == "#222" ? "#fff" : "#888",
                            marginLeft: width(5),
                            marginTop: height(1),
                          }}
                        >
                          {item.label}
                        </Text>
                      </View>
                    );
                  }}
                />
              </Swiper>
            </View>

            {/* Totals */}
            <Text style={{ marginTop: height(10), fontSize: size(18), fontWeight: "bold", marginLeft: width(5) }}>
              Total meal calories
            </Text>

           
           {/* Ingredients / components list */}
<FlatList
  data={ingredients}
  keyExtractor={(item, i) => `${item?.name || "item"}-${i}`}
  scrollEnabled={false}
  contentContainerStyle={{ paddingBottom: height(1) }}
  renderItem={({ item }) => {
    // pick icon from model, fallback to Utensils
    const IconComp =
      (item?.icon && LucideIcons[item.icon]) || LucideIcons.Utensils;

    return (
      <View
        style={{
          width: "90%",
          marginLeft: width(5),
          marginTop: height(5),
          alignSelf: "center",
          alignItems: "center",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            width: size(35),
            height: size(35),
            borderRadius: size(35) / 2,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000",
            marginRight: width(5),
          }}
        >
          <IconComp size={16} color={"#fff"} strokeWidth={3} />
        </View>

        <View>
          <Text style={{ fontSize: size(16), fontWeight: "bold" }}>
            {item?.name || "Item"}
          </Text>
          {!!item?.subtitle && (
            <Text
              style={{
                fontSize: size(13),
                marginTop: height(0.5),
                fontWeight: "bold",
                color: "#BCC1CA",
              }}
            >
              {item.subtitle}
            </Text>
          )}
        </View>

        <Text
          style={{
            position: "absolute",
            right: width(5),
            color: "#FE1B20",
            fontSize: size(16),
            fontWeight: "700",
          }}
        >
          +{Math.round(Number(item?.calories_kcal || 0))} cal
        </Text>
      </View>
    );
  }}
/>


            {/* Alternatives */}
            <Text style={{ marginTop: height(7), fontSize: size(18), fontWeight: "bold", marginLeft: width(5) }}>
              Alternatives
            </Text>



<FlatList
  data={alternatives}
  keyExtractor={(item, i) => String(i)}
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{
    paddingHorizontal: width(5),
    paddingTop: height(2),
    paddingBottom: height(2),
  }}
  renderItem={({ item }) => (

    <View style={{ width: 150, marginRight: width(4), alignItems: "center" }}>
    <View
      style={{
         width: "100%", height: height(20), marginTop: height(4), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 20,
                borderWidth: 1, borderColor: "#F1F3F9", backgroundColor: "#fff",
                alignItems: "center",
                ...Platform.select({
                  ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                  android: { elevation: 2, shadowColor: "#00000050" },
                })
      }}
    >
      <Text numberOfLines={2} style={{ fontSize: size(15), textAlign: "center", fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>

        {item.name}
      </Text>

     
     <Text style={{ 
      position: 'absolute', bottom: height(8),
      fontSize: size(20), fontWeight: "bold", color: item.calories_diff < 0  ? "#00E040" : "#FE1B20", marginTop: height(1), alignSelf: "center" }}>

        {item.calories_diff}cal
      </Text>
 

 
      <Text style={{ fontSize: size(14), position: 'absolute', bottom: height(2),
         fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>

        {item.calories_diff < 0 ? "less" : "more"}
      </Text>
    </View>

    </View>
  )}
/>




           {/* <View style={{ flexDirection: "row", width: "90%", alignSelf: "center", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{
                width: "31%", height: height(20), marginTop: height(4), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 20,
                borderWidth: 1, borderColor: "#F1F3F9", backgroundColor: "#fff",
                alignItems: "center",
                ...Platform.select({
                  ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                  android: { elevation: 2, shadowColor: "#00000050" },
                }),
              }}>
                <Text style={{ fontSize: size(15), textAlign: "center", fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  Almond Milk
                </Text>
                <Text style={{ fontSize: size(20), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  -20cal
                </Text>
                <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  less
                </Text>
              </View>

              <View style={{
                width: "31%", height: height(20), marginTop: height(4), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 20,
                borderWidth: 1, borderColor: "#F1F3F9", backgroundColor: "#fff",
                alignItems: "center",
                ...Platform.select({
                  ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                  android: { elevation: 2, shadowColor: "#00000050" },
                }),
              }}>
                <Text style={{ fontSize: size(15), textAlign: "center", fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  Oat Milk (light)
                </Text>
                <Text style={{ fontSize: size(20), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  -30cal
                </Text>
                <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  less
                </Text>
              </View>

              <View style={{
                width: "31%", height: height(20), marginTop: height(4), borderRadius: 20, paddingHorizontal: 20, paddingVertical: 20,
                borderWidth: 1, borderColor: "#F1F3F9", backgroundColor: "#fff",
                ...Platform.select({
                  ios: { shadowColor: "#555", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.02, shadowRadius: 10 },
                  android: { elevation: 2, shadowColor: "#00000050" },
                }),
              }}>
                <Text style={{ fontSize: size(15), textAlign: "center", fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  Oat Milk (light)
                </Text>
                <Text style={{ fontSize: size(20), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  -33cal
                </Text>
                <Text style={{ fontSize: size(14), fontWeight: "bold", marginTop: height(1), alignSelf: "center" }}>
                  less
                </Text>
              </View>*
            </View>*/}
          </View>
        </View>
      </Animated.ScrollView>

      {/* FLOATING BACK PILL */}
      <TouchableOpacity
        onPress={() => {
          dismiss?.('s3');
          setTimeout(() => dismiss?.('s2'), 1); // small gap for the first animation
        }}
        style={{
          alignSelf: "flex-end",
          height: size(58),
          position: "absolute",
          borderRadius: 18,
          backgroundColor: "#151515",
          paddingHorizontal: size(40),
          bottom: height(13),
          justifyContent: "center",
          flexDirection: "row",
          alignItems: "center",
          marginRight: width(5),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6.65,
          elevation: 12,
          zIndex: 1000,
        }}
      >
        <ArrowLeft size={20} color={"#fff"} style={{ marginRight: width(2) }} />
        <Text style={{ color: "#fff", fontSize: size(17), fontWeight: "bold" }}>Back</Text>
      </TouchableOpacity>
    </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({});
