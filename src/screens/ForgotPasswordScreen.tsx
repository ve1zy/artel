import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setStatus(null);
      setStep("email");
      setCode(["", "", "", "", "", "", "", ""]);
    });
    return unsubscribe;
  }, [navigation]);

  const codeValue = useMemo(() => code.join(""), [code]);

  const sendCode = async () => {
    setStatus(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus({ type: "error", message: "Введи почту" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({ type: "error", message: "Неверный email" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
      });

      if (error) throw error;

      setStatus({ type: "success", message: "Код отправлен. Проверь почту" });
      setStep("code");
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при отправке кода" });
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);

    if (digit && index < code.length - 1) inputs.current[index + 1]?.focus();
  };

  const onBackspace = (index: number) => {
    if (!code[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const verifyCode = async () => {
    setStatus(null);
    const trimmedEmail = email.trim();

    if (codeValue.length < code.length) {
      setStatus({ type: "error", message: "Введите полный код" });
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: codeValue,
        type: "email",
      });

      if (error) throw error;

      if (data.session) {
        setStatus({ type: "success", message: "Код подтвержден" });
        navigation.replace("ResetPassword", { email: trimmedEmail });
      } else {
        setStatus({ type: "error", message: "Не удалось создать сессию" });
      }
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при проверке кода" });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setStatus(null);
    setCode(["", "", "", "", "", "", "", ""]);
    inputs.current = [];
    await sendCode();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        {step === "email" ? (
          <>
            <Text style={styles.help}>ВВЕДИ ПОЧТУ ДЛЯ СБРОСА ПАРОЛЯ</Text>
            <TextInput
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (status) setStatus(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              placeholder="Email"
            />

            {status ? (
              <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.help}>ВВЕДИ КОД, ОТПРАВЛЕННЫЙ НА ПОЧТУ</Text>
            <Text style={styles.email}>{email.trim()}</Text>

            <View style={styles.otpRow}>
              {code.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={digit}
                  onChangeText={(v) => setDigit(i, v)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={styles.otpBox}
                  placeholder="-"
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace") onBackspace(i);
                  }}
                />
              ))}
            </View>

            <TouchableOpacity onPress={resend} disabled={loading}>
              <Text style={styles.resend}>ОТПРАВИТЬ КОД ЕЩЕ РАЗ</Text>
            </TouchableOpacity>

            {status ? (
              <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity
          onPress={() => {
            if (step === "code") {
              setStep("email");
              setStatus(null);
              setCode(["", "", "", "", "", "", "", ""]);
              return;
            }
            navigation.goBack();
          }}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryText}>НАЗАД</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={loading}
          onPress={step === "email" ? sendCode : verifyCode}
          style={[styles.primaryBtn, loading && styles.disabled]}
        >
          <Text style={styles.primaryText}>{step === "email" ? "ОТПРАВИТЬ" : "ДАЛЬШЕ"}</Text>
        </TouchableOpacity>
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
    paddingBottom: 24,
  },
  header: {
    marginBottom: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  help: {
    fontSize: 12,
    letterSpacing: 1,
    color: "#000",
    textTransform: "uppercase",
    textAlign: "center",
  },
  email: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
  },
  input: {
    alignSelf: "stretch",
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#000",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "stretch",
    paddingHorizontal: 0,
    columnGap: 6,
    marginTop: 14,
    marginBottom: 10,
  },
  otpBox: {
    width: 36,
    height: 42,
    borderWidth: 1,
    borderColor: "#000",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#5A5A5A",
  },
  resend: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
    marginTop: 12,
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
  bottomRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    height: 56,
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
    height: 56,
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
});
