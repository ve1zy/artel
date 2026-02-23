import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystemLegacy from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

type SkillRow = {
  id: number;
  name: string;
  category: string;
};

export default function ProfileScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarCacheKey, setAvatarCacheKey] = useState<number>(0);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [userSkills, setUserSkills] = useState<SkillRow[]>([]);
  const [nameStatus, setNameStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [signOutStatus, setSignOutStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [skillsStatus, setSkillsStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const avatarDisplayUrl =
    avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))
      ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${avatarCacheKey}`
      : avatarUrl;

  const getAvatarCacheStorageKey = (userId: string) => `avatar_cache_uri:${userId}`;
  const getAvatarCacheVersionKey = (userId: string) => `avatar_cache_version:${userId}`;

  const loadCachedAvatarUri = async (userId: string) => {
    try {
      const [cachedUri, cachedVersion] = await Promise.all([
        AsyncStorage.getItem(getAvatarCacheStorageKey(userId)),
        AsyncStorage.getItem(getAvatarCacheVersionKey(userId)),
      ]);

      if (!cachedUri || !cachedVersion) return;

      const v = Number(cachedVersion);
      if (!Number.isFinite(v)) return;

      setAvatarCacheKey(v);
      setAvatarUrl(cachedUri);
    } catch {
      // ignore
    }
  };

  const createSmallAvatarDataUriFromLocalImage = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 256 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!result.base64) throw new Error("Empty base64");
    return `data:image/jpeg;base64,${result.base64}`;
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setNameStatus(null);
      setPasswordStatus(null);
      setSignOutStatus(null);
      setAvatarStatus(null);
      setSkillsStatus(null);
      fetchUser();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setName(user.user_metadata?.full_name || "");
      await loadCachedAvatarUri(user.id);

      await fetchUserSkills(user.id);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_path, updated_at")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const avatarPath = profileData?.avatar_path as string | null | undefined;
        const updatedAt = (profileData as any)?.updated_at as string | null | undefined;
        if (avatarPath) {
          const v = updatedAt ? Date.parse(updatedAt) : Date.now();
          setAvatarPath(avatarPath);
          if (avatarCacheKey !== v) {
            setAvatarCacheKey(v);
            await downloadAvatarToCache(avatarPath, v);
          }
        }
      } catch {
        // keep previously loaded avatar
      }
    }
  };

  const downloadAvatarToCache = async (path: string, cacheKey: number) => {
    if (!user?.id) return;
    setAvatarLoading(true);
    try {
      const { data, error } = await supabase.storage.from("avatars").download(path);
      if (error) throw error;

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res !== "string") return reject(new Error("Invalid FileReader result"));
          const comma = res.indexOf(",");
          resolve(comma >= 0 ? res.slice(comma + 1) : res);
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(data);
      });

      const dataUri = `data:image/jpeg;base64,${base64}`;
      setAvatarUrl(dataUri);
      await Promise.all([
        AsyncStorage.setItem(getAvatarCacheStorageKey(user.id), dataUri),
        AsyncStorage.setItem(getAvatarCacheVersionKey(user.id), String(cacheKey)),
      ]);
    } catch (e) {
      setAvatarStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка аватара" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const uriToArrayBuffer = async (uri: string) => {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = globalThis.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  };

  const uriToUploadArrayBuffer = async (uri: string) => {
    if (uri.startsWith("file://") || uri.startsWith("content://")) {
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: "base64" as any });
      return base64ToArrayBuffer(base64);
    }
    return uriToArrayBuffer(uri);
  };

  const onDeleteAvatar = async () => {
    setAvatarStatus(null);
    if (!user?.id) {
      setAvatarStatus({ type: "error", message: "Профиль еще загружается" });
      return;
    }

    setAvatarLoading(true);
    try {
      const path = `${user.id}/avatar.jpg`;

      await supabase.storage.from("avatars").remove([path]);

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_path: null, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;

      await Promise.all([
        AsyncStorage.removeItem(getAvatarCacheStorageKey(user.id)),
        AsyncStorage.removeItem(getAvatarCacheVersionKey(user.id)),
      ]);

      setAvatarUrl(null);
      setAvatarPath(null);
      setAvatarCacheKey(Date.now());
      setAvatarModalOpen(false);
    } catch (e) {
      setAvatarStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при удалении аватара" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const onPickAvatar = async () => {
    setAvatarStatus(null);
    if (!user?.id) {
      setAvatarStatus({ type: "error", message: "Профиль еще загружается" });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarStatus({ type: "error", message: "Нужен доступ к галерее" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled) return;

    const localUri = result.assets[0]?.uri;
    const localCacheKey = Date.now();
    if (localUri) {
      try {
        const smallDataUri = await createSmallAvatarDataUriFromLocalImage(localUri);
        setAvatarUrl(smallDataUri);
        setAvatarCacheKey(localCacheKey);
        await Promise.all([
          AsyncStorage.setItem(getAvatarCacheStorageKey(user.id), smallDataUri),
          AsyncStorage.setItem(getAvatarCacheVersionKey(user.id), String(localCacheKey)),
        ]);
      } catch {
        setAvatarUrl(localUri);
      }
    }

    setAvatarLoading(true);
    try {
      const asset = result.assets[0];
      const ext = (asset.fileName?.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${user.id}/avatar.jpg`;

      const prevAvatarPath = avatarPath;

      const arrayBuffer = await uriToUploadArrayBuffer(asset.uri);

      const contentType = asset.mimeType || "image/jpeg";
      const { error: updateError } = await supabase.storage.from("avatars").update(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
      if (updateError) {
        const msg = (updateError as any)?.message || String(updateError);
        const statusCode = (updateError as any)?.statusCode;
        if (statusCode === 404 || /not found/i.test(msg)) {
          const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, arrayBuffer, {
            contentType,
            upsert: false,
          });
          if (uploadError) throw uploadError;
        } else {
          throw updateError;
        }
      }

      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_path: filePath, updated_at: new Date().toISOString() });
      if (profileUpsertError) throw profileUpsertError;

      setAvatarPath(filePath);
      const v = Date.now();
      setAvatarCacheKey(v);
      await downloadAvatarToCache(filePath, v);

      if (prevAvatarPath && prevAvatarPath !== filePath) {
        await supabase.storage.from("avatars").remove([prevAvatarPath]);
      }
    } catch (e) {
      setAvatarStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при загрузке аватара" });
    } finally {
      setAvatarLoading(false);
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
      setSkillsStatus(null);
    } catch (e) {
      setUserSkills([]);
      setSkillsStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при загрузке навыков" });
    }
  };

  const onUpdateName = async () => {
    setNameStatus(null);
    const trimmedNewName = newName.trim();

    if (!trimmedNewName) {
      setNameStatus({ type: "error", message: "Введите имя" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmedNewName },
      });

      if (error) throw error;
      setNameStatus({ type: "success", message: "Имя обновлено" });
      setName(trimmedNewName);
      setNewName("");
    } catch (e) {
      setNameStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при обновлении имени" });
    } finally {
      setLoading(false);
    }
  };

  const onUpdatePassword = async () => {
    setPasswordStatus(null);
    if (password.length < 6) {
      setPasswordStatus({ type: "error", message: "Пароль должен быть не менее 6 символов" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      setPasswordStatus({ type: "success", message: "Пароль обновлен" });
      setPassword("");
    } catch (e) {
      setPasswordStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при обновлении пароля" });
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setSignOutStatus(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace("Login");
    } catch (e) {
      setSignOutStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при выходе" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Modal
        visible={avatarModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalOpen(false)}
      >
        <View style={styles.avatarModalBackdrop}>
          <View style={styles.avatarModalCard}>
            {avatarUrl ? (
              <Image key={avatarCacheKey} source={{ uri: avatarDisplayUrl! }} style={styles.avatarModalImage} />
            ) : (
              <View style={styles.avatarModalPlaceholder} />
            )}

            {avatarStatus?.type === "error" ? (
              <Text style={[styles.status, styles.statusError]}>{avatarStatus.message}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                setAvatarModalOpen(false);
                await onPickAvatar();
              }}
              disabled={avatarLoading}
            >
              <Text style={styles.primaryText}>ИЗМЕНИТЬ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={onDeleteAvatar}
              disabled={avatarLoading}
            >
              <Text style={styles.signOutText}>УДАЛИТЬ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutBtn} onPress={() => setAvatarModalOpen(false)}>
              <Text style={styles.signOutText}>ЗАКРЫТЬ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => setAvatarModalOpen(true)}
          disabled={avatarLoading}
        >
          {avatarUrl ? (
            <Image
              key={avatarCacheKey}
              source={{ uri: avatarDisplayUrl! }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
        </TouchableOpacity>

        {avatarStatus?.type === "error" ? (
          <Text style={[styles.status, styles.statusError]}>{avatarStatus.message}</Text>
        ) : null}

        <Text style={styles.headerName}>{name || "—"}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.headerSkills}>
          {userSkills.length > 0 ? (
            <View style={styles.skillsContainerCenter}>
              {userSkills.map((skill) => (
                <View key={skill.id} style={styles.skillTag}>
                  <Text style={styles.skillText}>{skill.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSkillsCenter}>Навыки не выбраны</Text>
          )}

          {skillsStatus?.type === "error" ? (
            <Text style={[styles.status, styles.statusError]}>{skillsStatus.message}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ИМЯ</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={(v) => {
              setNewName(v);
              if (nameStatus) setNameStatus(null);
            }}
            placeholder="Ваше имя"
          />
          {nameStatus ? (
            <Text style={[styles.status, nameStatus.type === "error" ? styles.statusError : styles.statusSuccess]}>{nameStatus.message}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUpdateName}
            disabled={loading}
          >
            <Text style={styles.primaryText}>ОБНОВИТЬ ИМЯ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.skillsHeader}>
            <Text style={styles.label}>НАВЫКИ</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Skills", { userId: user?.id })}
            disabled={loading}
          >
            <Text style={styles.primaryText}>ИЗМЕНИТЬ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>НОВЫЙ ПАРОЛЬ</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (passwordStatus) setPasswordStatus(null);
            }}
            secureTextEntry
            placeholder="*******"
          />
          {passwordStatus ? (
            <Text style={[styles.status, passwordStatus.type === "error" ? styles.statusError : styles.statusSuccess]}>{passwordStatus.message}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUpdatePassword}
            disabled={loading}
          >
            <Text style={styles.primaryText}>ОБНОВИТЬ ПАРОЛЬ</Text>
          </TouchableOpacity>
        </View>

        {signOutStatus ? (
          <Text style={[styles.status, signOutStatus.type === "error" ? styles.statusError : styles.statusSuccess]}>{signOutStatus.message}</Text>
        ) : null}

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
  avatarWrap: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#000",
  },
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  avatarModalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#000",
  },
  avatarModalImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#eee",
  },
  avatarModalPlaceholder: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#eee",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: "#eee",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  headerName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  headerSkills: {
    alignItems: "center",
    marginTop: -16,
    marginBottom: 30,
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
  skillsContainerCenter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  skillTag: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  skillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#000",
  },
  noSkills: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  noSkillsCenter: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
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
  status: {
    marginTop: -4,
    marginBottom: 12,
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
