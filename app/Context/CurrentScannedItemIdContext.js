import { createContext, useContext, useState } from "react";

const CurrentScannedItemIdContext = createContext(null);

export function CurrentScannedItemIdProvider({ children }) {
  const [currentItemId, setCurrentItemId] = useState(null);

  return (
    <CurrentScannedItemIdContext.Provider
      value={{ currentItemId, setCurrentItemId }}
    >
      {children}
    </CurrentScannedItemIdContext.Provider>
  );
}

// 🔥 Hook for easy usage
export function useCurrentScannedItemId() {
  const ctx = useContext(CurrentScannedItemIdContext);
  if (!ctx) {
    throw new Error(
      "useCurrentScannedItemId must be used inside CurrentScannedItemIdProvider"
    );
  }
  return ctx;
}
