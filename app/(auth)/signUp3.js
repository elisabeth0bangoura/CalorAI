import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';
import DateInput from './DateInput';

const MIN_AGE = 13;
const MAX_AGE = 120;

export default function SignUp2() {
  const { Email, Password , Phonenumber, method, UserName} = useLocalSearchParams();
  const router = useRouter();

  const [displayedText1, setDisplayedText1] = useState('');
  const [index1, setIndex1] = useState(0);
  const fullText1 = `What's your date of birth?\n`;

  const [rawBirth, setRawBirth] = useState(null); // Date or "MM.DD.YYYY" | "MM DD YYYY" | null
  const [error, setError] = useState('');

  const dateInputRef = useRef(null);

  // Focus right after mount
  useEffect(() => {
    const t = setTimeout(() => {
      dateInputRef.current?.focusHiddenInput?.();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // Re-focus every time the screen becomes active
  useFocusEffect(
    React.useCallback(() => {
      const t = setTimeout(() => {
        dateInputRef.current?.focusHiddenInput?.();
      }, 80);
      return () => clearTimeout(t);
    }, [])
  );

  // Typewriter effect
  useEffect(() => {
    if (index1 < fullText1.length) {
      const t = setTimeout(() => {
        setDisplayedText1((p) => p + fullText1.charAt(index1));
        setIndex1((i) => i + 1);
      }, 30);
      return () => clearTimeout(t);
    }
  }, [index1]);

  const onChangeDOB = (value) => {
    setRawBirth(value); // formatted string ("MM.DD.YYYY") from DateInput when complete
  };

  // Helpers
  const parseMasked = (masked) => {
    // Accept "MM.DD.YYYY", "MM DD YYYY", or any non-digit separators
    if (typeof masked !== 'string') return null;
    const parts = masked.match(/\d+/g); // extracts groups of digits
    if (!parts || parts.length !== 3) return null;

    const [mm, dd, yyyy] = parts;
    if (mm.length !== 2 || dd.length !== 2 || yyyy.length !== 4) return null;

    const month = Number(mm);
    const day = Number(dd);
    const year = Number(yyyy);

    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const d = new Date(year, month - 1, day);
    // Reject JS auto-corrections (e.g., Feb 31 → Mar 2)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  };

  const normalizeDOB = (value) => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;
    return parseMasked(value);
  };

  const calcAge = (date) => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };

  const { dobDate, dobISO, isValid, errorMsg } = useMemo(() => {
    const d = normalizeDOB(rawBirth);
    if (!d) return { dobDate: null, dobISO: null, isValid: false, errorMsg: '' };

    // Future date check
    const today = new Date();
    const atMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (atMidnight > new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return { dobDate: d, dobISO: null, isValid: false, errorMsg: 'That looks like a future date.' };
    }

    const age = calcAge(d);
    if (age < MIN_AGE) {
      return {
        dobDate: d,
        dobISO: null,
        isValid: false,
        errorMsg: `You must be ${MIN_AGE}+ to use Bantico.`,
      };
    }
    if (age > MAX_AGE) {
      return {
        dobDate: d,
        dobISO: null,
        isValid: false,
        errorMsg: 'Please enter a valid date of birth.',
      };
    }

    // Use ISO yyyy-mm-dd (no time) for storage/next step
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return { dobDate: d, dobISO: iso, isValid: true, errorMsg: '' };
  }, [rawBirth]);

  useEffect(() => setError(errorMsg), [errorMsg]);

  const handleNext = () => {

    console.log({
      method: method,
        Email: Email,
        Phonenumber: Phonenumber,
        Password: Password,
        UserName: UserName,
        Birthday: dobISO, // clean ISO for consistency
    })
   /* if (!isValid || !dobISO) return;
    router.replace({
      pathname: '/(auth)/signUp4',
      params: {
        Email,
        Password,
        Birthday: dobISO, // clean ISO for consistency
      },
    }); */
  };

  return (
    <View style={{ height: '100%', width: '100%', backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, alignItems: 'center', backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text numberOfLines={2} style={styles.heading}>
          {displayedText1}
        </Text>

        {/* Pass ref so we can force focus on screen focus */}
       



          <DateInput
            ref={dateInputRef}
            onChange={onChangeDOB} // receives the formatted date
            mask="MM DD YYYY"
            activeColor="#000"
            pushTo={{
              pathname: "/(auth)/signUp4",
              params: { 
              method,
              Email,
              Phonenumber,
              Password,
              UserName,
              Birthday: dobISO, // ✅ }, // Birthday injected by component
              }}}
          />



        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.caption}>
          We use your age only to verify eligibility for rewards.
        </Text>
      </KeyboardAvoidingView>

      <TouchableOpacity
        onPress={handleNext}
        disabled={!isValid}
        style={[
          styles.nextBtn,
          { opacity: isValid ? 1 : 0.4 },
        ]}
      >
        <Text style={styles.nextText}>Next</Text>
        <ArrowRight color="#fff" size={size(22)} style={{ marginLeft: width(2) }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    paddingHorizontal: 24,
    alignSelf: 'center',
    width: '100%',
  },
  heading: {
    fontSize: size(20),
    marginTop: height(10),
    width: 300,
    color: '#222',
    height: height(10),
    zIndex: 1000,
    fontFamily: 'Righteous-Regular',
  },
  errorText: {
    color: '#C4472F',
    marginTop: 8,
    fontSize: 14,
  },
  caption: {
    alignSelf: 'center',
    fontSize: 12,
    color: '#333',
    marginTop: height(2),
  },
  nextBtn: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    bottom: height(8),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: width(5),
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#222',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8.27,
    elevation: 10,
  },
  nextText: {
    fontSize: size(16),
    fontFamily: 'Righteous-Regular',
    color: '#fff',
  },
});
