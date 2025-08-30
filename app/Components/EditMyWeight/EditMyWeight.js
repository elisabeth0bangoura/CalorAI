// ProgressComponent.js (EditMyWeight)
import * as Haptics from 'expo-haptics'; // ← add
import React, { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';
import { RulerPicker } from 'react-native-ruler-picker';





export default function EditMyWeight({ initial = 65, onChange }) {



  const [w, setW] = useState(0);
  const [value, setValue] = useState(initial);
  const ref = useRef(null);

    const [isEnabled, setIsEnabled] = useState(false);
  const toggleSwitch = () => setIsEnabled(previousState => !previousState);



  // for haptics: remember last whole tick we vibrated on
  const lastTickRef = useRef(Math.round(initial)); // ← add

  // align to initial once width is known
  useEffect(() => {
    if (w && ref.current?.scrollToValue) ref.current.scrollToValue(initial, false);
  }, [w, initial]);

  // throttle label updates (≈30–60fps) + haptics
  const last = useRef(0);
  const handleChange = (v) => {
    const now = Date.now();
    if (now - last.current > 33) { // ~30fps
      last.current = now;
      const n = Math.round(Number(v));

      // 🔊 haptics: tick per step, stronger on long ticks (every 5)
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

  const display = String(value); // e.g. "81"

  return (
    <View
      onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}
      style={{
        paddingHorizontal: 16,
        justifyContent: 'center',
        // backgroundColor: 'yellow',
        alignItems: 'center',
        height: height(80),
        width: '100%',
      }}
    >



        <View style={{
            flexDirection: 'row',
            top: height(-5),
          //  backgroundColor: 'yellow',
            alignSelf: 'center',
            alignItems: 'center'
        }}>

            <Text style={{
            fontWeight: "700",
                color: "#A6B0B8",
             fontSize: size(20),
            marginRight: width(10)
        }}>
             Imperial 
            </Text>

         <Switch
          trackColor={{false: '#fff', true: '#0057FF'}}
          thumbColor={isEnabled ? '#fff' : '#fff'}
          ios_backgroundColor="#D3DAE0"
          onValueChange={toggleSwitch}
          value={isEnabled}
        />


        <Text style={{
            fontWeight: "700",
            marginLeft:  width(10),
            fontSize: size(20)
        }}>
            Metric 
         </Text>
                    
        </View>


      {/* Custom label (no clipping, no jank) */}
      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 8 }}>
        <Text style={{ fontSize: 48, fontWeight: '800' }}>{display}</Text>
        <Text style={{ fontSize: 28, marginLeft: 6 }}>kg</Text>
      </View>

      {w > 0 && (
        <RulerPicker
          key={w}
          ref={ref}
          min={30}
          max={200}
          step={1}
          shortStep={1}
          longStep={5}
          gapBetweenSteps={10}
          height={140}
          initialValue={initial}
          fractionDigits={0}              // no decimals
          decelerationRate="fast"         // snappier scroll
          onValueChange={handleChange}    // throttled + haptics
          onValueChangeEnd={(v) => {      // final precise value + confirm haptic
            const n = Math.round(Number(v));
            setValue(n);
            onChange?.(n);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // ← add
          }}

          indicatorColor="#000"
          indicatorHeight={60}
          shortStepColor="#BDBDBD"
          longStepColor="#BDBDBD"

          // hide built-in text to avoid clipping & extra work
          valueTextStyle={{ fontSize: 1, color: 'transparent' }}
          unitTextStyle={{ fontSize: 1, color: 'transparent' }}
        />
      )}
    </View>
  );
}
