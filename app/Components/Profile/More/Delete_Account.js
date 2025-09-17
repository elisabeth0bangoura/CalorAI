// WeightTimelineByDay.js  (AutoAdjustMacros sheet)
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import { useSheets } from "@/app/Context/SheetsContext";
import { deleteUser, getAuth } from "@react-native-firebase/auth";
import { collection, doc, getDocs, getFirestore, query, where, writeBatch } from "@react-native-firebase/firestore";
import { BlurView } from "expo-blur";
import { Check, ChevronLeft, MoveRight, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";

export default function Delete_Account() {
  const { register, present, dismiss, dismissAll } = useSheets();

  const [OpenVerify, setOpenVerify] = useState(false);
const [confirmText, setConfirmText] = useState("");
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKbHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingBottom: 200
    },
    inner: {
      padding: 24,
      flex: 1,
      justifyContent: "space-around",
    },
    header: {
      fontSize: 36,
      marginBottom: 48,
    },
    textInput: {
      height: 40,
      borderColor: "#000000",
      borderBottomWidth: 1,
      marginBottom: 36,
    },
    btnContainer: {
      backgroundColor: "white",
      marginTop: 12,
    },
  });

  const db = getFirestore();
  const auth = getAuth();

  const COLLECTIONS_TO_WIPE = ["users", "weights", "progress", "entries", "logs"];

  const deleteUserData = async (uid) => {
    const firstBatch = writeBatch(db);
    firstBatch.delete(doc(db, "users", uid));
    await firstBatch.commit();

    const MAX_BATCH = 450;
    for (const col of COLLECTIONS_TO_WIPE) {
      if (col === "users") continue;
      const q = query(collection(db, col), where("uid", "==", uid));
      const snap = await getDocs(q);
      if (snap.empty) continue;

      let ops = 0;
      let batch = writeBatch(db);
      for (const d of snap.docs) {
        batch.delete(d.ref);
        ops++;
        if (ops >= MAX_BATCH) {
          await batch.commit();
          ops = 0;
          batch = writeBatch(db);
        }
      }
      if (ops > 0) {
        await batch.commit();
      }
    }
  };

  const handleDeletePress = async () => {
   
    try {
      Keyboard.dismiss();
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("No user", "You're not signed in.");
        return;
      }
      await deleteUserData(user.uid);
      await deleteUser(user);
      
      setOpenVerify(false);
    } catch (e) {
      Alert.alert("Delete failed", e?.message ?? "Please sign in again and try deleting.");
    }
  };

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                width: "100%",
                height: height(100),
              }}
            >
              <Text
                style={{
                  fontSize: size(25),
                  marginLeft: width(5),
                  fontWeight: "800",
                  lineHeight: height(3.8),
                  marginTop: height(5),
                }}
              >
                Delete Account
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  width: "90%",
                  marginTop: height(4),
                  alignSelf: "center",
                }}
              >
                <View>
                  <Text
                    style={{
                      marginBottom: height(2),
                      fontWeight: "700",
                      fontSize: size(16),
                    }}
                  >
                    Are you sure you want to delete your account?
                  </Text>
                  <Text
                    style={{
                      lineHeight: height(2.5),
                      fontSize: size(14),
                    }}
                  >
                    This will permanently delete your account, progress, and all associated data. This action cannot be undone.
                  </Text>
                </View>
              </View>

              {OpenVerify && (
                <>
                  <BlurView
                    tint="light"
                    intensity={30}
                    pointerEvents="none"
                    style={{
                      height: height(100),
                      position: "absolute",
                      width: "100%",
                      zIndex: 900,
                    }}
                  />

                      <TouchableOpacity
                      onPress={() => {
                        setOpenVerify(false);
                      }}
                      style={{
                        height: size(50),
                        width: size(50),
                        zIndex: 1000,
                        top: height(2),
                        position: 'absolute',
                        right: width(5),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={35} />
                    </TouchableOpacity>


                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setOpenVerify(false);
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 950,
                    }}
                  />
                  <View
                    style={[
                      {
                        height: height(35),
                        width: "90%",
                        borderRadius: 15,
                        backgroundColor: "#fff",
                        position: "absolute",
                        zIndex: 1000,
                        ...Platform.select({
                          ios: {
                            shadowColor: "#000",
                            shadowOffset: { width: 2, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                          },
                          android: { elevation: 10, shadowColor: "#999" },
                        }),
                        alignSelf: "center",
                      },
                      kbHeight > 0 ? { bottom: kbHeight + height(2) } : { marginTop: height(25) },
                    ]}
                  >
                

                    <Text
                      style={{
                        fontSize: size(25),
                        marginLeft: width(5),
                        fontWeight: "800",
                        lineHeight: height(3.8),
                        marginTop: height(5),
                      }}
                    >
                      Confirm deletion
                    </Text>

                    <Text
                      style={{
                        fontSize: size(14),
                        marginLeft: width(5),
                        fontWeight: "700",
                        lineHeight: height(3.8),
                      }}
                    >
                      Please type DELETE to continue.
                    </Text>

                  <TextInput
                  value={confirmText}
                  onChangeText={(text) => {
                    const v = text.toUpperCase();
                    setConfirmText(v);
                    console.log(v);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="DELETE"
                  placeholderTextColor="#999"
                  style={{
                    width: "90%",
                    fontSize: size(16),
                    borderWidth: 1,
                    marginLeft: width(5),
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 15,
                    marginTop: height(2),
                    borderColor: "#f5f5f5",
                  }}
                />
                    <TouchableOpacity
                      onPress={handleDeletePress}
                      hitSlop={8}
                      disabled={confirmText == "" ? true : false}
                      style={{
                        bottom: height(3),
                        opacity: confirmText == "" ? 0.3 : 9,
                        right: width(5),
                        zIndex: 100,
                        paddingVertical: 14,
                        position: "absolute",
                        flexDirection: "row",
                        width: size(135),
                        right: width(5),
                        height: size(50),
                        paddingHorizontal: 20,
                        alignItems: "center",
                        borderRadius: 15,
                        backgroundColor: "#000",
                        ...Platform.select({
                          ios: {
                            shadowColor: "#000",
                            shadowOffset: { width: 2, height: 1 },
                            shadowOpacity: 0.04,
                            shadowRadius: 10,
                          },
                          android: { elevation: 4, shadowColor: "#ccc" },
                        }),
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: size(14),
                          fontWeight: "700",
                        }}
                      >
                        Confirm
                      </Text>

                        <Check
                          size={18}
                          color="#fff"
                          style={{
                            marginLeft: width(5),
                          }}
                        />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>





















                <TouchableOpacity
              onPress={() => {
               dismiss("Delete_Account")
              }}
              hitSlop={8}
              style={{
               position: "absolute",
                  backgroundColor: "#EDEFF1",
                  height: size(50),
                  paddingHorizontal: 20,
                  left: width(5),
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                 top: height(78),
              }}
            >
            <ChevronLeft size={25} color={"#000"} />
            </TouchableOpacity>




            <TouchableOpacity
              onPress={() => {
                setOpenVerify(true);
              }}
              hitSlop={8}
              style={{
                top: height(78),
                zIndex: 100,
                paddingVertical: 14,
                flexDirection: "row",
                width: size(125),
                right: width(5),
                height: size(50),
                paddingHorizontal: 20,
                alignItems: "center",
                position: "absolute",
                borderRadius: 15,
                backgroundColor: "#000",
                ...Platform.select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 2, height: 1 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                  },
                  android: { elevation: 4, shadowColor: "#ccc" },
                }),
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: size(14),
                  fontWeight: "700",
                }}
              >
                Delete
              </Text>

              <MoveRight
                size={18}
                color="#fff"
                style={{
                  marginLeft: width(5),
                }}
              />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
