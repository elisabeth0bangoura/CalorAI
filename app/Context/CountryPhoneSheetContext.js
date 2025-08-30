// CountryPhoneSheetContext.js
import React, { createContext, useContext, useState } from "react";

const Ctx = createContext(null);

export function CountryPhoneSheetProvider({
  children,
  initialCountry = null, // e.g. { code:'DE', name:'Germany', callingCode:'49', flag:'🇩🇪' }
  initialPhone = "",
}) {
  const [country, setCountry] = useState(initialCountry);
  const [phone, setPhone] = useState(initialPhone);

  return (
    <Ctx.Provider value={{ country, setCountry, phone, setPhone }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCountryPhoneSheet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCountryPhoneSheet must be used within CountryPhoneSheetProvider");
  return ctx; // { country, setCountry, phone, setPhone }
}
