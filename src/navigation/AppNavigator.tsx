import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import LoginScreen from "../screens/LoginScreen";
import RegisterStep1Screen from "../screens/RegisterStep1Screen";
import RegisterStep2Screen from "../screens/RegisterStep2Screen";
import SkillsScreen from "../screens/SkillsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import FormsScreen from "../screens/FormsScreen";
import ChatsScreen from "../screens/ChatsScreen";
import TabProjectsIcon from "../assets/TabProjectsIcon";
import TabFormsIcon from "../assets/TabFormsIcon";
import TabChatsIcon from "../assets/TabChatsIcon";
import TabProfileIcon from "../assets/TabProfileIcon";
import { syncPushTopicForUser } from "../lib/push";

export type RootStackParamList = {
  Login: undefined;
  RegisterStep1: undefined;
  RegisterStep2: { email: string; password?: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  Skills: { userId: string };
  Tabs: { screen?: string; params?: { otherUserId?: string; openKey?: number } } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type BottomTabParamList = {
  Projects: undefined;
  Forms: undefined;
  Chats: { otherUserId?: string; openKey?: number } | undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const linking = {
  prefixes: ["artelapp://"],
  config: {
    screens: {},
  },
};

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 70,
          paddingBottom: 18,
          paddingTop: 10,
          borderTopColor: "#000",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#000",
        tabBarInactiveTintColor: "#777",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
      }}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: "ПРОЕКТЫ",
          tabBarIcon: ({ color }) => <TabProjectsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Forms"
        component={FormsScreen}
        options={{
          title: "АНКЕТЫ",
          tabBarIcon: ({ color }) => <TabFormsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: "ЧАТЫ",
          tabBarIcon: ({ color }) => <TabChatsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "ПРОФИЛЬ",
          tabBarIcon: ({ color }) => <TabProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const ensureProfileRow = async (user: any) => {
    if (!user?.id) return;
    const fullName = (user.user_metadata as any)?.full_name;
    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
        updated_at: new Date().toISOString(),
      });
  };

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (url: string) => {
      if (!url) return;
      if (!url.includes("auth-callback")) return;
      console.log("OAuth callback url:", url);

      const parsed = Linking.parse(url);
      const params: Record<string, any> = {
        ...(parsed?.queryParams ?? {}),
      };
      const fragmentParams: Record<string, any> = {};
      const fragment = url.split('#')[1];
      if (fragment) {
        fragment.split('&').forEach((pair: string) => {
          const [key, value] = pair.split('=');
          if (key && value) fragmentParams[decodeURIComponent(key)] = decodeURIComponent(value);
        });
      }
      console.log("OAuth callback params:", params);
      console.log("OAuth callback fragment params:", fragmentParams);

      if (!url.includes("code=") && !url.includes("error=") && !url.includes("access_token=")) {
        console.log("OAuth callback ignored (no auth params)");
        return;
      }
      try {
        if (url.includes("code=")) {
          const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
          console.log("OAuth exchange result:", {
            hasSession: !!exchanged?.session,
            hasUser: !!exchanged?.user,
            exchangeError: exchangeError?.message ?? null,
          });
        } else if (fragmentParams.access_token && fragmentParams.refresh_token) {
          console.log("OAuth implicit flow: setting session with tokens");
          const { data, error } = await supabase.auth.setSession({
            access_token: fragmentParams.access_token,
            refresh_token: fragmentParams.refresh_token,
          });
          console.log("OAuth setSession result:", {
            hasSession: !!data.session,
            setError: error?.message ?? null,
          });
        } else {
          console.log("OAuth callback has neither code nor tokens");
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        console.log("OAuth getSession result:", {
          hasSession: !!data.session,
          sessionError: sessionError?.message ?? null,
        });
        if (isMounted) {
          setIsAuthed(!!data.session);
          if (data.session?.user) ensureProfileRow(data.session.user);
          setCheckingSession(false);
        }
      } catch (e) {
        console.error("OAuth exchangeCodeForSession error:", e);
        if (isMounted) setCheckingSession(false);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (url) handleUrl(url);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthed(!!data.session);
      if (data.session?.user) ensureProfileRow(data.session.user);
      void syncPushTopicForUser(data.session?.user?.id ?? null);
      setCheckingSession(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log("supabase onAuthStateChange:", event, "hasSession=", !!session);
      setIsAuthed(!!session);
      if (session?.user) ensureProfileRow(session.user);
      void syncPushTopicForUser(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe();
      urlSub.remove();
    };
  }, []);

  if (checkingSession) return null;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#fff" },
        }}
      >
        {isAuthed ? (
          <>
            <Stack.Screen name="Tabs" component={TabsNavigator} />
            <Stack.Screen name="Skills" component={SkillsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
            <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
            <Stack.Screen name="Skills" component={SkillsScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
