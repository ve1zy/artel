import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";

export default function App() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <AppNavigator />
      <StatusBar style="dark" />
    </>
  );
}
