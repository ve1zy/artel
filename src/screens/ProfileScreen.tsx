import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

type SkillRow = {
  id: number;
  name: string;
  category: string;
};

export default function ProfileScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userSkills, setUserSkills] = useState<SkillRow[]>([]);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setName(user.user_metadata?.full_name || "");
      await fetchUserSkills(user.id);
    }
  };

  const fetchUserSkills = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_skills")
        .select("skills!inner(id, name, category)")
        .eq("user_id", userId);

      if (error) throw error;
      setUserSkills((data ?? []).map((item: any) => item.skills));
    } catch (e) {
      console.error("Error fetching user skills:", e);
    }
  };

  const onUpdateName = async () => {
    if (!name.trim()) {
      Alert.alert("Ошибка", "Введите имя");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      });

      if (error) throw error;
      Alert.alert("Успешно", "Имя обновлено");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при обновлении имени");
    } finally {
      setLoading(false);
    }
  };

  const onUpdatePassword = async () => {
    if (password.length < 6) {
      Alert.alert("Ошибка", "Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      Alert.alert("Успешно", "Пароль обновлен");
      setPassword("");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при обновлении пароля");
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace("Login");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при выходе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ПРОФИЛЬ</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.section}>
          <View style={styles.skillsHeader}>
            <Text style={styles.label}>НАВЫКИ</Text>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate("Skills", { userId: user?.id })}
            >
              <Text style={styles.editText}>ИЗМЕНИТЬ</Text>
            </TouchableOpacity>
          </View>
          {userSkills.length > 0 ? (
            <View style={styles.skillsContainer}>
              {userSkills.map((skill) => (
                <View key={skill.id} style={styles.skillTag}>
                  <Text style={styles.skillText}>{skill.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSkills}>Навыки не выбраны</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ИМЯ</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ваше имя"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUpdateName}
            disabled={loading}
          >
            <Text style={styles.primaryText}>ОБНОВИТЬ ИМЯ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>НОВЫЙ ПАРОЛЬ</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="*******"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUpdatePassword}
            disabled={loading}
          >
            <Text style={styles.primaryText}>ОБНОВИТЬ ПАРОЛЬ</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={onSignOut}
          disabled={loading}
        >
          <Text style={styles.signOutText}>ВЫЙТИ ИЗ АККАУНТА</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  skillsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#000",
  },
  editText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#000",
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillTag: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
  },
  skillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  noSkills: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  primaryBtn: {
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
  },
  signOutBtn: {
    marginTop: 40,
    height: 48,
    borderWidth: 1,
    borderColor: "#ff0000",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "#ff0000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
