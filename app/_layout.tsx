// app/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AddToInventoryProvider } from "./Context/AddToInventoryContext";
import { CameraActiveProvider } from "./Context/CameraActiveContext";
import { CountryPhoneSheetProvider } from "./Context/CountryPhoneSheetContext";
import { CurrentScannedItemIdProvider } from "./Context/CurrentScannedItemIdContext";
import DailyLeftProvider from "./Context/DailyLeftContext";
import DailyTargetsProvider from "./Context/DailyPlanProvider";
import { OnboardingProvider } from "./Context/OnboardingContext";
import { ScanResultsProvider } from "./Context/ScanResultsContext";
import { SheetsProvider } from "./Context/SheetsContext";
import { StepsProvider } from "./Context/StepsContext";
import { StreakProvider } from "./Context/StreakContext";
// Optional: make sure we start at app/index
export const unstable_settings = {
  initialRouteName: "index",
};
// ...
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
   
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
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      </Stack>
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
    
    </GestureHandlerRootView>
  );
}
