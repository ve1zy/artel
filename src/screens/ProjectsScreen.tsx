import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

type SkillRow = {
  id: number;
  name: string;
  category: string;
};

type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  image_path: string | null;
  required_roles: string[] | null;
  created_at: string;
  project_skills?: Array<{ skill_id?: number | null; skills?: { name?: string | null } | null } | null> | null;
};

type ProjectResponseRow = {
  project_id: string;
  user_id: string;
};

type ChatRow = {
  id: string;
  participants: string[];
};

const ROLE_OPTIONS: Array<{ key: string; title: string }> = [
  { key: "frontend", title: "FRONTEND" },
  { key: "backend", title: "BACKEND" },
  { key: "devops", title: "DEVOPS" },
  { key: "ml", title: "ML" },
  { key: "design", title: "DESIGN" },
  { key: "manager", title: "MANAGER" },
  { key: "android", title: "ANDROID" },
  { key: "ios", title: "IOS" },
  { key: "crossplatform", title: "CROSSPLATFORM" },
];

export default function ProjectsScreen() {
  const navigation = useNavigation<any>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>([]);
  const [createSkillIds, setCreateSkillIds] = useState<number[]>([]);
  const [createImageUri, setCreateImageUri] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);

  const [myResponses, setMyResponses] = useState<Record<string, true>>({});
  const [myChatsByUserId, setMyChatsByUserId] = useState<Record<string, true>>({});
  const [pendingInvitesByUserId, setPendingInvitesByUserId] = useState<Record<string, true>>({});

  const [rolesFilter, setRolesFilter] = useState<string[]>([]);
  const [skillsFilter, setSkillsFilter] = useState<number[]>([]);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id || null;
    setUserId(uid);
    return uid;
  };

  const respondToProject = async (p: ProjectRow) => {
    if (!userId) {
      Alert.alert("Ошибка", "Нужно войти в аккаунт");
      return;
    }
    if (p.owner_id === userId) return;
    if (myResponses[p.id]) return;

    try {
      // Same UX as FormsScreen: invitation to the owner
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .contains("participants", [userId, p.owner_id]);
      if (existingChat && existingChat.length > 0) {
        Alert.alert("Чат", "У вас уже есть чат");
        return;
      }

      const { data: existingInvite } = await supabase
        .from("invitations")
        .select("id")
        .eq("from_user", userId)
        .eq("to_user", p.owner_id)
        .eq("status", "pending");
      if (existingInvite && existingInvite.length > 0) {
        Alert.alert("Отклик", "Приглашение уже отправлено");
        return;
      }

      const { data: existing } = await supabase
        .from("project_responses")
        .select("project_id")
        .eq("project_id", p.id)
        .eq("user_id", userId)
        .limit(1);

      if (existing && existing.length > 0) {
        Alert.alert("Отклик", "Вы уже откликнулись");
        setMyResponses((prev) => ({ ...prev, [p.id]: true }));
        return;
      }

      const { error: inviteError } = await supabase.from("invitations").insert({
        from_user: userId,
        to_user: p.owner_id,
        status: "pending",
        project_id: p.id,
        project_title: p.title,
      });
      if (inviteError) throw inviteError;

      setPendingInvitesByUserId((prev) => ({ ...prev, [p.owner_id]: true }));

      const { error } = await supabase.from("project_responses").insert({ project_id: p.id, user_id: userId });
      if (error) throw error;
      Alert.alert("Отклик", "Приглашение отправлено");
      setMyResponses((prev) => ({ ...prev, [p.id]: true }));
    } catch (e) {
      console.error("respondToProject error:", e);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as any).message)
          : e
            ? String(e)
            : "Ошибка при отклике";
      Alert.alert("Ошибка", msg);
    }
  };

  const deleteProject = async (p: ProjectRow) => {
    if (!userId) {
      setStatus({ type: "error", message: "Нужно войти в аккаунт" });
      return;
    }
    if (p.owner_id !== userId) {
      setStatus({ type: "error", message: "Можно удалять только свои проекты" });
      return;
    }

    Alert.alert("Удалить проект?", "Это действие нельзя отменить", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          setStatus(null);
          try {
            if (p.image_path) {
              const { error: removeError } = await supabase.storage.from("project_images").remove([p.image_path]);
              if (removeError) throw removeError;
            }

            const { error: deleteError } = await supabase.from("projects").delete().eq("id", p.id);
            if (deleteError) throw deleteError;

            setStatus({ type: "success", message: "Проект удален" });
            await loadProjects();
          } catch (e) {
            setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при удалении" });
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const loadSkills = async () => {
    const { data, error } = await supabase.from("skills").select("id,name,category").order("name", { ascending: true });
    if (error) throw error;
    setSkills((data ?? []) as SkillRow[]);
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, owner_id, title, image_path, required_roles, created_at, project_skills(skill_id, skills(name))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setProjects((data ?? []) as ProjectRow[]);
  };

  const loadMyResponses = async (uid: string | null) => {
    if (!uid) {
      setMyResponses({});
      return;
    }
    const { data, error } = await supabase.from("project_responses").select("project_id, user_id").eq("user_id", uid);
    if (error) throw error;
    const next: Record<string, true> = {};
    for (const row of (data ?? []) as ProjectResponseRow[]) {
      if (row?.project_id) next[row.project_id] = true;
    }
    setMyResponses(next);
  };

  const loadMyChats = async (uid: string | null) => {
    if (!uid) {
      setMyChatsByUserId({});
      return;
    }
    const { data, error } = await supabase.from("chats").select("id,participants").contains("participants", [uid]);
    if (error) throw error;

    const next: Record<string, true> = {};
    for (const chat of (data ?? []) as ChatRow[]) {
      const other = (chat.participants ?? []).find((p) => p !== uid);
      if (other) next[other] = true;
    }
    setMyChatsByUserId(next);
  };

  const loadPendingInvites = async (uid: string | null) => {
    if (!uid) {
      setPendingInvitesByUserId({});
      return;
    }
    const { data, error } = await supabase
      .from("invitations")
      .select("to_user")
      .eq("from_user", uid)
      .eq("status", "pending");
    if (error) throw error;
    const next: Record<string, true> = {};
    for (const row of (data ?? []) as Array<{ to_user?: string | null }>) {
      if (row?.to_user) next[row.to_user] = true;
    }
    setPendingInvitesByUserId(next);
  };

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const uid = await getUser();
      await Promise.all([loadSkills(), loadProjects(), loadMyResponses(uid), loadMyChats(uid), loadPendingInvites(uid)]);
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при загрузке" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMyResponses(userId);
  }, [userId]);

  useEffect(() => {
    void loadMyChats(userId);
  }, [userId]);

  useEffect(() => {
    void loadPendingInvites(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const subChat = supabase
      .channel("my_chats_projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        void loadMyChats(userId);
      })
      .subscribe();

    return () => {
      subChat.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const subInv = supabase
      .channel("my_invitations_projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations", filter: `from_user=eq.${userId}` },
        () => {
          void loadPendingInvites(userId);
        }
      )
      .subscribe();

    return () => {
      subInv.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const respondedProjectIds = Object.keys(myResponses);
    if (respondedProjectIds.length === 0) return;

    const cleanup = async () => {
      for (const projectId of respondedProjectIds) {
        const p = projects.find((x) => x.id === projectId);
        if (!p) continue;
        if (p.owner_id === userId) continue;

        const hasChat = !!myChatsByUserId[p.owner_id];
        const hasPendingInvite = !!pendingInvitesByUserId[p.owner_id];

        if (!hasChat && !hasPendingInvite) {
          try {
            const { data: serverChat, error: serverChatError } = await supabase
              .from("chats")
              .select("id,participants")
              .contains("participants", [userId, p.owner_id])
              .limit(1);
            if (serverChatError) throw serverChatError;
            if (serverChat && serverChat.length > 0) {
              setMyChatsByUserId((prev) => ({ ...prev, [p.owner_id]: true }));
              continue;
            }

            await supabase.from("project_responses").delete().eq("project_id", projectId).eq("user_id", userId);
          } catch {
            // ignore
          }
          setMyResponses((prev) => {
            if (!prev[projectId]) return prev;
            const next = { ...prev };
            delete next[projectId];
            return next;
          });
        }
      }
    };

    void cleanup();
  }, [userId, projects, myResponses, myChatsByUserId, pendingInvitesByUserId]);

  const onRefresh = () => {
    void load();
  };

  const toggleRoleFilter = (roleKey: string) => {
    setRolesFilter((prev) => (prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]));
  };

  const toggleSkillFilter = (skillId: number) => {
    setSkillsFilter((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  const clearFilters = () => {
    setRolesFilter([]);
    setSkillsFilter([]);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    void load();
  }, [rolesFilter.join(","), skillsFilter.join(",")]);

  useFocusEffect(
    useCallback(() => {
      setStatus(null);
    }, [])
  );

  const filteredSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const hasRoleFilter = rolesFilter.length > 0;
      const hasSkillFilter = skillsFilter.length > 0;

      if (!hasRoleFilter && !hasSkillFilter) return true;

      const roleMatch = hasRoleFilter
        ? (() => {
            const rr = Array.isArray(p.required_roles) ? p.required_roles : [];
            return rr.some((r) => rolesFilter.includes(r));
          })()
        : false;

      const skillMatch = hasSkillFilter
        ? (() => {
            const projectSkillIds = (p.project_skills ?? [])
              .map((row) => row?.skill_id)
              .filter((v): v is number => typeof v === "number");
            return projectSkillIds.some((sid) => skillsFilter.includes(sid));
          })()
        : false;

      return roleMatch || skillMatch;
    });

    const mine: ProjectRow[] = [];
    const others: ProjectRow[] = [];
    for (const p of filtered) {
      if (userId && p.owner_id === userId) mine.push(p);
      else others.push(p);
    }
    return [...mine, ...others];
  }, [projects, rolesFilter, skillsFilter, userId]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Ошибка", "Нужен доступ к галерее");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setCreateImageUri(uri);
  };

  const uriToArrayBuffer = async (uri: string) => {
    if (uri.startsWith("file://") || uri.startsWith("content://")) {
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: "base64" as any });
      const binaryString = globalThis.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      return bytes.buffer;
    }
    const res = await fetch(uri);
    return await res.arrayBuffer();
  };

  const uploadProjectImage = async (projectId: string, uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    const arrayBuffer = await uriToArrayBuffer(manipulated.uri);
    const path = `${projectId}/cover_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("project_images").upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  };

  const toggleRole = (key: string) => {
    setCreateRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const toggleSkill = (id: number) => {
    setCreateSkillIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const onCreate = async () => {
    setStatus(null);
    const title = createTitle.trim();
    if (!title) {
      setStatus({ type: "error", message: "Введите название" });
      return;
    }
    if (!userId) {
      setStatus({ type: "error", message: "Нужно войти в аккаунт" });
      return;
    }

    setLoading(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("projects")
        .insert({ owner_id: userId, title, required_roles: createRoles })
        .select("id")
        .single();
      if (insertError) throw insertError;
      const projectId = inserted.id as string;

      let imagePath: string | null = null;
      if (createImageUri) {
        imagePath = await uploadProjectImage(projectId, createImageUri);
        const { error: updateError } = await supabase.from("projects").update({ image_path: imagePath }).eq("id", projectId);
        if (updateError) throw updateError;
      }

      if (createSkillIds.length > 0) {
        const rows = createSkillIds.map((skillId) => ({ project_id: projectId, skill_id: skillId }));
        const { error: skillsError } = await supabase.from("project_skills").insert(rows);
        if (skillsError) throw skillsError;
      }

      setStatus({ type: "success", message: "Проект создан" });
      setCreateTitle("");
      setCreateRoles([]);
      setCreateSkillIds([]);
      setCreateImageUri(null);
      setExistingImagePath(null);
      setIsCreateOpen(false);
      setEditingProject(null);
      await loadProjects();
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при создании" });
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (p: ProjectRow) => {
    if (!userId || p.owner_id !== userId) return;
    setStatus(null);
    setEditingProject(p);
    setIsCreateOpen(true);
    setCreateTitle(p.title ?? "");
    setCreateRoles(Array.isArray(p.required_roles) ? p.required_roles : []);
    const ids = (p.project_skills ?? [])
      .map((row) => row?.skill_id)
      .filter((v): v is number => typeof v === "number");
    setCreateSkillIds(ids);

    setExistingImagePath(p.image_path ?? null);
    if (p.image_path) {
      const publicUrl = supabase.storage.from("project_images").getPublicUrl(p.image_path).data.publicUrl;
      setCreateImageUri(publicUrl || null);
    } else {
      setCreateImageUri(null);
    }
  };

  const onSaveEdit = async () => {
    if (!editingProject) return;
    setStatus(null);
    const title = createTitle.trim();
    if (!title) {
      setStatus({ type: "error", message: "Введите название" });
      return;
    }
    if (!userId || editingProject.owner_id !== userId) {
      setStatus({ type: "error", message: "Можно редактировать только свои проекты" });
      return;
    }

    setLoading(true);
    try {
      let nextImagePath: string | null = existingImagePath;
      if (createImageUri && (createImageUri.startsWith("file://") || createImageUri.startsWith("content://"))) {
        nextImagePath = await uploadProjectImage(editingProject.id, createImageUri);

        if (existingImagePath && existingImagePath !== nextImagePath) {
          const { error: removeOldError } = await supabase.storage.from("project_images").remove([existingImagePath]);
          if (removeOldError) throw removeOldError;
        }
      }

      const { error: updateError } = await supabase
        .from("projects")
        .update({ title, required_roles: createRoles, image_path: nextImagePath })
        .eq("id", editingProject.id);
      if (updateError) throw updateError;

      const { error: deleteSkillsError } = await supabase.from("project_skills").delete().eq("project_id", editingProject.id);
      if (deleteSkillsError) throw deleteSkillsError;

      if (createSkillIds.length > 0) {
        const rows = createSkillIds.map((skillId) => ({ project_id: editingProject.id, skill_id: skillId }));
        const { error: insertSkillsError } = await supabase.from("project_skills").insert(rows);
        if (insertSkillsError) throw insertSkillsError;
      }

      setStatus({ type: "success", message: "Проект обновлен" });
      setCreateTitle("");
      setCreateRoles([]);
      setCreateSkillIds([]);
      setCreateImageUri(null);
      setExistingImagePath(null);
      setIsCreateOpen(false);
      setEditingProject(null);
      await loadProjects();
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Ошибка при обновлении" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            setStatus(null);
            setIsCreateOpen((v) => {
              const next = !v;
              if (!next) {
                setEditingProject(null);
                setCreateTitle("");
                setCreateRoles([]);
                setCreateSkillIds([]);
                setCreateImageUri(null);
                setExistingImagePath(null);
              }
              return next;
            });
          }}
          style={styles.headerBtnWide}
          disabled={loading}
        >
          <Text style={styles.headerBtnText}>{isCreateOpen ? "ЗАКРЫТЬ" : "+ ДОБАВИТЬ"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtersBlock}>
        <TouchableOpacity
          style={styles.filtersHeaderRow}
          onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.filtersTitleRow}>
            <Text style={styles.filtersTitle}>ФИЛЬТРЫ</Text>
            <Ionicons name={isFiltersExpanded ? "chevron-up" : "chevron-down"} size={16} color="#000" />
          </View>
          <View style={styles.filtersHeaderActions}>
            <TouchableOpacity onPress={onRefresh} disabled={loading} style={[loading ? styles.disabled : null]}>
              <View style={styles.filtersBtnContent}>
                {loading ? <ActivityIndicator size="small" /> : <Ionicons name="refresh" size={14} color="#000" />}
                <Text style={[styles.filtersRefreshText, { marginLeft: 6 }]}>ОБНОВИТЬ</Text>
              </View>
            </TouchableOpacity>
            {(rolesFilter.length > 0 || skillsFilter.length > 0) && (
              <TouchableOpacity onPress={clearFilters} disabled={loading}>
                <Text style={styles.filtersClearText}>СБРОСИТЬ</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {isFiltersExpanded ? (
          <>
            <Text style={styles.filtersLabel}>РОЛИ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersChipsRow}>
              {ROLE_OPTIONS.map((opt) => {
                const selected = rolesFilter.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => toggleRoleFilter(opt.key)}
                    disabled={loading}
                    style={[styles.filtersChip, selected ? styles.filtersChipSelected : null]}
                  >
                    <Text style={[styles.filtersChipText, selected ? styles.filtersChipTextSelected : null]}>{opt.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.filtersLabel, { marginTop: 12 }]}>НАВЫКИ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersChipsRow}>
              {skills.map((s) => {
                const selected = skillsFilter.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => toggleSkillFilter(s.id)}
                    disabled={loading}
                    style={[styles.filtersChip, selected ? styles.filtersChipSelected : null]}
                  >
                    <Text
                      style={[styles.filtersChipText, selected ? styles.filtersChipTextSelected : null]}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </View>

      {status ? (
        <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
      ) : null}

      {isCreateOpen ? (
        <ScrollView style={styles.createCard} contentContainerStyle={styles.createCardContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>{editingProject ? "РЕДАКТИРОВАТЬ" : "СОЗДАТЬ"}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>НАЗВАНИЕ</Text>
          <TextInput
            style={styles.input}
            value={createTitle}
            onChangeText={(v) => {
              setCreateTitle(v);
              if (status) setStatus(null);
            }}
            placeholder="Название проекта"
            placeholderTextColor="#8A8A8A"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>ФОТО</Text>
          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage} disabled={loading}>
              <Text style={styles.imageBtnText}>{createImageUri ? "ИЗМЕНИТЬ" : "ВЫБРАТЬ"}</Text>
            </TouchableOpacity>
            {createImageUri ? <Image source={{ uri: createImageUri }} style={styles.previewImage} /> : <View style={styles.previewPlaceholder} />}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>РОЛИ</Text>
          <View style={styles.chipsWrap}>
            {ROLE_OPTIONS.map((opt) => {
              const selected = createRoles.includes(opt.key);
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => toggleRole(opt.key)}
                  disabled={loading}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{opt.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>НАВЫКИ</Text>
          <View style={styles.chipsWrap}>
            {skills.map((s) => {
              const selected = createSkillIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => toggleSkill(s.id)}
                  disabled={loading}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={editingProject ? onSaveEdit : onCreate} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{editingProject ? "СОХРАНИТЬ" : "СОЗДАТЬ"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filteredSortedProjects.map((p) => {
            const avatarUrl = p.image_path ? supabase.storage.from("project_images").getPublicUrl(p.image_path).data.publicUrl : null;
            const rolesText = Array.isArray(p.required_roles) && p.required_roles.length ? p.required_roles.map((r) => r.toUpperCase()).join(" · ") : "";
            const skillNames = (p.project_skills ?? [])
              .map((row) => row?.skills?.name)
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
            const skillsText = skillNames.length ? skillNames.join(", ") : "";
            const isMine = userId && p.owner_id === userId;
            const isResponded = !!myResponses[p.id];
            const hasChat = !!myChatsByUserId[p.owner_id];

            return (
              <View key={p.id} style={styles.projectCard}>
                <View style={styles.projectTitleRow}>
                  <Text style={styles.projectTitle}>{p.title}</Text>
                  {isMine ? (
                    <View style={styles.projectActionsRow}>
                      <TouchableOpacity onPress={() => onEdit(p)} disabled={loading} style={styles.projectEditBtn}>
                        <Text style={styles.projectEditText}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteProject(p)} disabled={loading} style={styles.projectDeleteBtn}>
                        <Text style={styles.projectDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.projectImageWide} />
                ) : (
                  <View style={styles.projectImageWidePlaceholder} />
                )}

                <View style={styles.projectInfoBelow}>
                  {isMine ? <Text style={styles.mineBadge}>МОЙ</Text> : null}
                  {rolesText ? <Text style={styles.projectMeta}>Роли: {rolesText}</Text> : null}
                  {skillsText ? <Text style={styles.projectMeta}>Навыки: {skillsText}</Text> : null}

                  {!isMine ? (
                    <TouchableOpacity
                      onPress={() => {
                        if (hasChat) {
                          navigation.navigate("Chats", { otherUserId: p.owner_id, openKey: Date.now() });
                          return;
                        }
                        void respondToProject(p);
                      }}
                      disabled={loading || (!hasChat && isResponded)}
                      style={[styles.primaryBtn, (loading || (!hasChat && isResponded)) ? styles.disabled : null]}
                    >
                      <Text style={styles.primaryText}>{hasChat ? "ЧАТ" : isResponded ? "ОТКЛИКНУЛСЯ" : "ОТКЛИКНУТЬСЯ"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 10,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerBtnWide: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnSmall: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerBtnTextSmall: {
    fontSize: 12,
    fontWeight: "800",
  },
  filtersBlock: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  filtersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  filtersTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
  },
  filtersHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filtersBtnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  filtersRefreshText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  filtersClearText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  filtersLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
    marginBottom: 8,
  },
  filtersChipsRow: {
    gap: 8,
    paddingRight: 6,
  },
  filtersChip: {
    height: 36,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  filtersChipSelected: {
    backgroundColor: "#000",
  },
  filtersChipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#000",
  },
  filtersChipTextSelected: {
    color: "#fff",
  },
  status: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  statusError: {
    color: "#d00000",
  },
  statusSuccess: {
    color: "#0a7a2f",
  },
  createCard: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    marginBottom: 12,
    maxHeight: 420,
  },
  createCardContent: {
    padding: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  imageBtn: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imageBtnText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000",
  },
  previewPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#f0f0f0",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: "#000",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
  },
  chipTextSelected: {
    color: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  primaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 40,
  },
  projectCard: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  projectTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  projectImageWide: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#eee",
    marginBottom: 10,
  },
  projectImageWidePlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#f0f0f0",
    marginBottom: 10,
  },
  projectInfoBelow: {
    flex: 1,
  },
  projectActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  projectEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  projectEditText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  projectDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d00000",
    backgroundColor: "#d00000",
    alignItems: "center",
    justifyContent: "center",
  },
  projectDeleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  mineBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0a7a2f",
    marginBottom: 6,
  },
  projectMeta: {
    fontSize: 12,
    color: "#000",
    marginBottom: 4,
  },
});
