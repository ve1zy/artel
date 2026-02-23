import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
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
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setStatus(null);
    });
    return unsubscribe;
  }, [navigation]);

  const onNext = async () => {
    setStatus(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    if (!trimmedName) {
      setStatus({ type: "error", message: "Введи имя" });
      return;
    }

    if (!trimmedEmail) {
      setStatus({ type: "error", message: "Введи почту" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({ type: "error", message: "Неверный email" });
      return;
    }

    if (!trimmedPassword) {
      setStatus({ type: "error", message: "Введи пароль" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (error) throw error;

      setStatus({ type: "success", message: "Код отправлен. Проверь почту" });
      navigation.navigate("RegisterStep2", { email: trimmedEmail });
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при регистрации" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RegistrationLogo width="100%" height={120} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>ИМЯ</Text>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (status) setStatus(null);
          }}
          style={styles.input}
          placeholder="ВАСЯ"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>ПОЧТА</Text>
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
        />

        <Text style={[styles.label, { marginTop: 16 }]}>ПАРОЛЬ</Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (status) setStatus(null);
          }}
          secureTextEntry
          style={styles.input}
          placeholder="*******"
        />

        {status ? (
          <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
        ) : null}
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
