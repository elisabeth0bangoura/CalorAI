import { createContext, useContext, useState } from "react";

const OnboardingContext = createContext();

export function OnboardingProvider({ children }) {
  const [gender, setGender] = useState(null);
   const [workouts, setWorkouts] = useState(null);
  const [height, setHeight] = useState(null);
  const [weight, setWeight] = useState(null);
  const [referral, setReferral] = useState(null);
  const [HaveYouUsedAnyOtherPlatform, setHaveYouUsedAnyOtherPlatform] = useState(null);
  const [BanticoAcurateChartPageState, setBanticoAcurateChartPageState] = useState(null);

    const [ft, setFt] = useState(5);
  const [inch, setInch] = useState(6);
  const [lb, setLb] = useState(120);

  // metric state
  const [cm, setCm] = useState(168);
  const [kg, setKg] = useState(60);
  

  return (
    <OnboardingContext.Provider
      value={{ 
        gender, 
        setGender, 
        height, 
        setHeight, 
        weight, 
        setWeight ,
        workouts, 
        setWorkouts,
        referral, 
        setReferral,
        HaveYouUsedAnyOtherPlatform, 
        setHaveYouUsedAnyOtherPlatform,
        BanticoAcurateChartPageState, 
        setBanticoAcurateChartPageState,
        ft, setFt,
        inch, setInch,
        lb, setLb,
        cm, setCm,
        kg, setKg

    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
