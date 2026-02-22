import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/AppNavigator";
import ArtelLogo from "../assets/ArtelLogo";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Ошибка", "Введите почту и пароль");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        navigation.replace("Profile");
      }
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Ошибка", "Введите почту для сброса пароля");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert("Успешно", "Инструкции по сбросу пароля отправлены на почту");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при сбросе пароля");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <ArtelLogo width="100%" height={210} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>ПОЧТА</Text>
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

        <TouchableOpacity disabled={loading} onPress={onLogin} style={[styles.primaryBtn, loading && styles.disabled]}>
          <Text style={styles.primaryBtnText}>ВОЙТИ</Text>
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => navigation.navigate("RegisterStep1")}>
            <Text style={styles.link}>СОЗДАТЬ АККАУНТ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onForgotPassword} disabled={loading}>
            <Text style={styles.link}>ЗАБЫЛ ПАРОЛЬ?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoWrap: {
    marginBottom: 40,
  },
  form: {
    gap: 0,
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
  primaryBtn: {
    height: 56,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  footerLinks: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  link: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
});
