// app/Sheets/SheetsHost.js
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import React, { useEffect } from "react";
import { Button as RNButton, Text, TouchableOpacity, View } from "react-native";

import CameraCarouselSwiper from "../Components/Camera/Camera";
import PageAfterScanFood from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Food/PageAfterScan_Scan_Food";
import { useCameraActive } from "../Context/CameraActiveContext";
import { useSheets } from "../Context/SheetsContext";

// Optional pages (fallback to Food page if missing)
import PageAfterScan_Add_To_Inventory from "../Components/Camera/PageAfterScan/PageAfterScan_Add_To_Inventory/PageAfterScan_Add_To_Inventory";
import Scan_AddExpirationDate from "../Components/Camera/PageAfterScan/PageAfterScan_Add_To_Inventory/Scan_AddExpirationDate";
import PageAfterScan_Scan_Barcode from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Barcode/PageAfterScan_Scan_Barcode";
import Edit_Scan_FoodScan from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_Food/Edit_Scan_Food";
import PageAfterScan_FoodLabel from "../Components/Camera/PageAfterScan/PageAfterScan_Scan_FoodLabel/PageAfterScan_FoodLabel";

import { Check, ChevronLeft } from "lucide-react-native";
import { height, size, width } from "react-native-responsive-sizes";
import EditMyWeight from "../Components/EditMyWeight/EditMyWeight";








export default function SheetsHost() {
  const {
    register, present, dismiss, dismissAll,
    isS2Open, setIsS2Open,
    isS3Open, setIsS3Open,
    isS4Open, setIsS4Open,
    isS5Open, setIsS5Open,

    isS7Open, setIsS7Open,
    

    // ✅ : Edit PageAfterScan (this must sit ABOVE s3)
    isS6Open, setIsS6Open,
  } = useSheets();

  const { activeKey } = useCameraActive();

  useEffect(() => { console.log("[SheetsHost] isS2Open ->", isS2Open); }, [isS2Open]);
  useEffect(() => { console.log("[SheetsHost] isS3Open ->", isS3Open); }, [isS3Open]);
  useEffect(() => { console.log("[SheetsHost] isS4Open ->", isS4Open); }, [isS4Open]);
  useEffect(() => { console.log("[SheetsHost] isS5Open ->", isS5Open); }, [isS5Open]);
  useEffect(() => { console.log("[SheetsHost] isS6Open ->", isS6Open); }, [isS6Open]);
  useEffect(() => { console.log("[SheetsHost] is76Open ->", isS7Open); }, [isS7Open]);





  const renderS3Content = () => {
    switch (activeKey) {
      case "SCAN FOOD":
        return <PageAfterScanFood />;
      case "BARCODE":
         return <PageAfterScan_Scan_Barcode />;
      case "FOOD LABEL":
        return <PageAfterScan_FoodLabel />
      case "ADD TO INVENTORY":
       return <PageAfterScan_Add_To_Inventory />;
      default:
        return <PageAfterScanFood />;
    }
  };

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
        backgroundColor="#fff"
        onChange={(index) => {
          const open = typeof index === "number" && index >= 0;
          setIsS2Open(open);
          console.log("[SheetsHost] s2 index ->", index);
        }}
        onDismiss={() => {
          setIsS2Open(false);
          console.log("[SheetsHost] s2 dismissed");
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {isS2Open ? (
            <CameraCarouselSwiper />
          ) : (
            <View style={{ padding: 16, gap: 10 }}>
              <Text>Sheet 2 is closed (no camera mounted)</Text>
             
            </View>
          )}
        </View>

        {/* s3 (Results) — content depends on active camera */}
        <TrueSheet
          ref={register("s3")}
          sizes={["large"]}
          cornerRadius={24}
          enablePanDownToClose
          backgroundColor="#fff"
          onChange={(index) => {
            const open = typeof index === "number" && index >= 0;
            setIsS3Open(open);
            console.log("[SheetsHost] s3 index ->", index, "activeKey ->", activeKey);
          }}
          onDismiss={() => {
            setIsS3Open(false);
            console.log("[SheetsHost] s3 dismissed");
          }}
        >
          {/* s3 content */}
          {renderS3Content()}

          {/* ✅ : Edit PageAfterScan — NESTED ABOVE s3 */}
          <TrueSheet
            ref={register("s6")}
            sizes={["large"]}
            cornerRadius={24}
            enablePanDownToClose
            backgroundColor="#fff"
            onChange={(index) => {
              const open = typeof index === "number" && index >= 0;
              setIsS6Open(open);
              console.log("[SheetsHost] s6 (Edit PageAfterScan) index ->", index);
            }}
            onDismiss={() => {
              setIsS6Open(false);
              console.log("[SheetsHost] s6 (Edit PageAfterScan) dismissed");
            }}
          >
            <Edit_Scan_FoodScan />
          </TrueSheet>




            <TrueSheet
              ref={register("s5")}
              sizes={["large"]}
              cornerRadius={24}
              enablePanDownToClose
              backgroundColor="#fff"
             // onChange={(index) => setIsS5Open(typeof index === "number" && index >= 0)}
            onChange={(index) => {
              const open = typeof index === "number" && index >= 0;
              setIsS5Open(open);
              console.log("[SheetsHost] s5 (Edit PageAfterScan) index ->", index);
            }}

             onDismiss={() => {
              setIsS5Open(false);
              console.log("[SheetsHost] s5 (Edit PageAfterScan) dismissed");
            }}
            >
            <Scan_AddExpirationDate />
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

      {/* s5 */}


       <TrueSheet
        ref={register("s7")}
        sizes={["large"]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsS7Open(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsS7Open(false)}
      >
        <View style={{ padding: 16, backgroundColor: "#fff", gap: 10 }}>
       

       <Text style={{
        top: height(5),
        fontWeight: "800",
        fontSize: size(20),
        alignSelf: 'center',
       }}>
        What's your current Weight?
       </Text>
            <EditMyWeight />
          
               
        </View>






<View style={{
 top: height(78),
 position: 'absolute',
 width: "100%",
                
}}>

<TouchableOpacity  
           activeOpacity={0.8}
           onPress={() =>  dismiss("s7")}
            style={{
               height: size(60),
                 width: size(65),
                paddingHorizontal: 25,
                left: width(5),
               
                
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 15,
                backgroundColor: '#EDEFF1',
                
            }}>
            <ChevronLeft size={25} />
        </TouchableOpacity>

 <TouchableOpacity  
           activeOpacity={0.8}
           onPress={() => {
             dismiss("s7")
          }}
            style={{
               height: size(60),
                // width: width(35),
                paddingHorizontal: 25,
                right: width(5),
              
                position: 'absolute',
                 
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 15,
                backgroundColor: '#151515',
                
            }}>
            <Text style={{
                color: '#fff',
                fontSize: size(17),
                marginRight: width(3),
                fontWeight: "bold"
            }}>
                Save
            </Text>

            <Check size={18} color={"#fff"} />
        </TouchableOpacity>

         </View>
        
      </TrueSheet>
    
    </>
  );
}
