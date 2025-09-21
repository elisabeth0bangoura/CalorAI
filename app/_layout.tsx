// app/_layout.tsx
import { Stack } from "expo-router";
import React, { useEffect } from "react";
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
import PaywallView from "./Context/PaywallView";
import { RevenueCatProvider, useRevenueCat } from "./Context/RevenueCatContext";
import { ScanResultsProvider } from "./Context/ScanResultsContext";
import { SheetsProvider } from "./Context/SheetsContext";
import { StepsProvider } from "./Context/StepsContext";
import { StreakProvider } from "./Context/StreakContext";

// Optional: make sure we start at app/index
export const unstable_settings = {
  initialRouteName: "index",
};

// ---- Local type to fix TS "never" for your ClickedOnBtn setter ----
type RCBits = {
  isPremium: boolean;
  loading: boolean;
  ClickedOnBtn: boolean;
  setClickedOnBtn: React.Dispatch<React.SetStateAction<boolean>>;
};
// -------------------------------------------------------------------

// Inner shell so we can use RevenueCat inside the provider tree
function AppShell() {
  // Cast the hook result so TS knows these exist & are callable
  const { isPremium, loading, ClickedOnBtn, setClickedOnBtn } =
    (useRevenueCat() as unknown as RCBits);

  // Auto-close the paywall if the user becomes premium while it’s open
  useEffect(() => {
    if (isPremium && ClickedOnBtn) {
      setClickedOnBtn(false);
    }
  }, [isPremium, ClickedOnBtn, setClickedOnBtn]);

  return (
    <View style={{ flex: 1 }}>
      {/* Your normal app */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* Paywall overlay: owned by Layout, triggered via ClickedOnBtn */}
      {ClickedOnBtn && !loading && !isPremium && (
        <View
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
          <PaywallView onClose={() => setClickedOnBtn(false)} />
        </View>
      )}
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
