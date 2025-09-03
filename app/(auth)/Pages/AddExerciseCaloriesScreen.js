// AddExerciseCaloriesScreen.js
import { useVideoPlayer, VideoView } from "expo-video";
import { Flame } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";
import { useSteps } from "../../Context/StepsContext";

export default function AddExerciseCaloriesScreen({
  active,                          // <-- passed from pager as isActive={i===step}
  onChoose,
  progress = 0.68,
  title = "Add your workout burn back to today’s budget?",
  goalLabel = "Today’s Target",
  goalCals = 500,
  activity = "Burned",
  activityDelta = 100,
}) {
  const pct = useMemo(() => Math.max(0, Math.min(1, progress)) * 100, [progress]);
  const { next } = useSteps();

  const {
    AddExerciseCalories, setAddExerciseCalories,
  } = useOnboarding()


  
  const source = require("../../../assets/Gym1.mp4");

  // Create player once
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;     // 🔁
    p.muted = true;    // 🔇
    p.play();          // ▶️ start immediately
  });

  // React to visibility changes
  useEffect(() => {
    if (!player) return;
    if (active) {
      // make sure it actually starts even after being offscreen
      try { player.replay(); } catch {}
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  return (
    <View style={{ height: "90%", alignSelf: "center", width: "100%", backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 28, marginLeft: width(5), width: "90%", marginTop: height(14), fontWeight: "700" }}>
        {title}
      </Text>

      <Text style={{ fontSize: size(14), width: "90%", marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>
        When you move more, you can eat a little more and stay on track.
      </Text>

      {/* Video card */}
      <View
        style={{
          height: height(50),
          marginTop: height(3),
          marginHorizontal: width(5),
          borderRadius: 24,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <VideoView
          player={player}
          style={{ alignSelf: "center", height: 1000, width: 1000, top: -250 }}
          contentFit="contain"
          nativeControls={false}
          playsInline
          // 💡 Important on Android when inside Animated translateX pagers
          surfaceType={Platform.OS === "android" ? "textureView" : "surfaceView"}
          // Don’t allow PiP for this background loop
          allowsPictureInPicture={false}
        />

        {/* Overlay stat card */}
        <View
          style={{
            position: "absolute",
            left: width(5),
            top: height(32),
            backgroundColor: "#fff",
            zIndex: 10,
            borderRadius: 18,
            paddingVertical: height(1.8),
            paddingHorizontal: width(4),
            width: "64%",
            ...Platform.select({
              ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 15 },
              android: { elevation: 6, shadowColor: "#00000050" },
            }),
          }}
        >
          <Text style={{ fontSize: size(12), fontWeight: "800", color: "#868B94", marginBottom: 6 }}>
            {goalLabel}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Flame strokeWidth={3} size={18} />
            <Text style={{ marginLeft: 6, fontSize: size(24), fontWeight: "900", color: "#141518" }}>
              {goalCals} Cals
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
            <Text style={{ fontSize: size(18), marginRight: 6 }}>👟</Text>
            <Text style={{ fontWeight: "800", color: "#141518" }}>{activity}</Text>
            <View style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#F4F6FA" }}>
              <Text style={{ fontWeight: "800", color: "#141518" }}>{`+${activityDelta} cals`}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={{ position: "absolute", width: "85%", top: height(82), alignSelf: "center", flexDirection: "row" }}>
        <TouchableOpacity
          onPress={() => { setAddExerciseCalories("no"); next(); }}
          activeOpacity={0.9}
          style={{ backgroundColor: "#1A1A1A", height: size(52), borderRadius: 16, alignItems: "center", justifyContent: "center", width: "48%", marginRight: width(3) }}
        >
          <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "800" }}>No</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setAddExerciseCalories("yes"); next(); }}
          activeOpacity={0.9}
          style={{ backgroundColor: "#1A1A1A", height: size(52), borderRadius: 16, alignItems: "center", justifyContent: "center", width: "48%", marginLeft: width(3) }}
        >
          <Text style={{ color: "#fff", fontSize: size(16), fontWeight: "800" }}>Yes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
