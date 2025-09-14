// RevenueCatContext.js
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

// RN Firebase v22 modular API
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "@react-native-firebase/auth";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";

// ---- RevenueCat keys + your entitlement ----
const RC_API_KEY_IOS = "appl_NXiRaGiutUTVBSDxpemQtSbCWCv";
const RC_API_KEY_ANDROID = undefined; // add when you support Android
const ENTITLEMENT_ID = "premium_monthly";

const RevenueCatContext = createContext(undefined);

export function RevenueCatProvider({ children }) {
  const [customerInfo, setCustomerInfo] = useState(null);
  const [appUserID, setAppUserID] = useState("");     // RC user id (uid or $RCAnonymousID)
  const [firebaseUID, setFirebaseUID] = useState(""); // current Firebase uid
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();

  // derive booleans
  const isPremium = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  const isTrial =
    customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]?.periodType === "trial";

  // keep a stable ref for the listener so we can remove it on unmount if needed
  const infoListenerRef = useRef(null);

  // ---------- Configure RevenueCat once ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        await Purchases.configure({
          apiKey: Platform.select({ ios: RC_API_KEY_IOS, android: RC_API_KEY_ANDROID }),
        });

        const listener = (ci) => {
          if (!mounted) return;
          setCustomerInfo(ci);
          const active = Object.keys(ci?.entitlements?.active || {});
          console.log("[RC] listener active entitlements:", active);
        };
        infoListenerRef.current = listener;
        Purchases.addCustomerInfoUpdateListener(listener);

        const [ci, id] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getAppUserID(),
        ]);
        if (mounted) {
          setCustomerInfo(ci);
          setAppUserID(id || "");
        }
      } catch (e) {
        console.warn("RevenueCat init failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      // SDK requires the same function ref to remove; many apps keep it for app lifetime.
      // If you want to remove: Purchases.removeCustomerInfoUpdateListener(infoListenerRef.current)
    };
  }, []);

  // ---------- Sync Firestore -> RC attributes (only selected fields) ----------
  const syncRevenueCatAttributes = useCallback(
    async (uid) => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : {};

        await Purchases.setAttributes({
          firebase_uid: String(uid),
          email: data?.email || "",
          displayName: data?.displayName || "",
          country: data?.country || "",
          provider: data?.provider || "",
          referral: data?.referral || "",
          gender: data?.gender || "",
        });

        console.log("[RC] attributes synced for", uid);
      } catch (err) {
        console.warn("syncRevenueCatAttributes failed:", err?.message || err);
      }
    },
    [db]
  );

  // ---------- Bind RC user to Firebase UID ----------
  const initRevenueCat = useCallback(
    async (uid) => {
      if (!uid) return;
      try {
        await Purchases.logIn(uid);
        const id = await Purchases.getAppUserID();
        setAppUserID(id || "");

        await syncRevenueCatAttributes(uid);

        const ci = await Purchases.getCustomerInfo();
        setCustomerInfo(ci);

        console.log("[RC] logged in as", uid);
      } catch (e) {
        console.warn("initRevenueCat failed:", e);
      }
    },
    [syncRevenueCatAttributes]
  );

  // ---------- Logout RC ----------
  const logoutRC = useCallback(async () => {
    try {
      console.log("[RC] logging out…");
      const idBefore = await Purchases.getAppUserID();
      console.log("[RC] before logout appUserID:", idBefore);

      await Purchases.logOut();

      const idAfter = await Purchases.getAppUserID();
      const ciAfter = await Purchases.getCustomerInfo();
      setCustomerInfo(ciAfter);
      setAppUserID(idAfter || "");

      console.log("[RC] after logout appUserID:", idAfter);
      console.log("[RC] after logout isPremium:", !!ciAfter?.entitlements?.active?.[ENTITLEMENT_ID]);
      console.log("[RC] after logout customerInfo:", JSON.stringify(ciAfter, null, 2));
    } catch (e) {
      console.warn("logoutRC failed:", e?.message || e);
    }
  }, []);

  // ---------- Manual refresh ----------
  const refreshCustomerInfo = useCallback(async () => {
    try {
      const ci = await Purchases.getCustomerInfo();
      setCustomerInfo(ci);
    } catch (e) {
      console.warn("refreshCustomerInfo failed:", e);
    }
  }, []);

  // ---------- Debug dump ----------
  const dumpRevenueCat = useCallback(async () => {
    try {
      const id = await Purchases.getAppUserID();
      const ci = await Purchases.getCustomerInfo();
      const fb = auth.currentUser?.uid || "";
      console.log("[RC] appUserID:", id, "| firebaseUID:", fb);
      console.log("[RC] isPremium:", !!ci?.entitlements?.active?.[ENTITLEMENT_ID]);
      console.log("[RC] customerInfo:", JSON.stringify(ci, null, 2));
    } catch (e) {
      console.warn("dumpRevenueCat failed:", e?.message || e);
    }
  }, [auth]);

  // ---------- Check premium (force fetch) ----------
  const checkPremium = useCallback(async () => {
    try {
      const ci = await Purchases.getCustomerInfo();
      setCustomerInfo(ci);
      const activeEntitlements = Object.keys(ci?.entitlements?.active || {});
      const hasSub = !!ci?.entitlements?.active?.[ENTITLEMENT_ID];
      console.log("[RC] activeEntitlements:", activeEntitlements, "| hasSub:", hasSub);
      return hasSub;
    } catch (e) {
      console.warn("checkPremium failed:", e?.message || e);
      return false;
    }
  }, []);

  // ---------- Buy monthly ----------
  const buyMonthly = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const monthly = offerings?.current?.monthly;
      if (!monthly) {
        console.warn("[RC] monthly package not found");
        return false;
      }
      const { customerInfo: ci } = await Purchases.purchasePackage(monthly);
      setCustomerInfo(ci);
      const ok = !!ci?.entitlements?.active?.[ENTITLEMENT_ID];
      console.log("[RC] isPremium after buy?", ok);
      return ok;
    } catch (e) {
      if (e?.userCancelled) {
        console.log("[RC] user cancelled purchase");
        return false;
      }
      console.warn("buyMonthly failed:", e?.message || e);
      return false;
    }
  }, []);

  // ---------- Restore purchases ----------
  const restoreRC = useCallback(async () => {
    try {
      const ci = await Purchases.restorePurchases();
      setCustomerInfo(ci);
      const ok = !!ci?.entitlements?.active?.[ENTITLEMENT_ID];
      console.log("[RC] isPremium after restore?", ok);
      return ok;
    } catch (e) {
      console.warn("restoreRC failed:", e?.message || e);
      return false;
    }
  }, []);

  // ---------- React to Firebase auth ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const uid = user?.uid || "";
      setFirebaseUID(uid);
      if (uid) {
        await initRevenueCat(uid);
      } else {
        await logoutRC();
      }
    });
    return unsub;
  }, [auth, initRevenueCat, logoutRC]);

  // ---------- Optional Firebase Auth helpers ----------
  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };
  const signUp = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };
  const signOutUser = async () => {
    await signOut(auth);
    await logoutRC();
  };

  const value = {
    // state
    loading,
    customerInfo,
    isPremium,
    isTrial,
    appUserID,
    firebaseUID,

    // actions
    initRevenueCat,
    logoutRC,
    refreshCustomerInfo,
    dumpRevenueCat,
    checkPremium,
    buyMonthly,
    restoreRC,

    // attribute sync (if you update Firestore profile and want to push to RC)
    syncRevenueCatAttributes,

    // optional auth helpers
    signIn,
    signUp,
    signOutUser,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error("useRevenueCat must be used inside <RevenueCatProvider />");
  return ctx;
}
