import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  updated_at: string | null;
  want_in_project: boolean | null;
  roles?: string[] | null;
};

type SkillRow = {
  id: number;
  name: string;
  category: string;
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

export default function FormsScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [rolesFilter, setRolesFilter] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillsFilter, setSkillsFilter] = useState<number[]>([]);
  const [skillIdsByUser, setSkillIdsByUser] = useState<Record<string, number[]>>({});

  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      if (rolesFilter.length > 0) {
        const pr = Array.isArray((p as any).roles) ? ((p as any).roles as string[]) : [];
        if (!pr.some((r) => rolesFilter.includes(r))) return false;
      }
      if (skillsFilter.length > 0) {
        const userSkillIds = skillIdsByUser[p.id] ?? [];
        if (!userSkillIds.some((sid) => skillsFilter.includes(sid))) return false;
      }
      return true;
    });
  }, [items, rolesFilter, skillsFilter, skillIdsByUser]);

  const toggleRole = (roleKey: string) => {
    setRolesFilter((prev) => (prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]));
  };

  const toggleSkill = (skillId: number) => {
    setSkillsFilter((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  const clearFilters = () => {
    setRolesFilter([]);
    setSkillsFilter([]);
  };

  const loadSkills = async () => {
    try {
      const { data, error } = await supabase.from("skills").select("id,name,category").order("name", { ascending: true });
      if (error) throw error;
      setSkills((data ?? []) as SkillRow[]);
    } catch (e) {
      console.error("FormsScreen loadSkills error:", e);
    }
  };

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      setMyUserId(uid);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, bio, avatar_path, updated_at, want_in_project, roles")
        .eq("want_in_project", true)
        .neq("id", uid ?? "")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as ProfileRow[];
      setItems(rows);

      if (skillsFilter.length > 0) {
        const userIds = rows.map((r) => r.id);
        const { data: usData, error: usError } = await supabase
          .from("user_skills")
          .select("user_id, skill_id")
          .in("user_id", userIds);
        if (usError) throw usError;
        const map: Record<string, number[]> = {};
        (usData ?? []).forEach((r: any) => {
          if (!map[r.user_id]) map[r.user_id] = [];
          map[r.user_id].push(r.skill_id);
        });
        setSkillIdsByUser(map);
      } else {
        setSkillIdsByUser({});
      }
    } catch (e) {
      setItems([]);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as any).message)
          : e
            ? String(e)
            : "Ошибка при загрузке анкет";
      console.error("FormsScreen load error:", e);
      setStatus({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
    load();
  }, []);

  useEffect(() => {
    load();
  }, [rolesFilter, skillsFilter.join(",")]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View />
        <TouchableOpacity onPress={load} disabled={loading} style={[styles.refreshBtn, loading && styles.disabled]}>
          <Text style={styles.refreshText}>ОБНОВИТЬ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtersBlock}>
        <View style={styles.filtersHeaderRow}>
          <Text style={styles.filtersTitle}>ФИЛЬТРЫ</Text>
          {(rolesFilter.length > 0 || skillsFilter.length > 0) && (
            <TouchableOpacity onPress={clearFilters} disabled={loading}>
              <Text style={styles.clearText}>СБРОСИТЬ</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.filterLabel}>РОЛИ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {ROLE_OPTIONS.map((opt) => {
            const selected = rolesFilter.includes(opt.key);
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
        </ScrollView>

        <Text style={[styles.filterLabel, { marginTop: 12 }]}>НАВЫКИ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {skills.map((s) => {
            const selected = skillsFilter.includes(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => toggleSkill(s.id)}
                disabled={loading}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]} numberOfLines={1}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {status ? (
        <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Анкет пока нет</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filteredItems.map((p) => {
            const avatarUrl = p.avatar_path ? supabase.storage.from("avatars").getPublicUrl(p.avatar_path).data.publicUrl : null;
            const shortId = p.id ? `${p.id.slice(0, 6)}...${p.id.slice(-4)}` : "";
            const name = (p.full_name || "").trim() || (shortId ? `Пользователь ${shortId}` : "Пользователь");
            const bio = (p.bio || "").trim();
            const v = p.updated_at ? Date.parse(p.updated_at) : 0;
            const displayAvatar = avatarUrl ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${v}` : null;
            const rolesText = Array.isArray((p as any).roles) && (p as any).roles.length ? (p as any).roles.map((r: string) => r.toUpperCase()).join(" · ") : "";

            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  {displayAvatar ? (
                    <Image source={{ uri: displayAvatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder} />
                  )}

                  <View style={styles.cardInfo}>
                    <Text style={styles.name}>{name}</Text>
                    {rolesText ? <Text style={styles.roles}>{rolesText}</Text> : null}
                    {bio ? <Text style={styles.bio}>{bio}</Text> : <Text style={styles.bioEmpty}>Нет описания</Text>}
                  </View>
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
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
  filtersTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
  },
  clearText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 6,
  },
  chip: {
    height: 36,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#000",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#000",
  },
  chipTextSelected: {
    color: "#fff",
  },
  refreshBtn: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  disabled: {
    opacity: 0.6,
  },
  status: {
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#eee",
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#eee",
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    color: "#000",
  },
  roles: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  bio: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  bioEmpty: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777",
    fontStyle: "italic",
  },
});
