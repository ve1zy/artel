import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";

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

const renderBio = (text: string) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/);
  return parts.map((part, index) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <TouchableOpacity key={index} onPress={() => Linking.openURL(part)}>
          <Text style={[styles.bio, styles.bioLink]}>{part}</Text>
        </TouchableOpacity>
      );
    } else {
      return <Text key={index} style={styles.bio}>{part}</Text>;
    }
  });
};

export default function FormsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sentInvitations, setSentInvitations] = useState<{ [toUserId: string]: { invited?: boolean; chat?: boolean } }>({});
  const [rolesFilter, setRolesFilter] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillsFilter, setSkillsFilter] = useState<number[]>([]);
  const [skillIdsByUser, setSkillIdsByUser] = useState<Record<string, number[]>>({});
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      const hasRoleFilter = rolesFilter.length > 0;
      const hasSkillFilter = skillsFilter.length > 0;

      if (!hasRoleFilter && !hasSkillFilter) return true;

      const roleMatch = hasRoleFilter
        ? (() => {
            const pr = Array.isArray((p as any).roles) ? ((p as any).roles as string[]) : [];
            return pr.some((r) => rolesFilter.includes(r));
          })()
        : false;

      const skillMatch = hasSkillFilter
        ? (() => {
            const userSkillIds = skillIdsByUser[p.id] ?? [];
            return userSkillIds.some((sid) => skillsFilter.includes(sid));
          })()
        : false;

      return roleMatch || skillMatch;
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

  const onInvite = async (toUserId: string) => {
    if (!myUserId) return;
    try {
      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .contains('participants', [myUserId, toUserId]);
      if (existingChat && existingChat.length > 0) {
        alert('У вас уже есть чат');
        return;
      }
      // Check if already sent pending invitation
      const { data: existing } = await supabase
        .from('invitations')
        .select('id')
        .eq('from_user', myUserId)
        .eq('to_user', toUserId)
        .eq('status', 'pending');
      if (existing && existing.length > 0) {
        alert('Приглашение уже отправлено');
        return;
      }
      const { error } = await supabase.from('invitations').insert({
        from_user: myUserId,
        to_user: toUserId,
        status: 'pending'
      });
      if (error) throw error;
      alert('Приглашение отправлено');
      setSentInvitations(prev => ({ ...prev, [toUserId]: { invited: true, chat: prev[toUserId]?.chat ?? false } }));
    } catch (e) {
      alert('Ошибка отправки приглашения');
    }
  };

  const loadSkills = async () => {
    try {
      const { data, error } = await supabase.from("skills").select("id,name,category").order("name", { ascending: true });
      if (error) throw error;
      console.log("loaded skills:", data);
      setSkills((data ?? []) as SkillRow[]);
    } catch (e) {
      console.error("FormsScreen loadSkills error:", e);
    }
  };

  const loadSentInvitations = async (userId: string) => {
    console.log("loadSentInvitations: loading for", userId);
    const { data, error } = await supabase
      .from("invitations")
      .select("to_user")
      .eq("from_user", userId)
      .eq("status", "pending");
    console.log("loadSentInvitations: data", data, "error", error);
    if (error) {
      console.error(error);
      return;
    }
    const sent =
      data?.reduce(
        (acc: { [toUserId: string]: { invited?: boolean; chat?: boolean } }, inv: any) => ({
          ...acc,
          [inv.to_user]: { invited: true },
        }),
        {}
      ) || {};
    setSentInvitations((prev) => {
      const next: { [toUserId: string]: { invited?: boolean; chat?: boolean } } = { ...prev };
      // Clear invited status for users not in pending list
      Object.keys(next).forEach((key) => {
        if (!data?.find((inv: any) => inv.to_user === key)) {
          delete next[key].invited;
          // If no chat either, remove the entry entirely
          if (!next[key].chat) {
            delete next[key];
          }
        }
      });
      // Add invited status for pending invitations
      (data ?? []).forEach((inv: any) => {
        next[inv.to_user] = { ...next[inv.to_user], invited: true };
      });
      return next;
    });
  };

  const loadChatsForSent = async (userId: string) => {
    const { data, error } = await supabase
      .from("chats")
      .select("participants")
      .contains("participants", [userId]);
    if (error) {
      console.error(error);
      return;
    }
    setSentInvitations((prev) => {
      const next: { [toUserId: string]: { invited?: boolean; chat?: boolean } } = {};
      // Copy existing invited statuses
      Object.entries(prev).forEach(([key, val]) => {
        if (val.invited) {
          next[key] = { invited: true };
        }
      });
      // Add chat statuses from current data
      (data ?? []).forEach((chat: any) => {
        const other = (chat.participants ?? []).find((p: string) => p !== userId);
        if (other) {
          next[other] = { ...next[other], chat: true };
        }
      });
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) throw new Error("Not authenticated");
      const uid = session.session.user.id;
      setMyUserId(uid);
      await loadSkills();
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", uid)
        .eq("want_in_project", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const profiles = (profilesData ?? []) as ProfileRow[];
      const { data: userSkillsData, error: usError } = await supabase
        .from("user_skills")
        .select("user_id, skill_id");
      if (usError) throw usError;
      const skillMap: Record<string, number[]> = {};
      (userSkillsData ?? []).forEach((us: any) => {
        skillMap[us.user_id] = skillMap[us.user_id] || [];
        skillMap[us.user_id].push(us.skill_id);
      });
      setSkillIdsByUser(skillMap);
      setItems(profiles);
      setLoading(false);
      setStatus(null);
      await loadSentInvitations(uid);
      await loadChatsForSent(uid);
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
    if (myUserId) {
      const subInv = supabase
        .channel('sent_invitations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `from_user=eq.${myUserId}` }, (payload) => {
          console.log('sent invitation change:', payload);
          const newInv = payload.new as any;
          const oldInv = payload.old as any;
          
          // Reload sent invitations list
          loadSentInvitations(myUserId);
          
          // If invitation was accepted, reload chats to show "ЧАТ" button
          if (newInv?.status === 'accepted') {
            console.log('Invitation accepted, reloading chats for inviter');
            loadChatsForSent(myUserId);
          }
        })
        .subscribe();

      const subChat = supabase
        .channel('my_chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
          console.log('my chat change:', payload);
          // Reload chats on any change to catch new/updated/deleted chats
          loadChatsForSent(myUserId);
        })
        .subscribe();

      return () => {
        subInv.unsubscribe();
        subChat.unsubscribe();
      };
    }
  }, [myUserId]);

  useEffect(() => {
    load();
  }, [rolesFilter, skillsFilter.join(",")]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View />
      </View>

      <View style={styles.filtersBlock}>
        <TouchableOpacity style={styles.filtersHeaderRow} onPress={() => setIsFiltersExpanded(!isFiltersExpanded)} activeOpacity={0.8}>
          <View style={styles.filtersTitleRow}>
            <Text style={styles.filtersTitle}>ФИЛЬТРЫ</Text>
            <Ionicons name={isFiltersExpanded ? "chevron-up" : "chevron-down"} size={16} color="#000" />
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={load} disabled={loading} style={[loading && styles.disabled]}>
              <View style={styles.btnContent}>
                <Ionicons name="refresh" size={14} color="#000" />
                <Text style={[styles.refreshText, { marginLeft: 6 }]}>ОБНОВИТЬ</Text>
              </View>
            </TouchableOpacity>
            {(rolesFilter.length > 0 || skillsFilter.length > 0) && (
              <TouchableOpacity onPress={clearFilters} disabled={loading}>
                <Text style={styles.clearText}>СБРОСИТЬ</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {isFiltersExpanded && (
          <>
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
          </>
        )}
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
            const userSkillIds = skillIdsByUser[p.id] ?? [];
            const userSkills = userSkillIds.map(id => skills.find(s => s.id === id)?.name).filter(Boolean).join(", ");

            let buttonText = "ПРИГЛАСИТЬ";
            let onPress = () => { onInvite(p.id); };
            let disabled = false;
            const status = sentInvitations[p.id];
            if (status?.chat) {
              buttonText = "ЧАТ";
              onPress = () => {
                console.log('Opening chat with user:', p.id);
                navigation.navigate("Tabs", { screen: "Chats", params: { otherUserId: p.id } });
              };
              disabled = false;
            } else if (status?.invited) {
              buttonText = "ПРИГЛАШЕНО";
              onPress = () => {};
              disabled = true;
            }

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
                    {userSkills ? <Text style={styles.skills}>Навыки: {userSkills}</Text> : null}
                    {bio ? renderBio(bio) : <Text style={styles.bioEmpty}>Нет описания</Text>}
                  </View>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={onPress} disabled={disabled}>
                  <Text style={styles.primaryBtnText}>{buttonText}</Text>
                </TouchableOpacity>
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
  filtersTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clearText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
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
  bioLink: {
    color: "#007AFF",
    textDecorationLine: "underline",
  },
  primaryBtn: {
    height: 48,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  skills: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#000",
    marginTop: 4,
  },
});
