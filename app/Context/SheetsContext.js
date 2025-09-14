// app/Context/SheetsContext.js
import React, { createContext, useContext, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

export function SheetsProvider({ children }) {
  const refs = useRef({}); // { key: ref }
  const register = (key) => (node) => {
    refs.current[key] = node;
  };

  // ---- Global open flags
  const [isS1Open, setIsS1Open] = useState(false);
  const [isS2Open, setIsS2Open] = useState(false);
  const [isS3Open, setIsS3Open] = useState(false);
  const [isS4Open, setIsS4Open] = useState(false);
  const [isS5Open, setIsS5Open] = useState(false);

  // ✅ : Edit PageAfterScan
  const [isS6Open, setIsS6Open] = useState(false);
  // ✅ : Edit PageAfterScan (second editor sheet)
 const [isS7Open, setIsS7Open] = useState(false);
 const [isS8Open, setIsS8Open] = useState(false);
 const [isS9Open, setIsS9Open] = useState(false);
 const [isPerosnalDetailsOpen, setIsPerosnalDetailsOpen] = useState(false);
 const [isTargetWeightOpen, setIsTargetWeightOpen] = useState(false)
 const [isCurrentWeightOpen, setIsCurrentWeightOpen] = useState(false)
 const [isHeightComponentOpen, setIsHeightComponentOpen] = useState(false)
 const [isBirthDayComponentOpen, setIsBirthDayComponentOpen] = useState(false)
 const [isDailyStepsComponentOpen, setIsDailyStepsComponentOpen] = useState(false)
 const [isEditNutritionGoalsComponentOpen, setIsEditNutritionGoalsComponentOpen] = useState(false)
 const [isGenerate_Based_On_Habits_AndHealth, setIsGenerate_Based_On_Habits_AndHealth] = useState(false)


  


  // ---- Central flag switcher
  const setOpenFlag = (key, open) => {
    switch (key) {
      case "s1": return setIsS1Open(open);
      case "s2": return setIsS2Open(open);
      case "s3": return setIsS3Open(open);
      case "s4": return setIsS4Open(open);
      case "s5": return setIsS5Open(open);
      // ✅ : Edit PageAfterScan
      case "s6": return setIsS6Open(open);
      // ✅ : Edit PageAfterScan (second)
      case "s7": return setIsS7Open(open);

      case "s8": return setIsS8Open(open);
      case "s9": return setIsS9Open(open);
      case "PerosnalDetails": return setIsPerosnalDetailsOpen(open);
      case "TargetWeight": return setIsTargetWeightOpen(open);
      case "CurrentWeight": return setIsCurrentWeightOpen(open);
      case "HeightComponent": return setIsHeightComponentOpen(open);
      case "BirthDayComponent": return setIsBirthDayComponentOpen(open);
      case "DailyStepsComponent": return setIsDailyStepsComponentOpen(open);
      case "EditNutritionGoalsComponent": return setIsEditNutritionGoalsComponentOpen(open);
      case "Generate_Based_On_Habits_AndHealth": return setIsGenerate_Based_On_Habits_AndHealth(open);
      

    
 
      default: return;
    }
  };

  // ---- Present/Dismiss wrappers
  const present = (key) => {
    setOpenFlag(key, true);
    refs.current[key]?.present?.();
  };

  const dismiss = (key) => {
    refs.current[key]?.dismiss?.();
    setOpenFlag(key, false);
  };

  const dismissAll = () => {
    Object.entries(refs.current).forEach(([key, r]) => {
      r?.dismiss?.();
      setOpenFlag(key, false);
    });
  };


 
  const value = useMemo(
    () => ({
      register, present, dismiss, dismissAll,
      isS1Open, isS2Open, isS3Open, isS4Open, isS5Open,
      setIsS1Open, setIsS2Open, setIsS3Open, setIsS4Open, setIsS5Open,
        isS8Open, setIsS8Open,
        isS9Open, setIsS9Open,

      // ✅ : Edit PageAfterScan
       setIsS6Open,
      // ✅ : Edit PageAfterScan (second)
      isS7Open, setIsS7Open,
      isPerosnalDetailsOpen, setIsPerosnalDetailsOpen,
      isTargetWeightOpen, setIsTargetWeightOpen,
      isCurrentWeightOpen, setIsCurrentWeightOpen,
      isHeightComponentOpen, setIsHeightComponentOpen,
      isBirthDayComponentOpen, setIsBirthDayComponentOpen,
      isDailyStepsComponentOpen, setIsDailyStepsComponentOpen,
      isEditNutritionGoalsComponentOpen, setIsEditNutritionGoalsComponentOpen,
      isGenerate_Based_On_Habits_AndHealth, setIsGenerate_Based_On_Habits_AndHealth
    }),
    [
      isS1Open, 
      isS2Open, 
      isS3Open, 
      isS4Open, 
      isS5Open, 
      isS6Open, 
      isS7Open, 
      isS8Open, 
      isS9Open,
      setIsS9Open,
      isPerosnalDetailsOpen, 
      setIsPerosnalDetailsOpen,
      isTargetWeightOpen, 
      setIsTargetWeightOpen,
      isCurrentWeightOpen, 
      setIsCurrentWeightOpen,
      isHeightComponentOpen, 
      setIsHeightComponentOpen,
      isBirthDayComponentOpen, 
      setIsBirthDayComponentOpen,
      isDailyStepsComponentOpen, 
      setIsDailyStepsComponentOpen,
      isEditNutritionGoalsComponentOpen, 
      setIsEditNutritionGoalsComponentOpen,
      isGenerate_Based_On_Habits_AndHealth, 
      setIsGenerate_Based_On_Habits_AndHealth,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSheets() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSheets must be used within SheetsProvider");
  return ctx;
}
