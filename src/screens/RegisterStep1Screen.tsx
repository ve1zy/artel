import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import RegistrationLogo from "../assets/RegistrationLogo";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterStep1">;

export default function RegisterStep1Screen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onNext = async () => {
    console.log("onNext triggered");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    console.log("Values:", { trimmedName, trimmedEmail, trimmedPassword: "***" });

    if (!trimmedName) {
      console.log("Validation failed: name");
      Alert.alert("Ошибка", "Введи имя");
      return;
    }

    if (!trimmedEmail) {
      console.log("Validation failed: email empty");
      Alert.alert("Ошибка", "Введи почту");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      console.log("Validation failed: email format");
      Alert.alert("Ошибка", "Неверный email");
      return;
    }

    if (!trimmedPassword) {
      console.log("Validation failed: password");
      Alert.alert("Ошибка", "Введи пароль");
      return;
    }

    setLoading(true);
    console.log("DEBUG: Starting Supabase signUp process");
    
    try {
      console.log("DEBUG: Calling supabase.auth.signInWithOtp...");
      const { data, error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      console.log("DEBUG: Supabase response received", { data: !!data, error: !!error });
      if (error) {
        console.error("DEBUG: Supabase signInWithOtp Error:", error);
        throw error;
      }

      console.log("DEBUG: OTP sent successfully");
      Alert.alert("Код отправлен", "Проверь почту для получения кода входа");
      navigation.navigate("RegisterStep2", { email: trimmedEmail });
    } catch (e) {
      console.error("DEBUG: Catch block error:", e);
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при регистрации");
    } finally {
      setLoading(false);
      console.log("DEBUG: signUp process finished");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RegistrationLogo width="100%" height={120} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>ИМЯ</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="ВАСЯ" />

        <Text style={[styles.label, { marginTop: 16 }]}>ПОЧТА</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholder="debil@mail.ru"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>ПАРОЛЬ</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="*******" />
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>НАЗАД</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            disabled={loading} 
            onPress={onNext} 
            style={[styles.primaryBtn, loading && styles.disabled]}
          >
            <Text style={styles.primaryText}>ДАЛЬШЕ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.progressSegment, i === 0 ? styles.progressActive : styles.progressInactive]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    marginBottom: 28,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#000",
  },
  bottom: {
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  bottomRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  disabled: {
    opacity: 0.6,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
  },
  progressActive: {
    backgroundColor: "#000",
  },
  progressInactive: {
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "transparent",
  },
});
