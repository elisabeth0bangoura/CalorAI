// HeightWeightScreen.js — simple pickers (no backgrounds) in JS
import { Picker } from "@react-native-picker/picker";
import { useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../Context/OnboardingContext";
import AppBlurHeader2 from "./AppBlurHeader2";





/* helpers */
const range = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

/* one simple column with an optional header */
const PickerCol = ({
  header,
  items, // [{label, value}]
  value,
  onChange,
  widthPct = "48%",
}) => (
  <View style={{ width: widthPct }}>
    {!!header && (
      <Text
        style={{
          fontSize: size(14),
          fontWeight: "800",
          alignSelf: "center",
          color: "#111",
          marginBottom: 8,
        }}
      >
        {header}
      </Text>
    )}

    <Picker
      selectedValue={value ?? items[0]?.value}
      onValueChange={(v) => onChange(v)}
      style={{ height: 180, width: "100%" }} // iOS wheel / Android dropdown
      itemStyle={{
        // iOS-only
        fontSize: size(14),
        fontWeight: "700",
        color: "#111",
      }}
      dropdownIconColor="#111"
    >
      {items.map((it) => (
        <Picker.Item key={String(it.value)} label={String(it.label)} value={it.value} />
      ))}
    </Picker>
  </View>
);

export default function HeightWeightComponent() {
  // units: 'imperial' or 'metric'
  const [units, setUnits] = useState("imperial");
  const isMetric = units === "metric";
  const toggleUnits = () => setUnits(isMetric ? "imperial" : "metric");

  // onboarding state
  const { ft, setFt, inch, setInch, lb, setLb, cm, setCm, kg, setKg } = useOnboarding();

  // lists -> objects with explicit labels (prevents iOS showing "…")
  const feetItems = useMemo(() => range(4, 7).map((v) => ({ label: `${v} ft`, value: v })), []);
  const inchItems = useMemo(() => range(0, 11).map((v) => ({ label: `${v} in`, value: v })), []);
  const poundItems = useMemo(
    () => range(80, 300).map((v) => ({ label: `${v} lb`, value: v })),
    []
  );
  const cmItems = useMemo(
    () => range(140, 210).map((v) => ({ label: `${v} cm`, value: v })),
    []
  );
  const kgItems = useMemo(
    () => range(40, 200).map((v) => ({ label: `${v} kg`, value: v })),
    []
  );

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      {/* Title & sub */}
      <Text
        style={{
          fontSize: 28,
          marginTop: height(14),
          marginLeft: width(5),
          fontWeight: "700",
        }}
      >
        Height & weight
      </Text>
       <Text style={{ fontSize: size(14), marginTop: height(1), marginLeft: width(5), fontWeight: "700", color: "#BCC1CA" }}>

        This will be used to calibrate your custom plan.
      </Text>

      {/* Imperial / Metric with switch */}
      <View
        style={{
          width: "100%",
          alignItems: "center",
          marginTop: height(6),
         
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            columnGap: 12,
          }}
        >
          <Text
            style={{
              fontSize: size(14),
              fontWeight: "800",
              color: isMetric ? "#D0D3DA" : "#111",
            }}
          >
            Imperial
          </Text>

          <Switch
            trackColor={{ false: "#E6E6E8", true: "#0057FF" }}
            thumbColor="#fff"
            ios_backgroundColor="#E6E6E8"
            onValueChange={toggleUnits}
            value={isMetric}
            style={{ transform: [{ scale: 0.9 }] }}
          />

          <Text
            style={{
              fontSize: size(14),
              fontWeight: "800",
              color: isMetric ? "#111" : "#D0D3DA",
            }}
          >
            Metric
          </Text>
        </View>
        
      </View>

      {/* Wheels */}
      {units === "imperial" ? (
        <View
          style={{
            width: "90%",
            alignSelf: "center",
              top: height(6)
          }}
        >
          {/* titles row */}
          <View
            style={{
             // backgroundColor: "#fff",
               height: height(5),
               zIndex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            
            }}
          >
          
            <View style={{ width: "48%",  zIndex: 10000,  alignItems: "center" }}>
              <Text
                style={{
                  fontSize: size(15),
                  fontWeight: "800",
                  color: "#111",
                }}
              >
                Height
              </Text>
            </View>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: size(15),
                  fontWeight: "800",
                  color: "#111",
                }}
              >
                Weight
              </Text>
            </View>
             <AppBlurHeader2 />
          </View>
           

          {/* pickers row */}
          <View style={{ flexDirection: "row", marginTop: height(-5), justifyContent: "space-between" }}>
            {/* Height: ft + in */}
            <View style={{ width: "48%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <PickerCol items={feetItems} value={ft ?? feetItems[0].value} onChange={setFt} widthPct="55%" />
                <PickerCol items={inchItems} value={inch ?? inchItems[0].value} onChange={setInch} widthPct="60%" />
              </View>
            </View>

            {/* Weight: lb */}
            <View style={{ width: "45%" }}>
              <PickerCol items={poundItems} value={lb ?? poundItems[0].value} onChange={setLb} widthPct="s%" />
            </View>
          </View>
        </View>
      ) : (
        <View
          style={{
            width: "90%",
            alignSelf: "center",
              top: height(6)
          }}
        >
          {/* titles row */}
          <View
            style={{
             // backgroundColor: "#fff",
               height: height(5),
               zIndex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            
            }}
          >
          
            <View style={{ width: "48%",  zIndex: 10000,  alignItems: "center" }}>
              <Text
                style={{
                  fontSize: size(15),
                  fontWeight: "800",
                  color: "#111",
                }}
              >
                Height
              </Text>
            </View>
            <View style={{ width: "48%", zIndex: 10000, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: size(15),
                  fontWeight: "800",
                  color: "#111",
                }}
              >
                Weight
              </Text>
            </View>
             <AppBlurHeader2 />
          </View>

          {/* pickers row */}
          <View style={{ flexDirection: "row", marginTop: height(-5), justifyContent: "space-between" }}>
            <View style={{ width: "48%" }}>
              <PickerCol items={cmItems} value={cm ?? cmItems[0].value} onChange={setCm} widthPct="100%" />
            </View>
            <View style={{ width: "48%" }}>
              <PickerCol items={kgItems} value={kg ?? kgItems[0].value} onChange={setKg} widthPct="100%" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
