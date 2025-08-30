// Context/CameraActiveContext.js
import { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export function CameraActiveProvider({ children }) {
  const [activeKey, setActiveKey] = useState(null); // e.g. "SCAN FOOD", "BARCODE", etc.
  const value = useMemo(() => ({ activeKey, setActiveKey }), [activeKey]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCameraActive() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCameraActive must be used inside <CameraActiveProvider>");
  return ctx;
}
