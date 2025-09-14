// app/_layout.tsx
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AddToInventoryProvider } from "./Context/AddToInventoryContext";
import { CameraActiveProvider } from "./Context/CameraActiveContext";
import { CountryPhoneSheetProvider } from "./Context/CountryPhoneSheetContext";
import { CurrentScannedItemIdProvider } from "./Context/CurrentScannedItemIdContext";
import DailyLeftProvider from "./Context/DailyLeftContext";
import DailyTargetsProvider from "./Context/DailyPlanProvider";
import { EditNutritionProvider } from "./Context/EditNutritionContext";
import { OnboardingProvider } from "./Context/OnboardingContext";
import { RevenueCatProvider, useRevenueCat } from "./Context/RevenueCatContext";
import { ScanResultsProvider } from "./Context/ScanResultsContext";
import { SheetsProvider } from "./Context/SheetsContext";
import { StepsProvider } from "./Context/StepsContext";
import { StreakProvider } from "./Context/StreakContext";






// Optional: make sure we start at app/index
export const unstable_settings = {
  initialRouteName: "index",
};

// Inner shell so we can use the RevenueCat hook inside the provider
function AppShell() {
  const { isPremium, loading } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);

  // Decide when to show/hide the paywall
  useEffect(() => {
    if (!loading) {
      // show paywall if NOT premium
      setShowPaywall(!isPremium);
    }
  }, [loading, isPremium]);

  return (
    <View style={{ flex: 1 }}>
      {/* Your normal app */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* Paywall overlay (only when needed) */}
      {/*showPaywall && !loading && !isPremium && (
        <View
          // full-screen overlay above everything
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
          pointerEvents="auto"
        >
          <PaywallView onClose={() => setShowPaywall(false)} />
        </View>
      )*/}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RevenueCatProvider>
        <EditNutritionProvider>
        <DailyLeftProvider>
          <DailyTargetsProvider>
            <StepsProvider>
              <OnboardingProvider>
                <CurrentScannedItemIdProvider>
                  <StreakProvider>
                    <AddToInventoryProvider>
                      <CountryPhoneSheetProvider>
                        <CameraActiveProvider>
                          <SheetsProvider>
                            <ScanResultsProvider>
                              <AppShell />
                            </ScanResultsProvider>
                          </SheetsProvider>
                        </CameraActiveProvider>
                      </CountryPhoneSheetProvider>
                    </AddToInventoryProvider>
                  </StreakProvider>
                </CurrentScannedItemIdProvider>
              </OnboardingProvider>
            </StepsProvider>
          </DailyTargetsProvider>
        </DailyLeftProvider>
         </EditNutritionProvider>
      </RevenueCatProvider>
    </GestureHandlerRootView>
  );
}
