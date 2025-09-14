// BirthDay.js
import { Picker } from "@react-native-picker/picker";
import * as Haptics from 'expo-haptics';
import { Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { height, size, width } from "react-native-responsive-sizes";
import { useOnboarding } from "../../../Context/OnboardingContext";
import AppBlurHeaderBirth from "./AppBlurHeaderBirth";






const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// m is 1..12, y is full year
const daysInMonth = (m, y) => new Date(Number(y), Number(m), 0).getDate();

export default function BirthDay() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Years list: 13–100 y/o
  const years = useMemo(
    () => Array.from({ length: 100 - 13 + 1 }, (_, i) => currentYear - 13 - i),
    [currentYear]
  );
  // button state
  const [saving, setSaving] = useState(false);

  const {
    year, setYear,
    month, setMonth,
    day, setDay
  } = useOnboarding();

  // Keep the day valid when month/year change
  const maxDay = useMemo(() => daysInMonth(month, year), [month, year]);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const dob = new Date(Number(year), Number(month) - 1, Number(day)); // convert back to 0-based
    console.log("DOB:", dob.toLocaleDateString());
  };

  const wheelStyle = { height: 180, width: "100%" };
  const itemStyle  = { fontSize: 18, fontWeight: "700", color: "#111" };







 // SAVE ONLY WHEN BUTTON PRESSED
  const onPressSave = async () => {
    if (saving) return;
    try {
      if (!uid) throw new Error('Not signed in');
      setSaving(true);

      const db = getFirestore();
      const kg = isMetric ? displayVal : lbToKg(displayVal);
      const lb = kgToLb(kg);

      // 1) append a log entry
      await addDoc(collection(db, 'users', uid, 'weightprogrss'), {
        createdAt: serverTimestamp(),
        kg: round1(kg),
        lb: round1(lb),
        unit: isMetric ? 'kg' : 'lb',
        source: 'manual',
      });

      // 2) update current weight on user root doc
      await setDoc(
        doc(db, 'users', uid),
        {
          kg: round1(kg),
          lb: round1(lb),
          weightUnit: isMetric ? 'kg' : 'lb',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.({ kg: round1(kg), lb: round1(lb) });
    } catch (e) {
      Alert.alert('Save failed', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };







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
        When is your Birthday?
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
        This helps us tailor your plan.
      </Text>

      <View
        style={{
          width: "100%",
          marginLeft: width(5),
          top: height(17),
        }}
      >
        <Text
          style={{
            fontSize: size(14),
            fontWeight: "800",
            color: "#111",
            zIndex: 1000,
          }}
        >
          Select your Birthday
        </Text>

        <AppBlurHeaderBirth />
      </View>

      <View
        style={{
          flexDirection: "row",
          height: 500,
          justifyContent: "space-between",
          top: height(14),
        }}
      >
        {/* Month */}
        <View style={{ width: "42%", borderRadius: 12, overflow: "hidden" }}>
          <Picker
            selectedValue={month}
            onValueChange={(v) => setMonth(Number(v))} // ensure 1..12
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {MONTHS.map((m, i) => (
              <Picker.Item key={m} label={m} value={i + 1} />
            ))}
          </Picker>
        </View>

        {/* Day */}
        <View style={{ width: "25%", borderRadius: 12, overflow: "hidden" }}>
          <Picker
            selectedValue={day}
            onValueChange={(v) => setDay(Number(v))}
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <Picker.Item key={String(d)} label={String(d)} value={d} />
            ))}
          </Picker>
        </View>

        {/* Year */}
        <View style={{ width: "30%", borderRadius: 12, overflow: "hidden" }}>
          <Picker
            selectedValue={year}
            onValueChange={(v) => setYear(Number(v))}
            style={wheelStyle}
            itemStyle={itemStyle}
          >
            {years.map((y) => (
              <Picker.Item key={String(y)} label={String(y)} value={y} />
            ))}
          </Picker>
        </View>
      </View>

     

        {/* Save button */}
      <TouchableOpacity
        onPress={onPressSave}
        disabled={saving}
        style={{
          top: height(80),
          paddingVertical: 14,
          flexDirection: 'row',
          width: size(140),
          right: width(5),
          height: size(50),
            paddingHorizontal: 20,
         
          alignItems: "center",
          position: 'absolute',
          borderRadius: 15,
          backgroundColor: saving ? '#BCC1CA' : '#000',
           ...Platform.select({
              ios: { shadowColor: "#000", shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.4, shadowRadius: 10 },
              android: { elevation: 4, shadowColor: "#ccc" },
            }),
        }}
      >
        <Text style={{ color: '#fff',  fontSize: size(14), fontWeight: '800' }}>
          {saving ? 'Saving…' : 'Save'}
        </Text>

        <Check color={"#fff"} size={18} style={{
            position: 'absolute',
            right: width(5)
        }} />
      </TouchableOpacity>
     
    </View>
  );
}
