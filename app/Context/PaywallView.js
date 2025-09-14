// PaywallView.js
import { useVideoPlayer, VideoView } from "expo-video";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import Purchases from "react-native-purchases";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurBottom from "../(auth)/AppBlurBottom";
import AppBlurHeader2 from "../Context/AppBlurHeader2";
import { useRevenueCat } from "./RevenueCatContext";

export default function PaywallView({ onClose }) {
  const { isPremium, isTrial, customerInfo, refreshCustomerInfo } = useRevenueCat();
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState("");

  // helper to safely call onClose if provided
  const handleClose = onClose || (() => {});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const m = offerings?.current?.monthly || null;
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

  // Auto-close if user becomes premium (after purchase/restore or if already premium)
  useEffect(() => {
    if (isPremium) {
      handleClose();
    }
  }, [isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBuy = async () => {
    setError("");
    try {
      if (!monthly) return;
      const { customerInfo } = await Purchases.purchasePackage(monthly);
      await refreshCustomerInfo();
      const active = !!customerInfo?.entitlements?.active?.["premium_monthly"];
      if (!active) setError("Purchase did not activate entitlement.");
      // if active, isPremium will flip to true and auto-close via effect
    } catch (e) {
      if (e?.userCancelled) return;
      setError(e?.message || "Purchase failed");
    }
  };

  const onRestore = async () => {
    setError("");
    try {
      await Purchases.restorePurchases();
      await refreshCustomerInfo();
      // if entitlement becomes active, isPremium flips true and auto-close triggers
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
            onPress={handleClose}
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
          disabled={!monthly}
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
            opacity: monthly ? 1 : 0.5,
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
            Continue
          </Text>
        </TouchableOpacity>

        {/* Restore CTA */}
        <TouchableOpacity
          onPress={onRestore}
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
