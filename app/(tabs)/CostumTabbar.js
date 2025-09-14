// app/Sheets/SheetsHost.js
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { Check, ChevronLeft } from "lucide-react-native";
import React, { memo, useEffect, useMemo } from "react";
import { Button as RNButton, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

import CameraCarouselSwiper from "../Components/Camera/Camera";
import PageAfterScan_Add_To_Inventory from "../Components/Camera/PageAfterScan/PageAfterScan_Add_To_Inventory/PageAfterScan_Add_To_Inventory";
import Scan_AddExpirationDate from "../Components/Camera/PageAfterScan/PageAfterScan_Add_To_Inventory/Scan_AddExpirationDate";
import PageAfterScan_Scan_Barcode from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Barcode/PageAfterScan_Scan_Barcode";
import { default as Edit_Scan_FoodScan, default as Edit_ScanpageHome } from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Food/Edit_Scan_Food";
import PageAfterScanFood from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Food/PageAfterScan_Scan_Food";
import PageAfterScan_FoodLabel from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_FoodLabel/PageAfterScan_FoodLabel";
import EditMyWeight from "../Components/EditMyWeight/EditMyWeight";
import EditHabit_And_Nutrition_Goals from "../Components/Profile/EditHabit_And_Nutrition_Goals/EditHabit_And_Nutrition_Goals";
import Generate_Based_On_Habits_AndHealth from "../Components/Profile/EditHabit_And_Nutrition_Goals/Generate_Based_On_Habits_AndHealth/Generate_Based_On_Habits_AndHealth";
import Habits_Weight_History from "../Components/Profile/Habits_Weight_History/Habits_Weight_History";
import Add_Burned_Calories from "../Components/Profile/Preferences/Add_Burned_Calories";
import AutoAdjustMacros from "../Components/Profile/Preferences/AutoAdjustMacros";
import RolloverCalories from "../Components/Profile/Preferences/RolloverCalories";
import BirthDay from "../Components/Profile/Profile/BirthDay";
import CurrentWeight from "../Components/Profile/Profile/CurrentWeight";
import DailyStepsComponent from "../Components/Profile/Profile/DailyStepsSelector";
import HeightComponent from "../Components/Profile/Profile/HeightComponent";
import PersonalDetails from "../Components/Profile/Profile/PersonalDetails";
import TargetWeight from "../Components/Profile/Profile/TargetWeight";
import ScanPageHome from "../Components/ScanPageHome/ScanPageHome";
import { useCameraActive } from "../Context/CameraActiveContext";
import { useSheets } from "../Context/SheetsContext";











/* ---- memo wrappers ---- */
const MemoCameraCarousel = memo(CameraCarouselSwiper);
const MemoAfterScanFood = memo(PageAfterScanFood);
const MemoAfterScanBarcode = memo(PageAfterScan_Scan_Barcode);
const MemoAfterScanFoodLabel = memo(PageAfterScan_FoodLabel);
const MemoAfterScanInventory = memo(PageAfterScan_Add_To_Inventory);
const MemoEditScanFood = memo(Edit_Scan_FoodScan);
const MemoScanAddExpiration = memo(Scan_AddExpirationDate);
const MemoEditMyWeight = memo(EditMyWeight);
const MemoScanPageHome = memo(ScanPageHome);
const MemoEdit_ScanpageHome = memo(Edit_ScanpageHome);

export default function SheetsHost() {
  const {
    register, present, dismiss, dismissAll,
    isS2Open, setIsS2Open,
    isS3Open, setIsS3Open,
    isS4Open, setIsS4Open,
    isS5Open, setIsS5Open,
    isS6Open, setIsS6Open,
    isS7Open, setIsS7Open,
    isS8Open, setIsS8Open,
    isS9Open, setIsS9Open,
    isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
    isTargetWeightOpen, setIsTargetWeightOpen,
    isCurrentWeightOpen, 
    setIsCurrentWeightOpen,
    isHeightComponentOpen, 
    setIsHeightComponentOpen,
    isBirthDayComponentOpen, 
    setIsBirthDayComponentOpen,
    isDailyStepsComponentOpen,
    setIsDailyStepsComponentOpen,
    isEditNutritionGoalsComponentOpen, 
    setIsEditNutritionGoalsComponentOpen,
    isGenerate_Based_On_Habits_AndHealth, 
    setIsGenerate_Based_On_Habits_AndHealth,
    isHabits_Weight_History,
    setIsHabits_Weight_History,
    isAdd_Burned_Calories, setIsAdd_Burned_Calories,
    isRolloverCalories, setIsRolloverCalories,
    isAutoAdjustMacros, setIsAutoAdjustMacros
  } = useSheets();

  const { activeKey } = useCameraActive();

  useEffect(() => { console.log("[SheetsHost] s2 open ->", isS2Open); }, [isS2Open]);
  useEffect(() => { console.log("[SheetsHost] s3 open ->", isS3Open); }, [isS3Open]);
  useEffect(() => { console.log("[SheetsHost] s5 open ->", isS5Open); }, [isS5Open]);
  useEffect(() => { console.log("[SheetsHost] s6 open ->", isS6Open); }, [isS6Open]);
  useEffect(() => { console.log("[SheetsHost] s7 open ->", isS7Open); }, [isS7Open]);
  useEffect(() => { console.log("[SheetsHost] s8 open ->", isS8Open); }, [isS8Open]);
  useEffect(() => { console.log("[SheetsHost] s9 open ->", isS9Open); }, [isS9Open]);
  useEffect(() => { console.log("[SheetsHost] PerosnalDetails open ->", isPerosnalDetailsOpen); }, [isPerosnalDetailsOpen]);
  useEffect(() => { console.log("[SheetsHost] TargetWeight open ->", isTargetWeightOpen); }, [isTargetWeightOpen]);
  useEffect(() => { console.log("[SheetsHost] CurrentWeight open ->", isCurrentWeightOpen); }, [isCurrentWeightOpen]);
  useEffect(() => { console.log("[SheetsHost] HeightComponent open ->", isHeightComponentOpen); }, [isHeightComponentOpen]);
  useEffect(() => { console.log("[SheetsHost] BirthDayComponent open ->", isBirthDayComponentOpen); }, [isBirthDayComponentOpen]);
  useEffect(() => { console.log("[SheetsHost] DailyStepsComponentOpen open ->", isDailyStepsComponentOpen); }, [isDailyStepsComponentOpen]);
  useEffect(() => { console.log("[SheetsHost] EditNutritionGoalsComponentOpen open ->", isEditNutritionGoalsComponentOpen); }, [isEditNutritionGoalsComponentOpen]);
  useEffect(() => { console.log("[SheetsHost] Generate_Based_On_Habits_AndHealth open ->", isGenerate_Based_On_Habits_AndHealth); }, [isGenerate_Based_On_Habits_AndHealth]);
  useEffect(() => { console.log("[SheetsHost] Habits_Weight_History open ->", isHabits_Weight_History); }, [isHabits_Weight_History]);
  useEffect(() => { console.log("[SheetsHost] Add_Burned_Calories open ->", isAdd_Burned_Calories); }, [isAdd_Burned_Calories]);
  useEffect(() => { console.log("[SheetsHost] RolloverCalories open ->", isRolloverCalories); }, [isRolloverCalories]);
  useEffect(() => { console.log("[SheetsHost] AutoAdjustMacros open ->", isAutoAdjustMacros); }, [isAutoAdjustMacros]);



        

  

  /* Only build the heavy s3 body when s3 is open */
  const S3Body = useMemo(() => {
    if (!isS3Open) return null;
    switch (activeKey) {
      case "SCAN FOOD":
        return <MemoAfterScanFood />;
      case "BARCODE":
        return <MemoAfterScanBarcode />;
      case "FOOD LABEL":
        return <MemoAfterScanFoodLabel />;
      case "ADD TO INVENTORY":
        return <MemoAfterScanInventory />;
      default:
        return <MemoAfterScanFood />;
    }
  }, [isS3Open, activeKey]);

  return (
    <>
      {/* s1 */}
      <TrueSheet
        ref={register("s1")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
      >
        <View style={{ padding: 16, backgroundColor: "#fff", gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Sheet 1</Text>
          <RNButton title="Open 2 (Camera)" onPress={() => present("s2")} />
          <RNButton title="Dismiss 1" onPress={() => dismiss("s1")} />
          <RNButton title="Close All" onPress={dismissAll} />
        </View>
      </TrueSheet>

      {/* s2 (Camera host) */}
      <TrueSheet
        ref={register("s2")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#000"
        onChange={(index) => setIsS2Open(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsS2Open(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {isS2Open && !isS3Open ? (
            <MemoCameraCarousel key="camera-mounted" />
          ) : (
            <View key="camera-unmounted" style={{ padding: 16, gap: 10 }}>
              <Text>{isS2Open ? "Results are open — camera paused" : "Sheet 2 closed"}</Text>
            </View>
          )}
        </View>

        {/* s3 (Results) */}
        <TrueSheet
          ref={register("s3")}
          sizes={["large"]}
          cornerRadius={24}
          enablePanDownToClose
          backgroundColor="#000"
          onChange={(index) => setIsS3Open(typeof index === "number" && index >= 0)}
          onDismiss={() => setIsS3Open(false)}
        >
          {isS3Open ? S3Body : <View style={{ padding: 16 }} />}

          {/* s6 (Edit PageAfterScan) */}
          <TrueSheet
            ref={register("s6")}
            sizes={["large"]}
            cornerRadius={24}
            enablePanDownToClose
            backgroundColor="#fff"
            onChange={(index) => setIsS6Open(typeof index === "number" && index >= 0)}
            onDismiss={() => setIsS6Open(false)}
          >
            {isS6Open ? <MemoEditScanFood /> : <View style={{ padding: 16 }} />}
          </TrueSheet>

          {/* s5 (Add Expiration) */}
          <TrueSheet
            ref={register("s5")}
            sizes={["large"]}
            cornerRadius={24}
            enablePanDownToClose
            backgroundColor="#fff"
            onChange={(index) => setIsS5Open(typeof index === "number" && index >= 0)}
            onDismiss={() => setIsS5Open(false)}
          >
            {isS5Open ? <MemoScanAddExpiration /> : <View style={{ padding: 16 }} />}
          </TrueSheet>
        </TrueSheet>
      </TrueSheet>

      {/* s4 */}
      <TrueSheet
        ref={register("s4")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsS4Open(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsS4Open(false)}
      >
        <View style={{ padding: 16, backgroundColor: "#fff", gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Sheet 4</Text>
          <RNButton title="Open 5" onPress={() => present("s5")} />
          <RNButton title="Dismiss 4" onPress={() => dismiss("s4")} />
        </View>
      </TrueSheet>

      {/* s7 (Weight) */}
      <TrueSheet
        ref={register("s7")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsS7Open(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsS7Open(false)}
      >
        {isS7Open ? (
          <View style={{ padding: 16, backgroundColor: "#fff", gap: 10 }}>
            <Text style={{ top: height(5), fontWeight: "800", fontSize: size(20), alignSelf: "center" }}>
              What's your current Weight?
            </Text>
            <MemoEditMyWeight />
            <View style={{ top: height(78), position: "absolute", width: "100%" }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => dismiss("s7")}
                style={{
                  height: size(60),
                  width: size(65),
                  paddingHorizontal: 25,
                  left: width(5),
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 15,
                  backgroundColor: "#EDEFF1",
                }}
              >
                <ChevronLeft size={25} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => dismiss("s7")}
                style={{
                  height: size(60),
                  paddingHorizontal: 25,
                  right: width(5),
                  position: "absolute",
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 15,
                  backgroundColor: "#151515",
                }}
              >
                <Text style={{ color: "#fff", fontSize: size(17), marginRight: width(3), fontWeight: "bold" }}>
                  Save
                </Text>
                <Check size={18} color={"#fff"} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ padding: 16 }} />
        )}
      </TrueSheet>

      {/* s8 (Scan page home) */}
      <TrueSheet
        ref={register("s8")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsS8Open(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsS8Open(false)}
      >
        {/* Mount content ONLY when s8 is open */}
        {isS8Open ? (
          <>
            {/* s9 (Edit ScanPageHome) — mount only while open */}
            <TrueSheet
              ref={register("s9")}
              sizes={["large"]}
              cornerRadius={24}
              enablePanDownToClose
              backgroundColor="#fff"
              onChange={(index) => setIsS9Open(typeof index === "number" && index >= 0)}
              onDismiss={() => setIsS9Open(false)}
            >
              {isS9Open ? <MemoEdit_ScanpageHome /> : <View style={{ padding: 16 }} />}
            </TrueSheet>

            <MemoScanPageHome />
          </>
        ) : (
          <View style={{ padding: 16 }} />
        )}
      </TrueSheet>









       {/* Perosnal Details Sheet */}
      <TrueSheet
        ref={register("PerosnalDetails")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsPerosnalDetailsOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsPerosnalDetailsOpen(false)}
      >
     
     <PersonalDetails />

            {/* Target Weight Sheet */}
      <TrueSheet
        ref={register("TargetWeight")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsTargetWeightOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsTargetWeightOpen(false)}
      >
     
       <TargetWeight />
      </TrueSheet>

        <TrueSheet
        ref={register("CurrentWeight")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsCurrentWeightOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsCurrentWeightOpen(false)}
      >
     
       <CurrentWeight />
      </TrueSheet>


   <TrueSheet
        ref={register("HeightComponent")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsHeightComponentOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsHeightComponentOpen(false)}
      >
     
       <HeightComponent />
      </TrueSheet>






  <TrueSheet
        ref={register("BirthDay")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsBirthDayComponentOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsBirthDayComponentOpen(false)}
      >
     
       <BirthDay />
      </TrueSheet>



<TrueSheet
        ref={register("DailyStepsComponent")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsDailyStepsComponentOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsDailyStepsComponentOpen(false)}
      >
     
       <DailyStepsComponent />
      </TrueSheet>

      

      </TrueSheet>










        <TrueSheet
        ref={register("EditNutritionGoals")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsEditNutritionGoalsComponentOpen(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsEditNutritionGoalsComponentOpen(false)}
      >
     
       <EditHabit_And_Nutrition_Goals />





        <TrueSheet
        ref={register("Generate_Based_On_Habits_AndHealth")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsGenerate_Based_On_Habits_AndHealth(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsGenerate_Based_On_Habits_AndHealth(false)}
      >
     
       <Generate_Based_On_Habits_AndHealth />
      </TrueSheet>




      </TrueSheet>
















        <TrueSheet
        ref={register("Habits_Weight_History")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsHabits_Weight_History(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsHabits_Weight_History(false)}
      >
     
       <Habits_Weight_History />
      </TrueSheet>









       <TrueSheet
        ref={register("Add_Burned_Calories")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsAdd_Burned_Calories(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsAdd_Burned_Calories(false)}
      >
       <Add_Burned_Calories />
      </TrueSheet>




          <TrueSheet
        ref={register("RolloverCalories")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsRolloverCalories(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsRolloverCalories(false)}
      >
       <RolloverCalories />
      </TrueSheet>




        <TrueSheet
        ref={register("AutoAdjustMacros")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsAutoAdjustMacros(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsAutoAdjustMacros(false)}
      >
       <AutoAdjustMacros />
      </TrueSheet>





    </>
  );
}
