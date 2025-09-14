// EditMyWeight.js
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Switch, Text, TouchableOpacity, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';
import { RulerPicker } from 'react-native-ruler-picker';

import { getAuth } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  setDoc
} from '@react-native-firebase/firestore';
import { Check } from 'lucide-react-native';

const KG_MIN = 30;
const KG_MAX = 200;
const LB_PER_KG = 2.20462262;
const kgToLb = (kg) => kg * LB_PER_KG;
const lbToKg = (lb) => lb / LB_PER_KG;
const round1 = (x) => Math.round(x * 10) / 10;














export default function TargetWeight({ initial = 65, onSaved }) {
  const uid = getAuth().currentUser?.uid;

  // layout + ruler ref
  const [w, setW] = useState(0);
  const ref = useRef(null);

  // unit toggle (true = kg, false = lb)
  const [isMetric, setIsMetric] = useState(true);

  // value shown on the ruler in CURRENT UNIT (kg or lb)
  const [displayVal, setDisplayVal] = useState(Math.round(initial));

  // haptics helpers
  const lastTickRef = useRef(Math.round(initial));
  const lastRAF = useRef(0);

  // button state
  const [saving, setSaving] = useState(false);

  // align ruler to initial when width known
  useEffect(() => {
    if (!w || !ref.current?.scrollToValue) return;
    const startVal = isMetric ? Math.round(initial) : Math.round(kgToLb(initial));
    setDisplayVal(startVal);
    ref.current.scrollToValue(startVal, false);
  }, [w]); // only when width measured

  // toggle units (convert + scroll; DOES NOT SAVE)
  const onToggleUnit = (next) => {
    setIsMetric(next);
    const target = next ? Math.round(lbToKg(displayVal)) : Math.round(kgToLb(displayVal));
    setDisplayVal(target);
    if (ref.current?.scrollToValue) ref.current.scrollToValue(target, true);
    Haptics.selectionAsync();
  };

  // handle ruler movement (NO SAVE here)
  const handleChange = (v) => {
    const now = Date.now();
    if (now - lastRAF.current > 33) {
      lastRAF.current = now;
      const n = Math.round(Number(v));
      if (n !== lastTickRef.current) {
        if (n % 5 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.selectionAsync();
        lastTickRef.current = n;
      }
      setDisplayVal(n);
    }
  };

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
        
        goalWeightKg: round1(kg),
        goalWeightLb: round1(lb),
        unit: isMetric ? 'kg' : 'lb',
        source: 'manual',
      });

      // 2) update current weight on user root doc
      await setDoc(
        doc(db, 'users', uid),
        {
          goalWeightKg: round1(kg),
          goalWeightLb: round1(lb),
          weightUnit: isMetric ? 'kg' : 'lb',
         
        },
        { merge: true }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.({ goalWeightKg: round1(kg), goalWeightLb: round1(lb) });
    } catch (e) {
      Alert.alert('Save failed', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const minDisp = isMetric ? KG_MIN : Math.round(kgToLb(KG_MIN));
  const maxDisp = isMetric ? KG_MAX : Math.round(kgToLb(KG_MAX));
  const unitLabel = isMetric ? 'kg' : 'lb';

  return (

    <>

        <Text style={{
        top: height(5),
        fontSize: size(25),
        marginLeft: width(5),
        position: 'absolute',
        fontWeight: "800"
        
    }}>
       Target Weight
    </Text>

    <View
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{
        paddingHorizontal: 16,
        justifyContent: 'center',
      
        height: height(80),
        width: '100%',
      }}
    >
      {/* Unit toggle */}
      <View style={{ flexDirection: 'row', alignSelf: 'center', top: height(-5), alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: '#A6B0B8', fontSize: size(20), marginRight: width(10) }}>
          Imperial
        </Text>
        <Switch
          value={isMetric}
          onValueChange={onToggleUnit}
          trackColor={{ false: '#fff', true: '#0057FF' }}
          thumbColor="#fff"
          ios_backgroundColor="#D3DAE0"
        />
        <Text style={{ fontWeight: '700',  marginLeft: width(10), fontSize: size(20) }}>Metric</Text>
      </View>

      {/* Current value */}
      <View style={{ alignItems: 'center', alignSelf: 'center', flexDirection: 'row', marginBottom: 8 }}>
        <Text style={{ fontSize: 48, fontWeight: '800' }}>{String(displayVal)}</Text>
        <Text style={{ fontSize: 28, marginLeft: 6 }}>{unitLabel}</Text>
      </View>

      {/* Ruler (no save on change or release) */}
      {w > 0 && (
        <RulerPicker
          key={`${w}-${isMetric}`}
          ref={ref}
          min={minDisp}
          max={maxDisp}
          step={1}
          shortStep={1}
          longStep={5}
          gapBetweenSteps={10}
          height={140}
          initialValue={displayVal}
          fractionDigits={0}
          decelerationRate="fast"
          onValueChange={handleChange}
          // NOTE: intentionally NO onValueChangeEnd that saves
          indicatorColor="#000"
          indicatorHeight={60}
          shortStepColor="#BDBDBD"
          longStepColor="#BDBDBD"
          valueTextStyle={{ fontSize: 1, color: 'transparent' }}
          unitTextStyle={{ fontSize: 1, color: 'transparent' }}
        />
      )}

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

    </>
  );
}
