import React, { createContext, useContext, useState } from "react";

const StepsContext = createContext(null);

export function StepsProvider({ children }) {
  const [step, setStep] = useState(0);

  const next = () => setStep((s) => s + 1);
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const goTo = (n) => setStep(n);

  return (
    <StepsContext.Provider value={{ step, setStep, next, prev, goTo }}>
      {children}
    </StepsContext.Provider>
  );
}

export function useSteps() {
  const ctx = useContext(StepsContext);
  if (!ctx) throw new Error("useSteps must be used within a StepsProvider");
  return ctx;
}
