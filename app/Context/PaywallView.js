// PaywallView.js
import { useVideoPlayer, VideoView } from "expo-video";
import { X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import Purchases, { PURCHASES_ERROR_CODE } from "react-native-purchases";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurBottom from "../(auth)/AppBlurBottom";
import AppBlurHeader2 from "../Context/AppBlurHeader2";
import { useRevenueCat } from "./RevenueCatContext";

export default function PaywallView({ onClose }) {
  const {
    isPremium,
    isTrial,
    refreshCustomerInfo,
    // optional: you said you track this in context
    ClickedOnBtn,
    setClickedOnBtn,
  } = useRevenueCat();

  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const ENTITLEMENT_KEY = "premium"; // <-- set this to your actual entitlement id in RevenueCat
  const handleClose = onClose || (() => {});

  // fetch offerings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError("");
        const offerings = await Purchases.getOfferings();
        // Prefer the explicit "monthly" package if present; fall back to first available package
        const m =
          offerings?.current?.monthly ||
          offerings?.current?.availablePackages?.find((p) => p.identifier?.includes("MONTHLY")) ||
          offerings?.current?.availablePackages?.[0] ||
          null;
        if (mounted) setMonthly(m);
      } catch (e) {
        if (mounted) setError(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // close if premium flips true (after purchase/restore)
  useEffect(() => {
    if (isPremium) {
      handleClose();
      // if you track the click flag, reset it so we don't auto-launch again later
      setClickedOnBtn?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  // Auto-launch Apple sheet once monthly is ready if you came here from a button click
  const autoLaunched = useRef(false);
  useEffect(() => {
    if (!loading && monthly && !isPremium && ClickedOnBtn && !autoLaunched.current) {
      autoLaunched.current = true;
      onBuy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, monthly, isPremium, ClickedOnBtn]);

  const onBuy = async () => {
    if (!monthly || purchasing) return;
    setError("");
    setPurchasing(true);
    try {
      // This opens Apple’s payment sheet
      const { customerInfo: ci } = await Purchases.purchasePackage(monthly);

      // Optional but recommended to sync your context
      await refreshCustomerInfo();

      // Verify entitlement immediately using the returned object
      const active = !!ci?.entitlements?.active?.[ENTITLEMENT_KEY];
      if (!active) {
        setError("Purchase did not activate entitlement.");
        return;
      }
      // isPremium should flip true in your context → auto-close effect runs
    } catch (e) {
      // Known RevenueCat codes
      if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e?.userCancelled) {
        // user cancelled; no error message needed
      } else if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        setError("Purchases not allowed on this device.");
      } else if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR) {
        setError("Invalid purchase. Please try again.");
      } else if (e?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        setError("Payment pending. You’ll be unlocked once it completes.");
      } else {
        setError(e?.message || "Purchase failed");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const onRestore = async () => {
    setError("");
    try {
      await Purchases.restorePurchases();
      await refreshCustomerInfo();
    } catch (e) {
      setError(e?.message || "Restore failed");
    }
  };

  // 🎥 expo-video player
  const source = require("../../assets/AnimationSignUp.mov");
  const player = useVideoPlayer(source, (p) => {
    p.audioMixingMode = "mixWithOthers";
    p.muted = true;
    p.volume = 0;
    p.loop = true;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = false;
    p.play();
  });

  // Already premium? (edge case if onClose wasn’t passed)
  if (isPremium) {
    return (
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>
          🎉 Premium aktiv {isTrial ? "(Trial)" : ""}
        </Text>
        <Text style={{ fontSize: 14, color: "#666" }}>Danke fürs Unterstützen!</Text>
        <Pressable
          onPress={handleClose}
          style={{
            marginTop: 8,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: "#111",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Weiter zur App</Text>
        </Pressable>
      </View>
    );
  }

  const price = monthly?.product?.priceString ?? "";
  const title = monthly?.product?.title ?? "Premium (Monat)";
  const desc = monthly?.product?.description ?? "Alle Premium-Features freischalten";
  const hasIntro = !!monthly?.product?.introductoryPrice;

  return (
    <>
      <View
        style={{
          height: "100%",
          paddingTop: height(14),
          width: "100%",
          backgroundColor: "#fff",
          zIndex: 1000,
          position: "absolute",
        }}
      >
        <AppBlurHeader2 />

        {/* Header row with X */}
        <View
          style={{
            position: "absolute",
            width: "90%",
            alignSelf: "center",
            marginTop: height(4),
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setClickedOnBtn?.(false);
              handleClose();
            }}
            style={{
              height: size(50),
              width: size(50),
              zIndex: 1000,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <X size={30} />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: size(30),
              zIndex: 100,
              marginLeft: width(5),
              width: "100%",
              alignSelf: "center",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Unlock Bantico to reach your health goals faster.
          </Text>
        </View>

        {hasIntro && (
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "#eef6ff",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#2563eb", fontWeight: "600" }}>Free trial available</Text>
          </View>
        )}

        {!!error && (
          <Text style={{ position: "absolute", color: "#b91c1c", top: height(12), alignSelf: "center" }}>
            {error}
          </Text>
        )}

        {/* Background video */}
        <View style={{ alignItems: "center", marginTop: height(0) }}>
          <VideoView
            player={player}
            style={{ alignSelf: "center", height: "110%", width: "110%", marginTop: height(-10) }}
            contentFit="contain"
            nativeControls={false}
            playsInline
            allowsPictureInPicture={false}
            startsPictureInPictureAutomatically={false}
            onPictureInPictureStart={async () => {
              try {
                await player.stopPictureInPicture();
              } catch {}
            }}
          />
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          disabled={!monthly || purchasing}
          onPress={onBuy}
          style={{
            height: size(60),
            width: "90%",
            zIndex: 1000,
            alignSelf: "center",
            justifyContent: "center",
            position: "absolute",
            bottom: height(17),
            backgroundColor: "#000",
            borderRadius: size(15),
            opacity: monthly && !purchasing ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: size(15),
              fontWeight: "bold",
              alignSelf: "center",
            }}
          >
            {purchasing ? "Processing..." : "Continue"}
          </Text>
        </TouchableOpacity>

        {/* Restore CTA */}
        <TouchableOpacity
          onPress={onRestore}
          disabled={purchasing}
          style={{
            height: size(60),
            width: "90%",
            alignSelf: "center",
            justifyContent: "center",
            position: "absolute",
            zIndex: 1000,
            bottom: height(8),
            borderColor: "#000",
            borderWidth: 1,
            borderRadius: size(15),
            opacity: purchasing ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              color: "#000",
              fontSize: size(15),
              fontWeight: "bold",
              alignSelf: "center",
            }}
          >
            Already purchased?
          </Text>
        </TouchableOpacity>

        <AppBlurBottom />
      </View>
    </>
  );
}
