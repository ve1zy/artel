import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import LoginScreen from "../screens/LoginScreen";
import RegisterStep1Screen from "../screens/RegisterStep1Screen";
import RegisterStep2Screen from "../screens/RegisterStep2Screen";
import SkillsScreen from "../screens/SkillsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import ChatsScreen from "../screens/ChatsScreen";
import TabProjectsIcon from "../assets/TabProjectsIcon";
import TabChatsIcon from "../assets/TabChatsIcon";
import TabProfileIcon from "../assets/TabProfileIcon";

export type RootStackParamList = {
  Login: undefined;
  RegisterStep1: undefined;
  RegisterStep2: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  Skills: { userId: string };
  Tabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type BottomTabParamList = {
  Projects: undefined;
  Chats: undefined;
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

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthed(!!data.session);
      setCheckingSession(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthed(!!session);
    });

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe();
    };
  }, []);

  if (checkingSession) return null;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName={isAuthed ? "Tabs" : "Login"}
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
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
