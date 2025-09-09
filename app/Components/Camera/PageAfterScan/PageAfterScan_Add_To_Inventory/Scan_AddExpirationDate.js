import { useCurrentScannedItemId } from "@/app/Context/CurrentScannedItemIdContext";
import { useScanResults } from "@/app/Context/ScanResultsContext";
import { useSheets } from "@/app/Context/SheetsContext";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import axios from "axios";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import LoadingPage_ExpirationDate from "./LoadingPage_ExpirationDate";

const OPENAI_API_KEY_FALLBACK =
  "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";

export default function Scan_AddExpirationDate() {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { currentItemId } = useCurrentScannedItemId();

  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [showLoader, setShowLoader] = useState(false);

  const { expirationDate, setExpirationDate } = useScanResults();
  const { dismiss, isS5Open } = useSheets();

  // ✅ Ask for permission only when S5 is open
  useEffect(() => {
    if (!isS5Open) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [isS5Open, permission, requestPermission]);

  // ✅ cleanup camera when S5 closes
  useEffect(() => {
    if (!isS5Open) {
      console.log("[S5 Camera] unmounting");
      cameraRef.current = null;
      setBusy(false);
      setShowLoader(false);
    }
  }, [isS5Open]);

  const ensurePermission = async () => {
    if (!isS5Open) return false; // don't do anything if sheet not open
    if (!permission?.granted) {
      const res = await requestPermission();
      return !!res?.granted;
    }
    return true;
  };

  const uploadWithNativeStorage = async (fileUri) => {
    const path = `expiration/${Date.now()}.jpg`;
    const ref = storage().ref(path);
    const task = ref.putFile(fileUri, { contentType: "image/jpeg" });
    return new Promise((resolve, reject) => {
      task.on("state_changed", null, reject, async () => resolve(await ref.getDownloadURL()));
    });
  };

  const askOpenAIForDate = async (url) => {
    const aiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You extract expiration dates from food package images. Only return the date as text." },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the expiration date from this image. Only reply with the date in YYYY-MM-DD format." },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY_FALLBACK}`,
          "Content-Type": "application/json",
        },
      }
    );
    return aiRes?.data?.choices?.[0]?.message?.content ?? "";
  };

  const onShutter = async () => {
    try {
      if (busy) return;
      const ok = await ensurePermission();
      if (!ok) return Alert.alert("Camera", "Please enable camera permission.");

      if (!cameraRef.current) return Alert.alert("Camera", "Camera not ready.");

      setShowLoader(true);
      setBusy(true);
      setImageUrl(null);
      setExpirationDate(null);

      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      if (!shot?.uri) throw new Error("No image URI from camera");

      const url = await uploadWithNativeStorage(shot.uri);
      setImageUrl(url);

      const rawText = await askOpenAIForDate(url);
      const dateOnly = String(rawText).trim();

      setExpirationDate(dateOnly);

      if (currentItemId) {
        try {
          const db = getFirestore();
          const uid = getAuth().currentUser.uid;
          const docRef = doc(db, "users", uid, "Inventory", currentItemId);
          await setDoc(docRef, { expirationDate: dateOnly }, { merge: true });
          console.log("[Firestore] expirationDate merged for doc:", currentItemId);
        } catch (err) {
          console.warn("[Firestore ERR]", err);
        }
      }

      dismiss?.("s5");
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", String(e?.message || e));
      setShowLoader(false);
    } finally {
      setBusy(false);
    }
  };

  // 🧠 UI — only mount the camera when S5 is open
  return (
    <View style={{ height: height(100), width: width(100), backgroundColor: "#000" }}>
      {isS5Open ? (
        <>
          <CameraView
            key="s5-camera"                 // key to force clean remount each time
            ref={cameraRef}
            style={{ height: "100%", width: "100%" }}
            facing="back"
            flash="off"
            autofocus="on"
          />

          {/* Shutter */}
          <TouchableOpacity
            onPress={onShutter}
            disabled={busy}
            style={{
              borderWidth: 6,
              width: size(90),
              height: size(90),
              borderRadius: size(90) / 2,
              position: "absolute",
              zIndex: 100,
              borderColor: busy ? "#888" : "#fff",
              bottom: height(16),
              alignSelf: "center",
            }}
          />

          {/* Loader */}
          {showLoader && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <LoadingPage_ExpirationDate
                messages={["Uploading photo", "Analyzing label", "Reading expiration date"]}
                isDone={!!expirationDate}
                onDone={() => setShowLoader(false)}
              />
            </View>
          )}
        </>
      ) : (
        // When closed: no CameraView mounted at all
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff" }}>Camera paused</Text>
        </View>
      )}
    </View>
  );
}
