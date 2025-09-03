// TrustIntroScreen.js
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { Lock } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

export default function TrustIntroScreen({
  onBack = () => {},
  onContinue = () => {},
  progress = 0.6, // 0..1
  title = "Thanks for trusting Bantico",
  subtitle = "We’re about to tailor Bantico to you—habits, meals, and guidance that fit your life.",
  active = false, // <- control from parent (isActive)
}) {
  const progressPct = Math.max(0, Math.min(1, progress)) * 100;

  // keep one confetti instance mounted; start/stop based on `active`
  const confettiRef = useRef(null);
  const prevActive = useRef(active);


   const animation = useRef(null);
  useEffect(() => {
    // You can control the ref programmatically, rather than using autoPlay
    // animation.current?.play();
  }, []);



  useEffect(() => {
    // only react when the boolean actually changes
    if (active && !prevActive.current) {
      requestAnimationFrame(() => confettiRef.current?.startConfetti());
    } else if (!active && prevActive.current) {
      confettiRef.current?.stopConfetti();
    }
    prevActive.current = active;
  }, [active]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Top bar */}
      

      {/* Illustration */}
      <View style={{ marginTop: height(14), zIndex: 1000, alignItems: "center", justifyContent: "center" }}>
      
      
          <View
            style={{
              height: height(20),
              width: height(20),
              backgroundColor: "#fff",
              borderRadius: height(20) / 2,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: size(48) }}>🙌🏾</Text>
          </View>
    
      </View>

      {/* Title + subtitle */}
      <View style={{ marginTop: height(4), zIndex: 1000, paddingHorizontal: width(6) }}>
        <Text style={{ fontSize: size(30), lineHeight: size(36), fontWeight: "800", color: "#101012", textAlign: "center" }}>
          {title}
        </Text>
        <Text style={{ marginTop: height(1.2), fontSize: size(14), fontWeight: "700", color: "#9AA0A6", textAlign: "center" }}>
          {subtitle}
        </Text>
      </View>

      {/* Privacy card */}
      <View style={{ marginTop: height(5),  paddingHorizontal: width(5) }}>
        <LinearGradient
          colors={["#F6F7FB", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, paddingVertical: height(2.2), paddingHorizontal: width(5), alignItems: "center" }}
        >
          <View
            style={{
              height: size(36),
              width: size(36),
              zIndex: 1000,
              borderRadius: size(36) / 2,
              backgroundColor: "#EEF2FF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: height(1.2),
            }}
          >
            <Lock size={18} color="#6B7BFF" />
          </View>

          <Text style={{ fontSize: size(16), zIndex: 1000, fontWeight: "800", color: "#1A1B1F", textAlign: "center" }}>
            Your privacy and security matter to us.
          </Text>
          <Text style={{ marginTop: height(0.8), zIndex: 1000, fontSize: size(13), fontWeight: "600", color: "#6B6F76", textAlign: "center" }}>
            Data stays private and encrypted. You control what’s shared—always.
          </Text>
        </LinearGradient>
      </View>

      {/* Confetti overlay (always mounted, controlled by ref) */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
         
       <LottieView
        autoPlay
        ref={animation}
        style={{
          width: "100%",
          marginTop: height(-15),
          alignSelf: 'center',
          height:  "150%",

        }}
        // Find more Lottie files at https://lottiefiles.com/featured
        source={require('../../../assets/ConfettiAnimation.json')}
      />

      </View>

  
  
    </View>
  );
}
