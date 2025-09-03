import { Image } from "expo-image";
import { MoreHorizontalIcon, Users } from "lucide-react-native";
import { FlatList, Pressable, ScrollView, Text } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import AppBlurHeader from "../../AppBlurHeader";
import { useOnboarding } from "../../Context/OnboardingContext";







export default function ReferralOptionsList() {

  const {

    referral,
    setReferral
  } = useOnboarding(); // <-- using onboarding context

  // Remote URLs (fallbacks)
  const referralOptions = [
    { id: "google",   label: "Google Search",  icon: "https://cdn.brandfetch.io/google.com/w/419/h/512/theme/light/logo?c=1idHhyM4UatCQKFblcg" },
    { id: "facebook", label: "Facebook", icon: "facebook.png" }, // will use local require below
    { id: "instagram",label: "Instagram", icon: "https://cdn.brandfetch.io/ido5G85nya/w/800/h/800/theme/light/symbol.png?c=1bxid64Mup7aczewSAYMX&t=1724650641154" },
    { id: "twitter",  label: "Twitter / X", icon: "https://cdn.brandfetch.io/idS5WhqBbM/w/800/h/723/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1692089092800" },
    { id: "tiktok",   label: "TikTok", icon: "https://cdn.brandfetch.io/id-0D6OFrq/w/800/h/775/theme/dark/idGIofJnQn.png?c=1bxid64Mup7aczewSAYMX&t=1740370812106" },
    { id: "youtube",  label: "YouTube", icon: "https://cdn.brandfetch.io/idVfYwcuQz/w/800/h/564/theme/dark/symbol.png?c=1bxid64Mup7aczewSAYMX&t=1728452988041" },
    { id: "linkedin", label: "LinkedIn", icon: "https://cdn.brandfetch.io/idJFz6sAsl/w/400/h/400/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1748592533197" },
    { id: "appStore", label: "App Store", icon: "https://cdn.brandfetch.io/idJFz6sAsl/w/400/h/400/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1748592533197" },
     { id: "playStore", label: "Play Store", icon: "https://cdn.brandfetch.io/idJFz6sAsl/w/400/h/400/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1748592533197" },
    { id: "friends", label: "Friends & Family", icon: null }, // Lucide
    { id: "other", label: "Other", icon: null }, // Lucide
  ];

  // Local assets map (require). Keep keys EXACTLY matching ids above.
  const BrandIcons = {
    google:   require("../../../assets/brands/google.png"),
    facebook: require("../../../assets/brands/facebook.png"),
    instagram:require("../../../assets/brands/instagram.png"),
    twitter:  require("../../../assets/brands/twitter.png"),
    tiktok:   require("../../../assets/brands/tiktok.png"),
    youtube:  require("../../../assets/brands/youtube.png"),
    linkedin: require("../../../assets/brands/linkedIn.png"), // ensure the filename matches exactly
    appStore:  require("../../../assets/brands/appStore.png"), // ensure appStore // For lucide we’ll handle below, don’t put components in here
    playStore:  require("../../../assets/brands/playStore.png"),
  };

  
  return (

    <>
    <AppBlurHeader />

  
    <ScrollView style={{ height: "100%", width: "100%" }}
    showsVerticalScrollIndicator={false}
    contentContainerStyle={{
        paddingBottom: height(20)
    }}>
      <Text
        style={{
          fontSize: size(28),
          paddingTop: height(13),
          marginBottom: height(5),
          marginLeft: width(5),
          fontWeight: "700",
        }}
      >
        How did you find us?
      </Text>

     <FlatList
    data={referralOptions}
    keyExtractor={(item) => item.id}
    extraData={referral}                 // 🔑 re-render rows when selection changes
    scrollEnabled={false}                // optional, since it's inside a ScrollView
    renderItem={({ item }) => {
        const isSelected = referral === item.id;

    // 1) lucide for friends/other
    const isLucide = item.id === "friends" || item.id === "other";
    const LucideIcon =
      item.id === "friends" ? Users : item.id === "other" ? MoreHorizontalIcon : null;

    // 2) local require first, else remote URL
    const localSource = BrandIcons[item.id];
    const imageSource = localSource ? localSource : item.icon ? { uri: item.icon } : null;

    return (
      <Pressable
        onPress={() => setReferral(item.id)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 15,
          borderRadius: 10,
          width: "90%",
          alignSelf: "center",
          marginVertical: 8,
          backgroundColor: isSelected ? "#151515" : "#F1F3F9",   // ✅ use isSelected
        }}
      >
        {isLucide ? (
          <LucideIcon
            size={size(25)}
            color={isSelected ? "#fff" : "#000"}               // ✅ use isSelected
            style={{ marginRight: 12 }}
          />
        ) : imageSource ? (
          <Image
            source={imageSource}
            style={{ width: size(25), height: size(25), marginRight: 12 }}
            contentFit="contain"
          />
        ) : null}

        <Text
          style={{
            fontSize: size(16),
            fontWeight: "700",
            color: isSelected ? "#fff" : "#000",               // ✅ use isSelected
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  }}
/>

    </ScrollView>

      </>
  );
}
