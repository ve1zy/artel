import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email } = route.params;

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password2Visible, setPassword2Visible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setStatus(null);
      setPasswordVisible(false);
      setPassword2Visible(false);
    });
    return unsubscribe;
  }, [navigation]);

  const onSave = async () => {
    setStatus(null);
    if (password.length < 6) {
      setStatus({ type: "error", message: "Пароль должен быть не менее 6 символов" });
      return;
    }

    if (password !== password2) {
      setStatus({ type: "error", message: "Пароли не совпадают" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setStatus({ type: "success", message: "Пароль обновлен" });
      navigation.replace("Login");
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при обновлении пароля" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>НОВЫЙ ПАРОЛЬ</Text>
      <Text style={styles.subtitle}>{email}</Text>

      <Text style={styles.label}>ПАРОЛЬ</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (status) setStatus(null);
          }}
          secureTextEntry={!passwordVisible}
          style={[styles.input, styles.inputWithIcon]}
          placeholder="Пароль"
          placeholderTextColor="#8A8A8A"
        />
        <TouchableOpacity
          onPress={() => setPasswordVisible((v) => !v)}
          style={styles.eyeBtn}
          disabled={loading}
        >
          <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>ПОВТОРИ ПАРОЛЬ</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={password2}
          onChangeText={(v) => {
            setPassword2(v);
            if (status) setStatus(null);
          }}
          secureTextEntry={!password2Visible}
          style={[styles.input, styles.inputWithIcon]}
          placeholder="Повтори пароль"
          placeholderTextColor="#8A8A8A"
        />
        <TouchableOpacity
          onPress={() => setPassword2Visible((v) => !v)}
          style={styles.eyeBtn}
          disabled={loading}
        >
          <Ionicons name={password2Visible ? "eye-off" : "eye"} size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {status ? (
        <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
      ) : null}

      <TouchableOpacity
        disabled={loading}
        onPress={onSave}
        style={[styles.primaryBtn, loading && styles.disabled]}
      >
        <Text style={styles.primaryBtnText}>СОХРАНИТЬ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        disabled={loading}
        onPress={() => navigation.replace("Login")}
        style={styles.secondaryBtn}
      >
        <Text style={styles.secondaryBtnText}>НАЗАД</Text>
      </TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
    color: "#000",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
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
  inputWrap: {
    position: "relative",
  },
  inputWithIcon: {
    paddingRight: 86,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  status: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  statusError: {
    color: "#d00000",
  },
  statusSuccess: {
    color: "#0a7a2f",
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
  secondaryBtn: {
    height: 56,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
