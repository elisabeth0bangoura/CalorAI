// app/(auth)/AuthHome.jsx
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRef, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

// Firebase v23
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import { ChevronRight } from "lucide-react-native";
import { useSheets } from "../Context/SheetsContext";
import AppBlurBottom from "./AppBlurBottom";
import { googleSignIn } from "./GoogleSignUp/googleSignIn";
import LogIn from "./Login";
import { signUpWithApple } from "./signUpWithApple";










export default function AuthHome() {
  globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

  const router = useRouter();
  const [loading, setLoading] = useState({ apple: false, google: false, email: false });
  const lottieRef = useRef(null);


   const {
    register, present, dismiss, dismissAll,
   isLogIn, setIsLogIn
  } = useSheets();



  const tap = async (fn) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return fn?.();
  };

  const decideNext = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const snap = await firestore().collection("users").doc(user.uid).get();
      const completed = !!snap.data()?.onboardingCompleted;
      router.replace(completed ? "/(tabs)" : "/(auth)/signUp");
    } catch {
      router.replace("/(auth)/signUp");
    }
  };

  const onApple = async () => {
    if (loading.apple) return;
    setLoading((s) => ({ ...s, apple: true }));
    try {
      const userCred = await signUpWithApple();
      if (userCred) {
        const email = userCred.user?.email ?? auth().currentUser?.email ?? "";
        router.push({ pathname: "/(auth)/signUp", params: { Email: email, method: "apple" } });
      }
    } finally {
      setLoading((s) => ({ ...s, apple: false }));
    }
  };

  const onGoogle = async () => {
    if (loading.google) return;
    setLoading((s) => ({ ...s, google: true }));
    try {
      const cred = await googleSignIn();
      if (cred) {
        const email = cred?.userCredential?.user?.email ?? auth().currentUser?.email ?? "";
        router.push({ pathname: "/(auth)/signUp", params: { Email: email, method: "google" } });
      }
    } finally {
      setLoading((s) => ({ ...s, google: false }));
    }
  };

  const onEmail = async () => {
    if (loading.email) return;
    setLoading((s) => ({ ...s, email: true }));
    try {
      router.replace("/(auth)/Login");
    } finally {
      setLoading((s) => ({ ...s, email: false }));
    }
  };

  // 🎥 expo-video player
  const source = require("../../assets/AnimationSignUp.mov");
  const player = useVideoPlayer(source, (p) => {
    p.audioMixingMode = "mixWithOthers"; // keep Spotify playing
    p.muted = true;
    p.volume = 0;
    p.loop = true;
    p.staysActiveInBackground = true;     // requires config plugin
    p.showNowPlayingNotification = false; // no system banner
    p.play();
  });

  return (

    <>
    
        <TrueSheet
        ref={register("LogIn")}
        sizes={[height(32)]}
        cornerRadius={24}
        enablePanDownToClose
        backgroundColor="#fff"
        onChange={(index) => setIsLogIn(typeof index === "number" && index >= 0)}
        onDismiss={() => setIsLogIn(false)}
      >
       <LogIn />
      </TrueSheet>


    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <StatusBar style="dark" />

      {/* Background video */}
      <View style={{ alignItems: "center", marginTop: height(-5) }}>
        <VideoView
          player={player}
          style={{ alignSelf: "center", height: "100%", width: "100%", marginTop: height(-5) }}
          contentFit="contain"
          nativeControls={false}
          playsInline
          allowsPictureInPicture={false}
          startsPictureInPictureAutomatically={false}
          onPictureInPictureStart={async () => { try { await player.stopPictureInPicture(); } catch {} }}
        />
      </View>

      {/* soft gradient for legibility */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height(28),
          backgroundColor: "transparent",
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.0)",
          }}
        />
        <View
          style={{
            height: "70%",
            backgroundColor: "rgba(255,255,255,0.9)",
          }}
        />
      </View>

      {/* Headline */}
      <Text
        style={{
          fontSize: size(34),
          position: "absolute",
          width: "85%",
         
          bottom: height(20),
          zIndex: 1000,
          fontWeight: "800",
          alignSelf: "center",
          lineHeight: size(38),
          color: "#111",
          textShadowColor: "rgba(0,0,0,0.06)",
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }}
      >
      Track your fridge, track your calories.
      </Text>

      {/* Actions */}
      <View
        style={{
          position: "absolute",
          flexDirection: "row",
          alignSelf: "center",
          zIndex: 1000,
          bottom: height(16),
          width: "85%",
        }}
      >
        <TouchableOpacity
          onPressIn={() => { router.push("/(auth)/signUp"); }}
          style={{
            height: size(60),
            left: width(0),
            position: "absolute",
            width: size(150),
            borderRadius: size(16),
            paddingHorizontal: size(20),
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <Text style={{ fontSize: size(14), fontWeight: "800" }}>Get started</Text>
          <ChevronRight size={22} color={"#000"} style={{ position: "absolute", right: width(5) }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPressIn={() => {
            present("LogIn")
          }}
          style={{
            height: size(60),
            right: width(0),
            position: "absolute",
            width: size(170),
            borderRadius: size(16),
            paddingHorizontal: size(20),
            alignItems: "center",
            flexDirection: "row",
            backgroundColor: "#151515",
            ...Platform.select({
              ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.5, shadowRadius: 10 },
              android: { elevation: 8, shadowColor: "#ccc" },
            }),
          }}
        >
          <Text numberOfLines={1} style={{ fontSize: size(14), fontWeight: "800", marginLeft: width(1), color: "#fff" }}>
            Log In
          </Text>
          <ChevronRight size={22} color={"#fff"} style={{ position: "absolute", right: width(5) }} />
        </TouchableOpacity>
      </View>

      <AppBlurBottom />
    </View>






    </>
  );
}
