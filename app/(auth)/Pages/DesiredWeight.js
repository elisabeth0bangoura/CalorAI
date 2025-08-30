// DesiredWeight.js
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { RulerPicker } from "react-native-ruler-picker";
import AppBlurHeader from "../../AppBlurHeader";

const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => Math.round(lb * KG_PER_LB);
const kgToLb = (kg) => Math.round(kg / KG_PER_LB);

export default function DesiredWeight({ initial = 50, onChange }) {
  // show Metric by default (since initial is in kg)
  const [isEnabled, setIsEnabled] = useState(true); // true = Metric, false = Imperial
  const isMetric = isEnabled;

  // ruler width for deferred scroll
  const [w, setW] = useState(0);
  const ref = useRef(null);

  // value is in the CURRENT unit
  const [value, setValue] = useState(initial); // starts as kg

  // for haptics: remember last whole tick we vibrated on
  const lastTickRef = useRef(Math.round(initial));

  // align to initial once width is known
  useEffect(() => {
    if (w && ref.current?.scrollToValue) ref.current.scrollToValue(value, false);
  }, [w]); // value is set on mount & on unit toggle

  // toggle units and convert value accordingly
  const toggleSwitch = () => {
    setIsEnabled((prev) => {
      const goingMetric = !prev;
      setValue((prevVal) => {
        const converted = goingMetric ? lbToKg(prevVal) : kgToLb(prevVal);
        lastTickRef.current = Math.round(converted);
        requestAnimationFrame(() => {
          ref.current?.scrollToValue?.(converted, false);
        });
        return converted;
      });
      return goingMetric;
    });
  };

  // throttled change handler + haptics
  const last = useRef(0);
  const handleChange = (v) => {
    const now = Date.now();
    if (now - last.current > 33) {
      last.current = now;
      const n = Math.round(Number(v));

      if (n !== lastTickRef.current) {
        if (n % 5 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.selectionAsync();
        }
        lastTickRef.current = n;
      }

      setValue(n);
    }
  };

  const unitLabel = isMetric ? "kg" : "lb";
  const min = isMetric ? 30 : kgToLb(30);   // 30 kg -> ~66 lb
  const max = isMetric ? 200 : kgToLb(200); // 200 kg -> ~441 lb

  const display = String(value);

  return (
    <View style={{ height: "100%", width: "100%", backgroundColor: "#fff" }}>
      <AppBlurHeader />

      <View style={{ height: "100%", width: "100%" }}>
        <Text style={{ fontSize: 28, marginTop: height(14), marginLeft: width(5), fontWeight: "700" }}>
          Set your goal weight
        </Text>
        <Text
          style={{
            fontSize: size(14),
            marginTop: height(1),
            marginLeft: width(5),
            fontWeight: "700",
            color: "#BCC1CA",
          }}
        >
          We’ll tune your plan around this target.
        </Text>

        <View
          onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
          style={{
            paddingHorizontal: 16,
            justifyContent: "center",
            alignItems: "center",
            height: height(60),
            width: "100%",
          }}
        >
          {/* Unit switch */}
          <View
            style={{
              flexDirection: "row",
              top: height(-5),
              alignSelf: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                color: isMetric ? "#A6B0B8" : "#111",
                fontSize: size(15),
                marginRight: width(10),
              }}
            >
              Imperial
            </Text>

            <Switch
              trackColor={{ false: "#D3DAE0", true: "#0057FF" }}
              thumbColor={"#fff"}
              ios_backgroundColor="#D3DAE0"
              onValueChange={toggleSwitch}
              value={isMetric} // ON = Metric
            />

            <Text
              style={{
                fontWeight: "700",
                marginLeft: width(10),
                fontSize: size(15),
                color: isMetric ? "#111" : "#A6B0B8",
              }}
            >
              Metric
            </Text>
          </View>

          {/* Big value label */}
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 48, fontWeight: "800" }}>{display}</Text>
            <Text style={{ fontSize: 28, marginLeft: 6 }}>{unitLabel}</Text>
          </View>

          {/* Ruler */}
          {w > 0 && (
            <RulerPicker
              key={`${w}-${isMetric}`} // remount ruler when unit changes for clean range
              ref={ref}
              min={min}
              max={max}
              step={1}
              shortStep={1}
              longStep={5}
              gapBetweenSteps={10}
              height={140}
              initialValue={value}
              fractionDigits={0}
              decelerationRate="fast"
              onValueChange={handleChange}
              onValueChangeEnd={(v) => {
                const n = Math.round(Number(v));
                setValue(n);
                // Report both units so the caller can store what they prefer.
                const kg = isMetric ? n : lbToKg(n);
                const lb = isMetric ? kgToLb(n) : n;
                onChange?.({ value: n, unit: isMetric ? "metric" : "imperial", kg, lb });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              indicatorColor="#000"
              indicatorHeight={60}
              shortStepColor="#BDBDBD"
              longStepColor="#BDBDBD"
              // Hide built-in texts; we render our own label above
              valueTextStyle={{ fontSize: 1, color: "transparent" }}
              unitTextStyle={{ fontSize: 1, color: "transparent" }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
