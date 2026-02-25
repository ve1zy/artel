import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/AppNavigator";
import ArtelLogo from "../assets/ArtelLogo";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setStatus(null);
      setPasswordVisible(false);
      setLoading(false);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", async ({ url }) => {
      if (!url) return;
      if (!url.includes("auth-callback")) return;
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch (e) {
        console.error("OAuth exchangeCodeForSession error:", e);
      }
    });
    return () => sub.remove();
  }, [navigation]);

  const onLogin = async () => {
    setStatus(null);
    if (!email.trim() || !password.trim()) {
      setStatus({ type: "error", message: "Введите почту и пароль" });
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
        setStatus({ type: "success", message: "Вход выполнен" });
      }
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при входе" });
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = () => {
    navigation.navigate("ForgotPassword");
  };

  const onOAuth = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const redirectTo = __DEV__ ? "artelapp://auth-callback" : Linking.createURL("auth-callback");
      console.log("redirectTo:", redirectTo);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      const authUrl = data?.url;
      if (!authUrl) throw new Error("Не удалось открыть авторизацию");

      if (Platform.OS === "android") {
        await Linking.openURL(authUrl);
        setLoading(false);
        return;
      }

      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
      if (res.type !== "success") return;

      if ("url" in res && typeof (res as any).url === "string") {
        await supabase.auth.exchangeCodeForSession((res as any).url);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Не удалось создать сессию");
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка авторизации" });
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
          onChangeText={(v) => {
            setEmail(v);
            if (status) setStatus(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholder="debil@mail.ru"
          placeholderTextColor="#8A8A8A"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>ПАРОЛЬ</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (status) setStatus(null);
            }}
            secureTextEntry={!passwordVisible}
            style={[styles.input, styles.inputWithIcon]}
            placeholder="*******"
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

        {status ? (
          <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
        ) : null}

        <TouchableOpacity disabled={loading} onPress={onLogin} style={[styles.primaryBtn, loading && styles.disabled]}>
          <Text style={styles.primaryBtnText}>ВОЙТИ</Text>
        </TouchableOpacity>

        <View style={styles.oauthRow}>
          <TouchableOpacity disabled={loading} onPress={onOAuth} style={[styles.oauthBtn, loading && styles.disabled]}>
            <Text style={styles.oauthText}>GITHUB</Text>
          </TouchableOpacity>
        </View>

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
  footerLinks: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  oauthRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  oauthBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  oauthText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  link: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
});
