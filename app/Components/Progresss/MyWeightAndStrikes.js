// MyWeightAndStrikesComponent.js
import { useDailyLeft } from '@/app/Context/DailyLeftContext';
import { useDailyTargets } from '@/app/Context/DailyPlanProvider';
import { useSheets } from '@/app/Context/SheetsContext';
import { useStreak } from '@/app/Context/StreakContext';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { Flame } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { height, size } from 'react-native-responsive-sizes';
import WeekDots from './WeekDots';







const MS_DAY = 24 * 60 * 60 * 1000;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()); // start of local day
const clamp0 = (x) => (x < 0 ? 0 : x);

// Firestore Timestamp | Date | number | string -> Date
const toDateSafe = (v) =>
  v?.toDate?.() ??
  (v instanceof Date ? v :
   typeof v === 'number' ? new Date(v) :
   typeof v === 'string' ? new Date(v) :
   v?.seconds ? new Date(v.seconds * 1000) : null);





export default function MyWeightAndStrikesComponent() {
  // pull current streak (0..7 cap), ratio, and real week dates from context
  const { capped7: STREAK, ratio, week } = useStreak();  // <-- added week

  const anim = useRef(new Animated.Value(ratio)).current;

    const {targets } = useDailyTargets();
  const { left, caloriesToday, carbsToday, today } = useDailyLeft();
    const [userDoc, setUserDoc] = useState(null);


    const [daysLeft, setDaysLeft] = useState(null);   // 6..0
  const [nextCheckDate, setNextCheckDate] = useState(null); // Date
  const [label, setLabel] = useState('');           // "in 6d" | "today"
  const [error, setError] = useState(null);



  const {
    register, present, dismiss, dismissAll,
    isS7Open, setIsS7Open,
  } = useSheets();



  console.log({
  targets
  })



    useEffect(() => {
    const uid = getAuth().currentUser?.uid;

    
    const db = getFirestore();
    const ref = doc(db, 'users', uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
         setUserDoc({ id: snap.id, ...snap.data() });
     
          
        } else {
         
          console.log('User doc does not exist');
        }
       
      }
    );

    return () => unsub();
  }, []);


useEffect(() => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  const ref = doc(getFirestore(), 'users', uid);

  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;

      const data = { id: snap.id, ...snap.data() };
      setUserDoc(data);

      // === weekly progress check (resets every 7 days) ===
      const base = toDateSafe(data?.updatedAt) || new Date(); // signup/updated time
      const today0 = sod(new Date());
      const base0  = sod(base);

      const daysSince = clamp0(Math.floor((today0 - base0) / MS_DAY)); // whole days since
      const cycle = daysSince % 7;               // 0..6
      const left  = (6 - cycle + 7) % 7;         // 6..0  (0 = today)

      setDaysLeft(left);
      setNextCheckDate(new Date(today0.getTime() + left * MS_DAY));
      setLabel(left === 0 ? 'today' : `${left}d`);
      setError(null);
    },
    (e) => setError(String(e?.message || e))
  );

  return () => unsub();
}, []);






  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: 650,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, anim]);




  const ProgressBar = (props) => {
    const {
      height = 2,
      progress = 0,                 // 0..100
      animated = true,
      indeterminate = false,
      progressDuration = 1100,
      indeterminateDuration = 1100,
      onCompletion = () => {},      // safe default
      backgroundColor = "#000",
      trackColor = "#fff",
    } = props;
  
    const [timer] = useState(new Animated.Value(0));
    const [width] = useState(new Animated.Value(0));
    const loopRef = useRef(null);
  
    const startAnimation = useCallback(() => {
      if (indeterminate) {
        // reset timer and start loop
        timer.setValue(0);
        const anim = Animated.timing(timer, {
          duration: indeterminateDuration,
          toValue: 1,
          useNativeDriver: true,
          isInteraction: false,
        });
        loopRef.current = Animated.loop(anim);
        loopRef.current.start();
      } else {
        // animate width (cannot use native driver for width)
        Animated.timing(width, {
          duration: animated ? progressDuration : 0,
          toValue: Math.max(0, Math.min(progress, 100)),
          useNativeDriver: false,
        }).start(() => {
          if (typeof onCompletion === "function") {
            onCompletion();
          }
        });
      }
    }, [
      animated,
      indeterminate,
      indeterminateDuration,
      onCompletion,
      progress,
      progressDuration,
      timer,
      width,
    ]);
  
    const stopAnimation = useCallback(() => {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      Animated.timing(width, {
        duration: 200,
        toValue: 0,
        useNativeDriver: false, // width => must be false
        isInteraction: false,
      }).start();
    }, [width]);
  
    useEffect(() => {
      if (indeterminate || typeof progress === "number") {
        startAnimation();
      } else {
        stopAnimation();
      }
      return () => {
        // cleanup on unmount
        if (loopRef.current) {
          loopRef.current.stop();
          loopRef.current = null;
        }
      };
    }, [indeterminate, progress, startAnimation, stopAnimation]);
  
    const styleAnimation = indeterminate
      ? {
          transform: [
            {
              translateX: timer.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [-0.6 * 320, -0.5 * 0.8 * 320, 0.7 * 320],
              }),
            },
            {
              scaleX: timer.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.0001, 0.8, 0.0001],
              }),
            },
          ],
        }
      : {
          width: width.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        };
  
    const styles = StyleSheet.create({
      container: {
        width: "100%",
        height,
        overflow: "hidden",
        borderRadius: height / 2,
        backgroundColor: trackColor,
      },
      progressBar: {
        flex: 1,
        borderRadius: height / 2,
        backgroundColor,
      },
    });
  
    return (
      <View style={{ width: "100%" }}>
        <Animated.View style={styles.container}>
          <Animated.View style={[styles.progressBar, styleAnimation]} />
        </Animated.View>
      </View>
    );
  };
  
  







  // background: grey -> green (#5BC951)
  const cardBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5EAF0', '#5BC951'],
  });

  // crossfade text/icon from black -> white at day 5
  const WHITE_START = 5 / 7;
  const toBlack = anim.interpolate({
    inputRange: [0, WHITE_START - 0.002, WHITE_START],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });
  const toWhite = anim.interpolate({
    inputRange: [0, WHITE_START - 0.002, WHITE_START],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={{
        height: height(28),
        marginTop: height(15),
        width: '90%',
        flexDirection: 'row',
        alignSelf: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Left card (weight) */}
      <TouchableOpacity onPress={() => {
        present("s7")
      }}
        style={{
          height: '90%',
          width: '48%',
          paddingBottom: height(5),
          alignSelf: 'center',
          borderRadius: 19,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: { elevation: 6, shadowColor: '#00000050' },
          }),
        }}
      >
        <Text style={{ marginTop: height(2), fontSize: size(16), fontWeight: '800', color: '#BCC1CA' }}>
          My Weight
        </Text>
        <Text style={{ fontSize: size(35), fontWeight: '800', color: '#000', marginTop: height(1) }}>{userDoc?.kg} kg</Text>


         <View style={{
                  marginTop: height(2),
                  width: "80%",
                   alignSelf: 'center'
                 }}>
                    <ProgressBar progress={95} height={8} backgroundColor="#5BC951" />
                 </View>


        <Text
          style={{
            marginTop: height(2),
            fontSize: size(13),
            textAlign: 'center',
            width: '90%',
            position: 'absolute',
            bottom: height(5),
            color: '#000',
          }}
        >
          progress check - in {daysLeft}d
        </Text>
      </TouchableOpacity>

      {/* Right card (streak) */}
      <Animated.View
        style={{
          height: '90%',
          width: '48%',
          paddingBottom: height(5),
          alignSelf: 'center',
          borderRadius: 19,
          justifyContent: 'center',
          alignItems: 'center',
           backgroundColor: "#fff",
         // backgroundColor: cardBg,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
            },
            android: { elevation: 6, shadowColor: '#00000050' },
          }),
        }}
      >
        {/* ICON crossfade */}
        <View style={{ position: 'relative', height: 65 }}>
          <Animated.View style={{ alignItems: 'center', position: 'absolute', opacity: toBlack, left: 0, right: 0 }}>
            <Flame size={65} color="#000" />
          </Animated.View>
          <Animated.View style={{ alignItems: 'center', position: 'absolute', opacity: toWhite, left: 0, right: 0 }}>
            <Flame size={65} color="#fff" />
          </Animated.View>
        </View>

        {/* NUMBER crossfade */}
        <View style={{ position: 'relative', height: size(34), marginTop: height(-2.8) }}>
          <Animated.Text
            style={{
              backgroundColor: "#fff",
             //backgroundColor: cardBg,
              position: 'absolute',
              opacity: toBlack,
              fontSize: size(30),
              paddingHorizontal: 5,
              paddingVertical: 5,
              fontWeight: '800',
              color: '#000',
              alignSelf: 'center',
            }}
          >
            {STREAK}
          </Animated.Text>
          <Animated.Text
            style={{
              backgroundColor: cardBg,
              position: 'absolute',
              opacity: toWhite,
              paddingHorizontal: 5,
              paddingVertical: 5,
              fontSize: size(30),
              fontWeight: '800',
              color: '#fff',
              alignSelf: 'center',
            }}
          >
            {STREAK}
          </Animated.Text>
        </View>

        {/* LABEL crossfade */}
        <View style={{ position: 'relative', height: size(18), marginTop: 2 }}>
          <Animated.Text
            style={{
              position: 'absolute',
              opacity: toBlack,
              color: '#000',
              fontWeight: '500',
              fontSize: size(13),
              alignSelf: 'center',
            }}
          >
            Stay-On-Track
          </Animated.Text>
          <Animated.Text
            style={{
              position: 'absolute',
              opacity: toWhite,
              color: '#fff',
              fontWeight: '500',
              fontSize: size(13),
              alignSelf: 'center',
            }}
          >
            Stay-On-Track
          </Animated.Text>
        </View>

        {/* Use real dates from context — no styling change */}
        <WeekDots doneDates={week?.doneDates ?? []} />  {/* <-- only change */}
      </Animated.View>
    </View>
  );
}
