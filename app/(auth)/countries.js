import { TrueSheet } from "@lodev09/react-native-true-sheet";
import * as countryCodes from "country-codes-list";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import * as Flags from "react-native-svg-circle-country-flags";
import { useCountryPhoneSheet } from "../Context/CountryPhoneSheetContext";

// ---- flag helpers ----
const emojiFlag = (cc) =>
  cc?.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
const toExportKey = (iso2) => (iso2 ? iso2[0].toUpperCase() + iso2[1].toLowerCase() : "");
const FlagCircle = ({ iso2, sizePx }) => {
  const Comp = Flags[toExportKey(iso2)];
  if (!Comp) {
    return (
      <View style={{ height: sizePx, width: sizePx, borderRadius: sizePx / 2, alignItems: "center", justifyContent: "center", backgroundColor: "#2B2B2E" }}>
        <Text style={{ fontSize: sizePx * 0.7 }}>{emojiFlag(iso2)}</Text>
      </View>
    );
  }
  return <Comp width={sizePx} height={sizePx} />;
};

// ---- data ----
const getCountryPhoneList = () => {
  const obj = countryCodes.customList(
    "countryCode",
    '{ "code":"{countryCode}", "name":"{countryNameEn}", "callingCode":"{countryCallingCode}" }'
  );
  return Object.values(obj)
    .map((s) => {
      const x = JSON.parse(s);
      return { code: x.code, name: x.name, callingCode: x.callingCode };
    })
    .filter((c) => !!c.callingCode)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
};

const CountryPhoneSheet = ({ initialCountryCode = "DE", initialPhone = "", onChange }) => {
  const isAndroid = Platform.OS === "android";
  const sheetRef = useRef(null);
  const [query, setQuery] = useState("");
  const countries = useMemo(() => getCountryPhoneList(), []);

  const def = useMemo(
    () =>
      countries.find((c) => c.code === initialCountryCode) ||
      countries.find((c) => c.code === "US") ||
      countries[0],
    [countries, initialCountryCode]
  );

  const { country, setCountry, phone, setPhone } = useCountryPhoneSheet();

  // seed defaults once
  useEffect(() => { if (!country && def) setCountry(def); }, [country, def, setCountry]);
  useEffect(() => { if (!phone && initialPhone) setPhone(initialPhone); }, [phone, initialPhone, setPhone]);

  const dial = country?.callingCode ? `+${country.callingCode}` : "+00";

  useEffect(() => {
    if (!onChange) return;
    onChange({
      iso2: country?.code ?? null,
      countryName: country?.name ?? null,
      dialCode: dial,
      phone: phone ?? "",
      fullPhone: `${country?.callingCode ? `+${country.callingCode}` : ""}${phone ?? ""}`,
    });
  }, [country, phone, dial, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const cc = `+${c.callingCode}`;
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || cc.includes(q);
    });
  }, [countries, query]);















  
  return (

    <>

    <View style={{ flexDirection: "row", width: "100%", alignSelf: "center" }}>
      {/* Flag + dial button */}
      <TouchableOpacity
        onPress={() => sheetRef.current?.present?.()}
        style={{
          width: "30%",
          borderWidth: 1,
          backgroundColor: "#222",
          borderColor: "#222",
          height: size(55),
          marginRight: width(2),
          borderRadius: 10,
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
        }}
      >
        <View style={{ marginRight: 8 }}>
          <FlagCircle iso2={country?.code} sizePx={size(24)} />
        </View>
        <Text style={{ alignSelf: "center", color: "#fff", fontSize: size(16) }}>{dial}</Text>
      </TouchableOpacity>

      {/* Phone input */}
      <TextInput
        placeholder="0152328303714"
        keyboardType="phone-pad"
        placeholderTextColor="#000"
        value={phone ?? ""}
        onChangeText={setPhone}
        style={{
          borderWidth: 1,
          borderColor: "#222",
          width: "68%",
          alignSelf: "center",
          borderRadius: 10,
          height: size(55),
          fontSize: size(16),
          paddingHorizontal: width(5),
          color: "#000",
        }}
      />


        </View>

















      {/* Picker Sheet */}
      <TrueSheet
        ref={sheetRef}
        backgroundColor={"#1C1C1E"}
        sizes={isAndroid ? ["100%"] : ["large"]}  // bounded height to allow inner scrolling
        cornerRadius={isAndroid ? 0 : 24}
        grabber={!isAndroid}
        edgeToEdge={isAndroid}
        keyboardMode="pan"
      >
       
       
          <TextInput
            placeholder="Search by name, code, or +number"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: size(50),
              marginTop: height(4),
             
              width: "90%",
              fontSize: size(20),
              alignSelf: "center",
              color: "#fff",
              backgroundColor: "#242426",
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            nestedScrollEnabled        // <-- important on Android
            keyboardShouldPersistTaps="handled"
            style={{
             height: height(100),  // <-- fill remaining space so content can scroll
              width: "90%",
                marginTop: height(2),
              alignSelf: "center",
              backgroundColor: "#242426",
              borderRadius: isAndroid ? 0 : 30,
              paddingHorizontal: size(20),
            }}
            contentContainerStyle={{
              paddingBottom: height(4),
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setCountry(item);
                  sheetRef.current?.dismiss?.();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 20,
                  minHeight: size(70),
                }}
              >
                <View style={{ width: size(40), marginRight: 12, alignItems: "center" }}>
                  <FlagCircle iso2={item.code} sizePx={size(38)} />
                </View>

                <View style={{ flexDirection: "row", marginLeft: width(2), alignItems: "center" }}>
                  <Text style={{ fontSize: size(18), color: "#9B9A9D", marginRight: width(5) }}>
                    +{item.callingCode}
                  </Text>
                  <Text style={{ fontSize: size(18), width:width(50),  position: 'absolute',  marginLeft: width(18), color: "#fff" }}>{item.name}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
 
      </TrueSheet>
    </>
  );
};

export default CountryPhoneSheet;
