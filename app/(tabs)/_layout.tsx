// Layout.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PagerView, { PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { height, width as rsWidth, size } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SheetsHost from "../(tabs)/CostumTabbar";
import AppBlurHeader from "../AppBlurHeader";

import Home from "../Components/Home/Home";
import Inventory from "../Components/Inventory/Inventory";
import Profile from "../Components/Profile/Profile";
import ProgressComponent from "../Components/Progress/Progress";

import Health_Check from "../Components/Health_Check/Health_Check";
import { CameraActiveProvider } from "../Context/CameraActiveContext";
import { ScanResultsProvider } from "../Context/ScanResultsContext";
import { SheetsProvider } from "../Context/SheetsContext";
import Tabbar from "../TabBar";
// App.js





const { width: SCREEN_W } = Dimensions.get("window");
const HEADER_H = height(15);

// profile bubble size
const PROFILE_SIZE = size(35);

// width reserved for the scrollable text tabs (clipped so bubble never overlaps)
const CLIPPED_WIDTH = Math.max(
  160,
  SCREEN_W - rsWidth(5) /* left pad */ - PROFILE_SIZE - rsWidth(7) /* gap to edge */
);

// Pausable helper
type Pausable<T = any> = React.ComponentType<T & { paused?: boolean }>;
const ProgressScreen = ProgressComponent as unknown as Pausable;
const HomeScreen = Home as unknown as Pausable;
const InventoryScreen = Inventory as unknown as Pausable;
const ProfileScreen = Profile as unknown as Pausable;
const Health_CheckScreen = Health_Check as unknown as Pausable;

type RouteItem = {
  key: string;
  title: string;
  render: (opts: { paused?: boolean }) => React.ReactElement | null;
};

export default function Layout(): React.ReactElement {



  

  const insets = useSafeAreaInsets();

  const pagerRef = useRef<PagerView>(null);
  const tabsRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const visitedRef = useRef<Set<number>>(new Set([0]));

  const routes: RouteItem[] = useMemo(
    () => [
      { key: "Home", title: "Home", render: ({ paused }) => <HomeScreen paused={paused} /> },
      { key: "Progress", title: "Progress", render: ({ paused }) => <ProgressScreen paused={paused} /> },
      { key: "HealthChecks", title: "Health Checks", render: ({ paused }) => <Health_CheckScreen paused={paused} /> },
      { key: "Inventory", title: "Inventory", render: ({ paused }) => <InventoryScreen paused={paused} /> },
      
      { key: "Profile", title: "Profile", render: ({ paused }) => <ProfileScreen paused={paused} /> },
    ],
    []
  );

  const profileIndex = routes.findIndex((r) => r.key === "Profile");
  const scrollableTabs = routes.filter((r) => r.key !== "Profile");

  const onTabLayout =
    (routeIndex: number) =>
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      tabLayouts.current[routeIndex] = { x, width };
    };

  const scrollTabsToCenter = (routeIndex: number) => {
    const layout = tabLayouts.current[routeIndex];
    if (!layout) return;
    const centerX = layout.x + layout.width / 2;
    const targetX = Math.max(0, centerX - SCREEN_W / 2);
    tabsRef.current?.scrollTo({ x: targetX, animated: true });
  };

  const goToPage = (index: number) => {
    visitedRef.current.add(index);
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
    if (index !== profileIndex) scrollTabsToCenter(index);
  };

  const onPageSelected = (e: PagerViewOnPageSelectedEvent) => {
    const idx = e.nativeEvent.position ?? 0;
    if (!visitedRef.current.has(idx)) visitedRef.current.add(idx);
    if (idx !== activeIndex) setActiveIndex(idx);
    if (idx !== profileIndex) scrollTabsToCenter(idx);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#fff" }}>
      

      <CameraActiveProvider>
        <SheetsProvider>
          <ScanResultsProvider>
            <AppBlurHeader />

            {/* Tabs row (FULL WIDTH) */}
            <View
              pointerEvents="box-none"
              style={[
                styles.tabRow,
                { paddingTop: insets.top + 8, height: HEADER_H },
              ]}
            >
              {/* Clipped area for scrollable text tabs */}
              <View style={{ width: CLIPPED_WIDTH, overflow: "hidden" }}>
                <ScrollView
                  ref={tabsRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingLeft: rsWidth(5),
                    paddingRight: rsWidth(3),
                    alignItems: "flex-end",
                  }}
                >
                  {scrollableTabs.map((r) => {
                    const routeIndex = routes.findIndex((x) => x.key === r.key);
                    const isActive = activeIndex === routeIndex;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => goToPage(routeIndex)}
                        onLayout={onTabLayout(routeIndex)}
                        style={[styles.tabItem, { marginRight: rsWidth(5) }]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tabLabel,
                            { color: isActive ? "#000000" : "#ADB6BD" },
                          ]}
                        >
                          {r.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Round profile bubble FIXED to the right edge */}
              <Pressable onPress={() => goToPage(profileIndex)} style={styles.profileFixed}>
                <View
                  style={[
                    styles.profileBubble,
                    { backgroundColor: activeIndex === profileIndex ? "#222" : "#ADB6BD" },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>B</Text>
                </View>
              </Pressable>
            </View>

            {/* Pages */}
            <View style={{ flex: 1, backgroundColor: "transparent" }}>
              <PagerView
                ref={pagerRef}
                style={{ flex: 1 }}
                initialPage={0}
                onPageSelected={onPageSelected}
                offscreenPageLimit={1}
                scrollEnabled
              >
                {routes.map((r, idx) => {
                  const isActive = activeIndex === idx;
                  const hasMounted = visitedRef.current.has(idx);
                  return (
                    <View key={r.key} style={{ flex: 1, backgroundColor: "transparent" }}>
                      {hasMounted ? r.render({ paused: !isActive }) : <View style={{ flex: 1 }} />}
                    </View>
                  );
                })}
              </PagerView>

              <SheetsHost />
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
    zIndex: 50000,
    backgroundColor: "transparent",
    width: "100%", // <— full width so "right" means screen right
    flexDirection: "row",
    alignItems: "flex-end",
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

  // fixed bubble at right edge
  profileFixed: {
    position: "absolute",
    right: rsWidth(5), // <— anchors to the *screen* right
    bottom: height(-0.2),
  },
  profileBubble: {
    justifyContent: "center",
    alignItems: "center",
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
  },
});
