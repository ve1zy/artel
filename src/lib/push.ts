import { PermissionsAndroid, Platform } from "react-native";

let currentTopic: string | null = null;

const requestAndroidPostNotificationsPermission = async () => {
  if (Platform.OS !== "android") return;
  const v = typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);
  if (!Number.isFinite(v) || v < 33) return;

  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // ignore
  }
};

const getMessaging = (): null | (() => any) => {
  try {
    // Metro still tries to resolve static `require("pkg")` even when wrapped.
    // Using eval keeps it truly optional until the dependency is installed.
    // eslint-disable-next-line no-eval
    const req = eval("require") as any;
    const mod = req("@react-native-firebase/messaging");
    return (mod.default ?? mod) as () => any;
  } catch (e) {
    console.log("push: require @react-native-firebase/messaging failed", e);
    return null;
  }
};

export const syncPushTopicForUser = async (userId: string | null) => {
  const nextTopic = userId ? `user_${userId}` : null;
  if (nextTopic === currentTopic) return;

  try {
    await requestAndroidPostNotificationsPermission();

    const messaging = getMessaging();
    if (!messaging) {
      console.log("push: messaging module not available");
      currentTopic = nextTopic;
      return;
    }

    // Ensure device is registered and token is generated.
    try {
      await messaging().getToken();
    } catch (e) {
      console.log("push: getToken error", e);
    }

    if (currentTopic) {
      try {
        await messaging().unsubscribeFromTopic(currentTopic);
      } catch (e) {
        console.log("push: unsubscribe error", e);
      }
    }

    if (nextTopic) {
      try {
        await messaging().subscribeToTopic(nextTopic);
      } catch (e) {
        console.log("push: subscribe error", e);
      }
    }

    currentTopic = nextTopic;
    console.log("push: synced topic", currentTopic);
  } catch (e) {
    console.log("push: syncPushTopicForUser outer error", e);
  }
};
