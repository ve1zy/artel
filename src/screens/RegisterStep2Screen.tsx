import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import RegistrationLogo from "../assets/RegistrationLogo";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterStep2">;

export default function RegisterStep2Screen({ navigation, route }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);

  const codeValue = useMemo(() => code.join(""), [code]);

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

  const onNext = async () => {
    if (codeValue.length < code.length) {
      Alert.alert("Ошибка", "Введите полный код");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: codeValue,
        type: "email",
      });

      if (error) throw error;

      if (data.user) {
        navigation.navigate("Skills", { userId: data.user.id });
      }
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при проверке кода");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <RegistrationLogo width="100%" height={180} />
      </View>

      <View style={styles.center}>
        <Text style={styles.help}>ВВЕДИ КОД, ОТПРАВЛЕННЫЙ НА ПОЧТУ</Text>
        <Text style={styles.email}>{email}</Text>

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
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Backspace") onBackspace(i);
              }}
            />
          ))}
        </View>

        <TouchableOpacity onPress={() => Alert.alert("TODO", "Повторная отправка") }>
          <Text style={styles.resend}>ОТПРАВИТЬ КОД ЕЩЕ РАЗ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>НАЗАД</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={loading} onPress={onNext} style={[styles.primaryBtn, loading && styles.disabled]}>
          <Text style={styles.primaryText}>ДАЛЬШЕ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.progressSegment, i === 1 ? styles.progressActive : styles.progressInactive]}
          />
        ))}
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
  },
  email: {
    fontSize: 22,
    fontWeight: "800",
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
  progressRow: {
    marginTop: 14,
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
