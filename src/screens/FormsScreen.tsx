import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  updated_at: string | null;
  want_in_project: boolean | null;
};

export default function FormsScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      setMyUserId(uid);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, bio, avatar_path, updated_at, want_in_project")
        .eq("want_in_project", true)
        .neq("id", uid ?? "")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setItems((data ?? []) as ProfileRow[]);
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
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>АНКЕТЫ</Text>
        <TouchableOpacity onPress={load} disabled={loading} style={[styles.refreshBtn, loading && styles.disabled]}>
          <Text style={styles.refreshText}>ОБНОВИТЬ</Text>
        </TouchableOpacity>
      </View>

      {status ? (
        <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>{status.message}</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Анкет пока нет</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {items.map((p) => {
            const avatarUrl = p.avatar_path ? supabase.storage.from("avatars").getPublicUrl(p.avatar_path).data.publicUrl : null;
            const shortId = p.id ? `${p.id.slice(0, 6)}...${p.id.slice(-4)}` : "";
            const name = (p.full_name || "").trim() || (shortId ? `Пользователь ${shortId}` : "Пользователь");
            const bio = (p.bio || "").trim();
            const v = p.updated_at ? Date.parse(p.updated_at) : 0;
            const displayAvatar = avatarUrl ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${v}` : null;

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
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#000",
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
