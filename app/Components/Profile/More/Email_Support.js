// Components/Profile/More/Email_Support.js
import { getAuth } from "@react-native-firebase/auth";
import * as MailComposer from "expo-mail-composer";
import { Alert, Linking } from "react-native";

// change this to your support inbox
const SUPPORT_EMAIL = "support@yourapp.com";

// ⬇️ Named export
export async function OpenSupportEmail() {
  const user = getAuth().currentUser || {};
  const uid = user?.uid || "unknown";
  const email = user?.email || "unknown";

  const subject = "Support Request";
  const body =
    "Please describe your issue above this line.\n\n" +
    `User ID: ${uid}\nEmail: ${email}\nVersion: 1.0.0\n\nVon meinem iPhone gesendet`;

  try {
    // Prefer the native composer (Apple Mail sheet on iOS)
    const available = await MailComposer.isAvailableAsync();
    if (available) {
      await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject,
        body,
        isHtml: false,
      });
      return;
    }

    // Fallback to mailto:
    const url =
      `mailto:${encodeURIComponent(SUPPORT_EMAIL)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    const can = await Linking.canOpenURL(url);
    if (can) return Linking.openURL(url);

    Alert.alert("Mail unavailable", "No email account is set up on this device.");
  } catch (e) {
    Alert.alert("Couldn’t open Mail", e?.message ?? "Try again.");
  }
}

// (optional) keep your sheet component default export if you still use it elsewhere
export default function Email_Support() {
  return null; // if you don't need the sheet UI anymore
}
