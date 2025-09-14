// HealthChecksCardFlatList.js
import * as LucideIcons from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Platform, Text, View } from "react-native";
import { height, width as rsWidth, size, width } from "react-native-responsive-sizes";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "@react-native-firebase/firestore";
import { Image } from "expo-image";

/* ---------- palette / tokens (Trade-Republic-ish) ---------- */
const COL = {
  text: "#0A0A0A",
  sub: "#88919B",
  line: "#E9EEF5",
  card: "#FFFFFF",
};

/* ---------- helpers ---------- */
const stripEmojiPrefix = (s = "") =>
  s.replace(/^\s*(?:[\p{Extended_Pictographic}\uFE0F\u200D]+)\s*/u, "").trim();

const FLAG_ICON = { kidney: "Droplets", heart: "Heart", diabetes: "Syringe" };
const FLAG_COLORS = {
  kidney: { bg: "#EAF2FF", fg: "#1E67FF" },
  heart: { bg: "#FFECEF", fg: "#FE1B20" },
  diabetes: { bg: "#FFF6E6", fg: "#F59E0B" },
};

const normalizeImageUrl = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const u = raw.trim();
  return u.startsWith("http://") || u.startsWith("https://") ? u : null;
};

const buildFlags = (data) => {
  const parts = (data?.proms && data.proms.parts) || data?.parts || {};
  const order = ["kidney", "heart", "diabetes"];
  return order
    .map((key) => {
      const raw = typeof parts[key] === "string" ? parts[key] : "";
      if (!raw) return null;
      return { key, text: stripEmojiPrefix(raw), icon: FLAG_ICON[key] || "Info" };
    })
    .filter(Boolean);
};

const formatCreatedAt = (raw) => {
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (isNaN(d)) return "";
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return isToday
    ? `Today ${time}`
    : `${d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} ${time}`;
};

/* ---------- component ---------- */
export default function HealthChecksCardFlatList({
  userId,
  docId = null,
  showHeader = true,
}) {
  const uid = userId || getAuth().currentUser?.uid;
  const db = getFirestore();

  // one full RecentlyEaten entry (rendered as a single FlatList item)
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    if (!uid) return;

    const applyDoc = (snap) => {
      if (!snap?.exists) return;
      const data = snap.data() || {};
      const imageUri =
        normalizeImageUrl(data.image_cloud_url) ||
        normalizeImageUrl(data.image_url) ||
        normalizeImageUrl(data.image) ||
        null;

      setEntry({
        id: snap.id,
        title: typeof data.title === "string" ? data.title : "Scanned meal",
        created_at: data.created_at || data.createdAt || null,
        imageUri,
        flags: buildFlags(data),
      });
    };

    if (docId) {
      const ref = doc(db, `users/${uid}/RecentlyEaten/${docId}`);
      const un = onSnapshot(ref, applyDoc);
      return () => un && un();
    }

    // latest by either created_at or createdAt
    const col = collection(db, `users/${uid}/RecentlyEaten`);
    const q1 = query(col, orderBy("created_at", "desc"), limit(1));
    const q2 = query(col, orderBy("createdAt", "desc"), limit(1));

    let chosen = null;
    const attach = (qRef, tag) =>
      onSnapshot(qRef, (snap) => {
        const docs = snap.docs || [];
        if (!docs.length) return;
        if (!chosen) chosen = tag;
        if (chosen === tag) applyDoc(docs[0]);
      });

    const un1 = attach(q1, "created_at");
    const un2 = attach(q2, "createdAt");
    return () => {
      un1 && un1();
      un2 && un2();
    };
  }, [uid, db, docId]);

  if (!uid) return null;

  const AV = 44; // avatar size

  const Header = showHeader ? (
    <Text
      style={{
        marginTop: height(15),
        marginBottom: height(1.5),
        marginLeft: rsWidth(5),
        fontSize: size(20),
        fontWeight: "900",
        color: COL.text,
      }}
    >
      Health Checks
    </Text>
  ) : null;

  return (
    <FlatList 
      data={entry ? [entry] : []}
      keyExtractor={(it) => it.id}
      contentContainerStyle={{ paddingTop: height(12), paddingBottom: height(5)  }}
      renderItem={({ item }) => (
        <View style={{ top: height(2), paddingHorizontal: rsWidth(5) }}>
          {/* timestamp */}
          {item.created_at && (
            <Text
              style={{
                color: "#000",
                fontSize: size(14),
                fontWeight: "800",
                marginBottom: height(5),
              }}
            >
              {formatCreatedAt(item.created_at)}
            </Text>
          )}

          {/* timeline + content */}
          <View style={{ flexDirection: "row", marginLeft: width(5) }}>
            {/* left timeline */}
            <View
              style={{
        
                width: 16,
                alignItems: "center",
              }}
            >

                   <View
                  style={{
                    height: AV,
                    width: AV,
                    alignSelf: 'center',
                    borderRadius: AV / 2,
                    zIndex: 1,
                    overflow: "hidden",
                    backgroundColor: "#F2F4F7",
                    
                    ...Platform.select({
                      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
                      android: { elevation: 1 },
                    }),
                  }}
                >
                  {item.imageUri ? (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={{ height: "100%", width: "100%" }}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: "#F2F4F7",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LucideIcons.Image size={18} color="#9AA3AD" />
                    </View>
                  )}
                </View>


              <View
                style={{
                    marginTop: height(3),
                  position: "absolute",
                  top: AV / 2 + 8,
                  bottom: 0,
                  width: 2,
                  backgroundColor: COL.line,
                }}
              />
            </View>



            {/* main column */}
            <View style={{ flex: 1,  marginTop: height(0), paddingLeft: 4 }}>
              {/* header row with avatar + title */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: height(2) }}>
             

                <Text
                  numberOfLines={2}
                  style={{
                    marginLeft: width(8),
                    color: COL.text,
                    fontSize: size(16),
                    lineHeight: 22,
                    fontWeight: "900",
                  }}
                >
                  {item.title}
                </Text>
              </View>

              {/* flags list (single card feel, no borders) */}
              {(item.flags && item.flags.length > 0) ? (
                item.flags.map((f, idx) => {
                  const Icon = LucideIcons[f.icon] || LucideIcons.Info;
                  const { bg, fg } = FLAG_COLORS[f.key] || { bg: "#F3F4F6", fg: "#111" };
                  return (
                    <View
                      key={`${f.key}-${idx}`}
                      style={{
                        flexDirection: "row",
                        marginLeft: width(8),
                        alignItems: "flex-start",
                        paddingVertical: height(1.6),
                       
                      }}
                    >
                      <View
                        style={{
                          height: size(30),
                          width: size(30),
                          borderRadius:size(30)/2,

                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: width(3),
                        }}
                      >
                        <Icon size={16} strokeWidth={3}  color={"#000"} />
                      </View>

                      <Text
                        style={{
                          flex: 1,
                          color: COL.text,
                          fontSize: size(16),
                          lineHeight: height(2.8),
                        }}
                      >
                        {f.text}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: COL.sub, fontSize: size(15), fontWeight: "700" }}>
                  No health notices for this item.
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    />
  );
}
