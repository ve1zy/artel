import { PermissionsAndroid, Platform } from "react-native";

let currentTopic: string | null = null;
let tokenRefreshListenerSet = false;

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

const getMessaging = async (): Promise<null | any> => {
  try {
    const mod: any = await import("@react-native-firebase/messaging");
    console.log("push: imported module structure:", typeof mod, Object.keys(mod || {}));
    const messaging = mod?.default?.default ?? mod?.default;
    console.log("push: messaging type:", typeof messaging, "keys:", Object.keys(messaging || {}));
    console.log("push: messaging.default type:", typeof messaging?.default, "keys:", Object.keys(messaging?.default || {}));
    console.log("push: messaging.default.default type:", typeof messaging?.default?.default, "keys:", Object.keys(messaging?.default?.default || {}));
    console.log("push: getToken exists:", typeof messaging?.default?.default?.getToken);
    return mod?.default?.default ?? mod?.default ?? mod;
  } catch (e) {
    console.log("push: load @react-native-firebase/messaging failed", e);
    return null;
  }
};

export const syncPushTopicForUser = async (userId: string | null) => {
  const nextTopic = userId ? `user_${userId}` : null;
  if (nextTopic === currentTopic) return;

  try {
    await requestAndroidPostNotificationsPermission();

    const messaging = await getMessaging();
    if (!messaging) {
      console.log("push: messaging module not available");
      currentTopic = nextTopic;
      return;
    }

    try {
      const token = await messaging().getToken();
      console.log("push: FCM token", token);
    } catch (e) {
      console.log("push: getToken error", e);
    }

    if (!tokenRefreshListenerSet) {
      tokenRefreshListenerSet = true;
      try {
        messaging().onTokenRefresh((token: string) => {
          console.log("push: FCM token refreshed", token);
        });
      } catch (e) {
        console.log("push: onTokenRefresh error", e);
      }
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
