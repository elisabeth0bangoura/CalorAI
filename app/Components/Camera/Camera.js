// Camera.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ScrollView as GHScrollView,
  TouchableOpacity as GHTouchableOpacity,
  ScrollView,
} from "react-native-gesture-handler";
import { height, size } from "react-native-responsive-sizes";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCameraActive } from "@/app/Context/CameraActiveContext";
import { useSheets } from "@/app/Context/SheetsContext";


import BarcodeCamera from "./Cameras/BarcodeCamera";
import FoodLabelCamera from "./Cameras/FoodLabelCamera";
import InventoryCamera from "./Cameras/InventoryCamera";
import Scan_Food_Camera from "./Cameras/Scan_Food_Camera";

const GAP = 18;
const MIN_SLOT = 150;
const PADDING_FUDGE = 0;

export default function CameraCarouselScroll() {
  const insets = useSafeAreaInsets();
  const { isS3Open, isS2Open } = useSheets();           // ← NEW: read isS2Open

  const { setActiveKey } = useCameraActive();

  const pagerRef = useRef(null);
  const labelsRef = useRef(null);
  const pageRefs = useRef([]);

  const [index, setIndex] = useState(0);
  const [pageW, setPageW] = useState(Dimensions.get("window").width);
  const [slotW, setSlotW] = useState(MIN_SLOT);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
  const measuredWidths = useRef({});

  



  const PAGES = useMemo(
    () => [
      { key: "SCAN FOOD", Cmp: Scan_Food_Camera },
      { key: "ADD TO INVENTORY", Cmp: InventoryCamera },
      { key: "BARCODE", Cmp: BarcodeCamera },
      { key: "FOOD LABEL", Cmp: FoodLabelCamera },
    ],
    []
  );

  useEffect(() => {
    setActiveKey(PAGES[0]?.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const padLR = Math.max(16, (pageW - slotW) / 2) + PADDING_FUDGE;

  const onLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width || Dimensions.get("window").width;
      if (w && w !== pageW) {
        setPageW(w);
        requestAnimationFrame(() => {
          pagerRef.current?.scrollTo({ x: index * w, animated: false });
          centerLabel(index, w);
        });
      }
    },
    [index, pageW]
  );

  const onLabelLayout = (key) => (e) => {
    const textW = e.nativeEvent.layout.width;
    if (Number.isFinite(textW)) {
      measuredWidths.current[key] = textW;
      const widest = Math.max(
        MIN_SLOT,
        ...Object.values(measuredWidths.current).map((v) => v + 28)
      );
      if (widest !== slotW) setSlotW(widest);
    }
  };

  const onPagerScroll = (e) => {
    if (!pageW || !labelsRef.current) return;
    const x = e.nativeEvent.contentOffset.x;
    const progress = x / pageW;
    const desired = progress * (slotW + GAP) - (pageW / 2 - slotW / 2 - padLR);
    labelsRef.current.scrollTo({ x: Math.max(0, desired), animated: false });
  };

  const onMomentumEnd = (e) => {
    if (!pageW) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i !== index) setIndex(i);
    centerLabel(i, pageW);
    if (PAGES[i]?.key) setActiveKey(PAGES[i].key);
  };

  const centerLabel = (i, w = pageW) => {
    if (!labelsRef.current || !w) return;
    const x = i * (slotW + GAP) - (w / 2 - slotW / 2 - padLR);
    labelsRef.current.scrollTo({ x: Math.max(0, x), animated: true });
  };

  const go = (i) => {
    if (!pageW || !pagerRef.current) return;
    setIndex(i);
    pagerRef.current.scrollTo({ x: i * pageW, animated: true });
    centerLabel(i);
    if (PAGES[i]?.key) setActiveKey(PAGES[i].key);
  };





const inFlight = useRef(false);

const onShutter = useCallback(async () => {
  const ref = pageRefs.current[index];
  const key = PAGES[index]?.key;

  if (!ref?.scan) {
    console.log("[Camera] No scan() exposed by component.", { key });
    return;
  }
  if (inFlight.current) {
    console.log("[Camera] Ignored: shutter in flight");
    return;
  }

  inFlight.current = true;
  console.log("[Camera] Shutter pressed ->", { index, key });

  try {
    // 1) Scan
    const result = await ref.scan(); // whatever your scan returns
    console.log("[Camera] scan() completed for", key, { hasResult: !!result });

    // 2) Save (only if you’re not saving inside scan())
    if (result) {
      await saveMealToDb(result); // or use your existing formData instead of result
      console.log("✅ Saved meal");
    }

    // 3) Tag for OneSignal segment

    console.log("✅ Tagged last_log_date");
  } catch (e) {
    console.log("[Camera] scan/save/tag ERROR for", key, e?.message || e);
  } finally {
    inFlight.current = false;
  }
}, [index]);




  // Only mount the active page when S2 is open and S3 is closed
  const shouldMount = (i) => isS2Open && !isS3Open && i === index;   // ← NEW: gated by isS2Open

  // If S2 is closed, render an empty surface (no cameras mounted)
  if (!isS2Open) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} onLayout={onLayout} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} onLayout={onLayout}>
      {/* PAGER */}
      <GHScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onPagerScroll}
        onMomentumScrollEnd={onMomentumEnd}
        nestedScrollEnabled
        directionalLockEnabled
        removeClippedSubviews={false}
        scrollEnabled={pagerScrollEnabled}
        style={{ zIndex: 0, ...(Platform.OS === "android" ? { elevation: 0 } : null) }}
      >
        {PAGES.map(({ key, Cmp }, i) => (
          <View key={key} style={{ width: pageW, height: "100%" }}>
            {shouldMount(i) ? (
              <Cmp
                ref={(r) => (pageRefs.current[i] = r)}
                inCarousel
                isActive
              />
            ) : null}
          </View>
        ))}
      </GHScrollView>

      {/* OVERLAY */}
      <View
        style={[styles.overlay]}
        pointerEvents={isS3Open ? "none" : "box-none"}
      >
        {/* SHUTTER */}
        <View
          style={[
            styles.shutterWrap,
            { bottom: 64 + (insets?.bottom ?? 0) },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onShutter}
            onPressIn={() => setPagerScrollEnabled(false)}
            onPressOut={() => setPagerScrollEnabled(true)}
            hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
            style={styles.shutterTouch}
          >
            <View style={styles.shutterRing} />
          </TouchableOpacity>
        </View>

        {/* LABELS */}
        <ScrollView
          ref={labelsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: padLR, paddingRight: padLR, alignItems: "center" }}
          style={styles.labelsBar}
          pointerEvents="auto"
        >
          {PAGES.map((p, i) => (
            <GHTouchableOpacity
              key={p.key}
              onPress={() => go(i)}
              onPressIn={() => setPagerScrollEnabled(false)}
              onPressOut={() => setPagerScrollEnabled(true)}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              style={[
                styles.labelBtn,
                { width: slotW },
                i === PAGES.length - 1 ? null : { marginRight: GAP },
              ]}
            >
              <Text
                numberOfLines={1}
                onLayout={onLabelLayout(p.key)}
                style={[
                  styles.label,
                  { opacity: i === index ? 1 : 0.4, fontWeight: i === index ? "800" : "600" },
                ]}
              >
                {p.key}
              </Text>
            </GHTouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const ANDROID_ELEV_HIGH = Platform.select({ android: 100, default: 0 });
const ANDROID_ELEV_MED = Platform.select({ android: 40, default: 0 });

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 9999,
    elevation: ANDROID_ELEV_MED,
  },
  shutterWrap: {
    position: "absolute",
    left: 0, right: 0,
    alignItems: "center",
    zIndex: 10002,
    elevation: ANDROID_ELEV_HIGH,
  },
  shutterTouch: {
    width: 88,
    height: height(25),
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shutterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  labelsBar: {
    position: "absolute",
    bottom: height(14),
    left: 0, right: 0,
    zIndex: 10001,
    elevation: ANDROID_ELEV_MED,
  },
  labelBtn: { paddingVertical: 4, alignItems: "center" },
  label: { color: "#fff", fontSize: size(15), letterSpacing: 1 },
});
