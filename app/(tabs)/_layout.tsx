import React, { useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  LayoutChangeEvent,
  LogBox,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { height, width as rsWidth, size, width } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SheetsHost from "../(tabs)/CostumTabbar"; // 👈 import your sheets host
import AppBlurHeader from "../AppBlurHeader";
import Home from "../Components/Home/Home";
import Inventory from "../Components/Inventory/Inventory";
import Profile from "../Components/Profile/Profile";
import ProgressComponent from "../Components/Progresss/Progress";
import { CameraActiveProvider } from "../Context/CameraActiveContext";
import { ScanResultsProvider } from "../Context/ScanResultsContext";
import { SheetsProvider } from "../Context/SheetsContext";
import Tabbar from "../TabBar";







const { width: SCREEN_W } = Dimensions.get("window");
const HEADER_H = height(15);

function SecondScreen() {
  return (
    <View style={[styles.screen, { backgroundColor: "#EFE8FF" }]}>
      <Text style={styles.h2}>Second Screen</Text>
    </View>
  );
}

export default function Layout() {
  LogBox.ignoreAllLogs(true);

  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const pagesRef = useRef<ScrollView>(null);
  const tabsRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<{ x: number; width: number }[]>([]);

  const routes = useMemo(
    () => [
      { key: "Home", title: "Home", component: Home },
      { key: "Progress", title: "Progress", component: ProgressComponent },
      { key: "Inventory", title: "Inventory", component: Inventory },
      { key: "Profile", title: "Profile", component: Profile },
    ],
    []
  );

  const onTabLayout =
    (index: number) =>
    (e: NativeSyntheticEvent<LayoutChangeEvent["nativeEvent"]>) => {
      const { x, width } = e.nativeEvent.layout;
      tabLayouts.current[index] = { x, width };
    };

  const scrollTabsToCenter = (index: number) => {
    const layout = tabLayouts.current[index];
    if (!layout) return;
    const centerX = layout.x + layout.width / 2;
    const targetX = Math.max(0, centerX - SCREEN_W / 2);
    tabsRef.current?.scrollTo({ x: targetX, animated: true });
  };

  const handleTabPress = (index: number) => {
    pagesRef.current?.scrollTo({ x: SCREEN_W * index, animated: true });
    scrollTabsToCenter(index);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CameraActiveProvider>
        <SheetsProvider>
          <ScanResultsProvider>
            <AppBlurHeader />

            {/* Labels row */}
            <View
              pointerEvents="box-none"
              style={[
                styles.tabRow,
                { paddingTop: insets.top + 8, height: HEADER_H },
              ]}
            >
              <ScrollView
                ref={tabsRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingLeft: rsWidth(5),
                  paddingRight: rsWidth(5),
                  alignItems: "flex-end",
                }}
              >
                {routes.map((r, idx) => {
                  const inputRange = [
                    SCREEN_W * (idx - 1),
                    SCREEN_W * idx,
                    SCREEN_W * (idx + 1),
                  ];

                  // color for text labels (non-profile)
                  const labelColor = scrollX.interpolate({
                    inputRange,
                    outputRange: ["#ADB6BD", "#000000", "#ADB6BD"],
                    extrapolate: "clamp",
                  });

                  // bg color for the profile bubble (inactive grey -> active yellow)
                  const bubbleBg = scrollX.interpolate({
                    inputRange,
                    outputRange: ["#ADB6BD", "#222", "#E6E9EC"],
                    extrapolate: "clamp",
                  });

                 


                  const isProfile = r.key === "Profile";

                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => handleTabPress(idx)}
                      onLayout={onTabLayout(idx)}
                      style={[styles.tabItem, { marginRight: rsWidth(5) }]}
                    >
                      {isProfile ? (
                        // 🔵 round view for Profile tab
                        <Animated.View
                          style={[
                            styles.profileBubble,
                            { backgroundColor: bubbleBg },
                          ]}
                        >
                         <Animated.Text
                            style={{
                              color: "#fff",
                              fontWeight: "700",
                            }}
                          >
                            B
                          </Animated.Text>
                        </Animated.View>
                      ) : (
                        // 📝 text for all other tabs
                        <Animated.Text
                          numberOfLines={1}
                          style={[styles.tabLabel, { color: labelColor }]}
                        >
                          {r.title}
                        </Animated.Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Pages */}
            <View style={{ height: "100%", backgroundColor: "transparent" }}>
              <ScrollView
                ref={pagesRef}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                style={{ backgroundColor: "transparent" }}
                contentContainerStyle={{ backgroundColor: "transparent" }}
                onMomentumScrollEnd={(e) => {
                  const pageIndex = Math.round(
                    e.nativeEvent.contentOffset.x / SCREEN_W
                  );
                  scrollTabsToCenter(pageIndex);
                }}
              >
                {routes.map((r) => {
                  const ScreenComp = r.component;
                  return (
                    <View
                      key={r.key}
                      style={{ width: SCREEN_W, backgroundColor: "transparent" }}
                    >
                      <ScreenComp />
                    </View>
                  );
                })}
              </ScrollView>
              <SheetsHost />
              {/* Floating tabbar */}
              <Tabbar />
            </View>
          </ScanResultsProvider>
          
        </SheetsProvider>
      </CameraActiveProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    position: "absolute",
    top: height(-5.5),
    alignSelf: "center",
   // height: height(20),

    zIndex: 50000,
    // backgroundColor: 'orange',
    
    backgroundColor: "transparent",
    width: "100%",
  },
  tabItem: {
   
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabLabel: {
     marginTop: height(-3),
    fontSize: size(20),
    fontWeight: "800",
  },
  // round button used for the "Profile" tab
  profileBubble: {
    right: width(-6),
    top: height(0),
    justifyContent: 'center',
    alignItems: 'center',
    width: size(35),
    height: size(35),
    borderRadius: size(35) / 2,
  },
  screen: {
    flex: 1,
    alignItems: "center",
   
    justifyContent: "center",
  },
  h2: { fontSize: 20, fontWeight: "600" },
});
