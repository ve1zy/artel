import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import LoginScreen from "../screens/LoginScreen";
import RegisterStep1Screen from "../screens/RegisterStep1Screen";
import RegisterStep2Screen from "../screens/RegisterStep2Screen";
import SkillsScreen from "../screens/SkillsScreen";

import ProfileScreen from "../screens/ProfileScreen";

export type RootStackParamList = {
  Login: undefined;
  RegisterStep1: undefined;
  RegisterStep2: { email: string };
  Skills: { userId: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ["artelapp://"],
  config: {
    screens: {},
  },
};

export default function AppNavigator() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.queryParams?.email && parsed.queryParams?.token && parsed.queryParams?.type === 'password_recovery') {
        try {
          const { error } = await supabase.auth.verifyOtp({
            email: parsed.queryParams.email as string,
            token: parsed.queryParams.token as string,
            type: 'recovery',
          });
          if (error) throw error;
          Alert.alert('Успешно', 'Пароль изменён');
        } catch (e) {
          Alert.alert('Ошибка', (e as Error).message);
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      handleUrl(url);
    });

    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleUrl(url);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#fff" },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
        <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
        <Stack.Screen name="Skills" component={SkillsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
