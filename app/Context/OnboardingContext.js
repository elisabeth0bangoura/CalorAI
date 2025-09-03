// Context/OnboardingContext.js
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const OnboardingContext = createContext();

export function OnboardingProvider({ children }) {
  // ---------- Birthday ----------
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = useMemo(
    () => Array.from({ length: 100 - 13 + 1 }, (_, i) => currentYear - 13 - i),
    [currentYear]
  );

  // ---------- Core onboarding ----------
  const [gender, setGender] = useState(null);
  const [workouts, setWorkouts] = useState(null);
  const [Conheight, setConheight] = useState(null);
  const [Conweight, setConweight] = useState(null);
  const [referral, setReferral] = useState(null);
  const [HaveYouUsedAnyOtherPlatform, setHaveYouUsedAnyOtherPlatform] = useState(null);
  const [BanticoAcurateChartPageState, setBanticoAcurateChartPageState] = useState(null);
  const [HowFast, setHowFast] = useState(1.0);
  // Single-select goal (weight/habits/general)
  const [goal, setGoal] = useState(null);
  const [WhatsStoppingYou, setWhatsStoppingYou] = useState(null);
  const [AddExerciseCalories, setAddExerciseCalories] = useState(true)
  const [RolloverCalories, setRolloverCalories] = useState(null)

  // 🔹 Multi-select health conditions
  const [selectedConditions, setSelectedConditions] = useState([]);
  const toggleCondition = useCallback((id) => {
    setSelectedConditions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);
  const clearConditions = useCallback(() => setSelectedConditions([]), []);
  const setConditions = useCallback((idsArray) => {
    setSelectedConditions(Array.isArray(idsArray) ? [...new Set(idsArray)] : []);
  }, []);
  const selectGoal = useCallback((id) => setGoal(id), []);

  // ---------- Units for *current* height/weight entry ----------
  // (These are used by HeightWeightComponent and any summary calc.)
  const [ft, setFt] = useState(5);
  const [inch, setInch] = useState(6);
  const [lb, setLb] = useState(120);
  const [cm, setCm] = useState(168);
  const [kg, setKg] = useState(60);

  // Let other pages know which system is active, and which weight field was last changed.
  const [unitSystem, setUnitSystem] = useState("imperial"); // "imperial" | "metric"
  const [weightUnit, setWeightUnit] = useState("lb");       // "lb" | "kg"

  // ---------- Goal Weight (from the ruler page) ----------
  // We keep both units plus the last-used unit so any screen can show the user’s preferred unit.
  const [goalWeightKg, setGoalWeightKg] = useState(null);
  const [goalWeightLb, setGoalWeightLb] = useState(null);
  const [goalWeightUnit, setGoalWeightUnit] = useState("kg"); // "kg" | "lb"
  const [SmokingFrequency, setSmokingFrequency] = useState(null);
const [AccomplishGoal, setAccomplishGoal] = useState(null);
const [RequestNotifications, setRequestNotifications] = useState(true);
  // Convenience setter so the ruler page can update everything at once.
  const setGoalWeight = useCallback(({ kg, lb, unit }) => {
    if (Number.isFinite(kg)) setGoalWeightKg(kg);
    if (Number.isFinite(lb)) setGoalWeightLb(lb);
    if (unit === "kg" || unit === "lb") setGoalWeightUnit(unit);
  }, []);

  // ---------- Birthday ----------
  const [year, setYear] = useState(currentYear - 20);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);

  // ---------- Condition / habit configs ----------
  const [diabetesSettings, setDiabetesSettings] = useState({
    trackCarbs: true,
    carbTargetPerMeal: 45,
    glucoseReminders: false,
  });

  const [kidneySettings, setKidneySettings] = useState({
    sodiumLimitMg: 2000,
    hydrationGoalCups: 8,
    proteinLevel: "moderate",
  });

  const [heartSettings, setHeartSettings] = useState({
    sodiumLimitMg: 1500,
    trackBP: false,
    satFatLimit: "moderate",
  });

  const [habitSettings, setHabitSettings] = useState({
    coffeePerDayTarget: 2,
    cigarettesPerDayTarget: 0,
    reminders: false,
  });

  // ---------- Diet preference (NEW) ----------
  // "balanced" | "pescatarian" | "vegetarian" | "vegan" | null
  const [dietPreferenceId, setDietPreferenceId] = useState(null);

  
  return (
    <OnboardingContext.Provider
      value={{
        // core
        gender, setGender,
       Conheight, setConheight,
       Conweight, setConweight,
        workouts, setWorkouts,
        referral, setReferral,
        HaveYouUsedAnyOtherPlatform, setHaveYouUsedAnyOtherPlatform,
        BanticoAcurateChartPageState, setBanticoAcurateChartPageState,
        RequestNotifications, setRequestNotifications,

        // current height/weight + unit info
        ft, setFt, inch, setInch, lb, setLb,
        cm, setCm, kg, setKg,
        unitSystem, setUnitSystem,
        weightUnit, setWeightUnit,

        // goal weight selected on the ruler page
        goalWeightKg, setGoalWeightKg,
        goalWeightLb, setGoalWeightLb,
        goalWeightUnit, setGoalWeightUnit,
        setGoalWeight,

        // birthday
        year, setYear, month, setMonth, day, setDay,

        // goals
        goal, setGoal: selectGoal,
        selectedConditions, setSelectedConditions, toggleCondition, clearConditions, setConditions,

        // configs
        diabetesSettings, setDiabetesSettings,
        kidneySettings, setKidneySettings,
        heartSettings, setHeartSettings,
        habitSettings, setHabitSettings,
        HowFast, setHowFast,
        WhatsStoppingYou, setWhatsStoppingYou,
        SmokingFrequency, setSmokingFrequency,

        // diet preference (NEW)
        dietPreferenceId, setDietPreferenceId,
        AccomplishGoal, setAccomplishGoal,
        AddExerciseCalories, setAddExerciseCalories,
        RolloverCalories, setRolloverCalories,
        // helpers
        years,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
