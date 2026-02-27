import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image } from "react-native";
import { supabase } from "../lib/supabase";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";

type Invitation = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  created_at: string;
  from_user_name?: string;
  project_id?: string | null;
  project_title?: string | null;
  role?: string;
  from_user_bio?: string;
  from_user_skills: string[];
};

type Chat = {
  id: string;
  participants: string[];
  created_at: string;
  other_user: string;
  other_user_name: string;
  other_user_avatar_url?: string | null;
  other_user_roles_text?: string;
  project_id?: string | null;
  project_title?: string | null;
};

type Message = {
  id: string;
  chat_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

type SkillRow = {
  name: string;
};



export default function ChatsScreen() {
  const route = useRoute<any>();
  console.log('=== ChatsScreen render ===');
  console.log('Full route:', route);
  console.log('Route params:', route?.params);
  console.log('Route name:', route?.name);
  const [userId, setUserId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [acceptingInvitations, setAcceptingInvitations] = useState<Set<string>>(new Set());
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [invitationsSub, setInvitationsSub] = useState<any>();
  const messagesScrollRef = useRef<ScrollView>(null);
  const openedFromParamsRef = useRef<string | null>(null);
  const lastOpenKeyRef = useRef<number | null>(null);
  const [isChatProfileExpanded, setIsChatProfileExpanded] = useState(false);
  const [chatProfileLoading, setChatProfileLoading] = useState(false);
  const [chatProfileBio, setChatProfileBio] = useState<string>("");
  const [chatProfileSkills, setChatProfileSkills] = useState<string[]>([]);

  const renderTextWithLinks = (raw: string) => {
    const text = String(raw ?? "");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
      <Text>
        {parts.map((part, idx) => {
          if (!part) return null;
          const isUrl = /^https?:\/\//i.test(part);
          if (!isUrl) return <Text key={`${idx}:${part}`}>{part}</Text>;
          return (
            <Text
              key={`${idx}:${part}`}
              style={styles.linkText}
              onPress={() => {
                Linking.openURL(part);
              }}
            >
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  useEffect(() => {
    if (userId) {
      const subInv = supabase
        .channel('invitations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, (payload) => {
          console.log('invitations change:', payload);
          const newInv = payload.new as Invitation;
          const oldInv = payload.old as Invitation;
          
          // Reload for invitee (incoming invitation)
          if (newInv?.to_user === userId) {
            loadInvitations();
          }
          
          // Reload chats for inviter when invitation is accepted
          if (newInv?.status === 'accepted') {
            console.log('Invitation accepted, reloading chats for inviter');
            loadChats();
          }
        })
        .subscribe(() => {
          console.log('subscribed to invitations');
        });
      setInvitationsSub(subInv);

      const subChat = supabase
        .channel('my_chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
          console.log('my chat change:', payload);
          // Reload chats on any change to catch new chats for this user
          loadChats();
          // Handle chat deletion realtime
          if (payload.eventType === 'DELETE') {
            const deletedChatId = (payload.old as any)?.id;
            if (deletedChatId) {
              setChats((prev) => prev.filter((c) => c.id !== deletedChatId));
              if (selectedChat?.id === deletedChatId) {
                setSelectedChat(null);
                setMessages([]);
              }
            }
          }
        })
        .subscribe();

      return () => {
        subInv.unsubscribe();
        subChat.unsubscribe();
      };
    }
  }, [userId]);

  useEffect(() => {
    if (selectedChat) {
      setIsChatProfileExpanded(false);
      setChatProfileBio("");
      setChatProfileSkills([]);

      const sub = supabase
        .channel('messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        console.log('new message raw:', payload);
        if ((payload.new as Message).chat_id === selectedChat.id) {
          console.log('new message for this chat:', payload);
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .subscribe(status => {
        console.log('messages sub status:', status);
      });
      return () => {
        sub.unsubscribe();
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadInvitations();
      loadChats();
    }
  }, [userId]);

  useEffect(() => {
    const otherUserId: string | undefined = route?.params?.otherUserId;
    const openKey: number | undefined = route?.params?.openKey;
    console.log('Route params:', route?.params, 'otherUserId:', otherUserId);
    if (!otherUserId) {
      openedFromParamsRef.current = null;
      lastOpenKeyRef.current = null;
      return;
    }
    if (openedFromParamsRef.current === otherUserId && (openKey == null || lastOpenKeyRef.current === openKey)) {
      console.log('Already opened chat for', otherUserId);
      return;
    }
    if (!userId) {
      console.log('No userId yet, will retry when userId is set');
      return;
    }
    
    console.log('Attempting to open chat with user', otherUserId);
    
    const tryOpenChat = async () => {
      // Always load fresh chats
      const currentChats = await loadChats();
      console.log('Loaded chats:', currentChats.length);
      
      // Now try to find and open the chat
      console.log('Looking for chat with user', otherUserId, 'in', currentChats.map(c => c.other_user));
      const found = currentChats.find((c) => c.other_user === otherUserId);
      if (found) {
        console.log('Found chat, opening:', found.id);
        openedFromParamsRef.current = otherUserId;
        lastOpenKeyRef.current = openKey ?? null;
        openChat(found);
      } else {
        console.log('Chat not found for user', otherUserId);
      }
    };
    
    tryOpenChat();
  }, [route?.params?.otherUserId, route?.params?.openKey, userId]);

  // Handle focus events for tab navigation
  useFocusEffect(
    useCallback(() => {
      console.log('ChatsScreen focused, route params:', route?.params);
      const otherUserId: string | undefined = route?.params?.otherUserId;
      const openKey: number | undefined = route?.params?.openKey;
      if (
        otherUserId &&
        userId &&
        (openedFromParamsRef.current !== otherUserId || (openKey != null && lastOpenKeyRef.current !== openKey))
      ) {
        console.log('Focus effect: attempting to open chat with', otherUserId);
        const tryOpenChat = async () => {
          const currentChats = await loadChats();
          const found = currentChats.find((c) => c.other_user === otherUserId);
          if (found) {
            console.log('Focus effect: found chat, opening:', found.id);
            openedFromParamsRef.current = otherUserId;
            lastOpenKeyRef.current = openKey ?? null;
            openChat(found);
          }
        };
        tryOpenChat();
      }
    }, [route?.params?.otherUserId, route?.params?.openKey, userId])
  );

  const getUser = async () => {
    console.log("ChatsScreen getUser start");
    const { data } = await supabase.auth.getUser();
    console.log("ChatsScreen getUser result:", data.user?.id);
    setUserId(data.user?.id || null);
  };

  const loadInvitations = async () => {
    if (!userId) {
      console.log("loadInvitations: no userId");
      return;
    }
    console.log("loadInvitations: loading for userId:", userId);
    const { data, error } = await supabase
      .from("invitations")
      .select("id, from_user, to_user, status, created_at, project_id, project_title")
      .eq("to_user", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    console.log("loadInvitations: raw data:", data, "error:", error);
    if (error) console.error("loadInvitations error:", error);
    else {
      const invitationsWithNames = await Promise.all(
        (data || []).map(async (i: any) => {
          console.log("loadInvitations: fetching profile for", i.from_user);
          const [{ data: profile, error: profileError }, { data: skillsData, error: skillsError }] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, bio, roles")
              .eq("id", i.from_user)
              .maybeSingle(),
            supabase
              .from("user_skills")
              .select("skills(name)")
              .eq("user_id", i.from_user),
          ]);
          console.log("loadInvitations: profile:", profile, "skills:", skillsData, "errors:", profileError, skillsError);
          const bio = (profile?.bio as string) || "";
          const skills = (skillsData || [])
            .map((row: any) => (row?.skills as any)?.name as string)
            .filter((v: string) => v && v.trim());

          const rolesArr = (profile as any)?.roles as string[] | null | undefined;
          const rolesText = Array.isArray(rolesArr) && rolesArr.length ? rolesArr.map((r) => String(r).toUpperCase()).join(" · ") : "";

          return {
            ...i,
            role: rolesText,
            from_user_name: profile?.full_name,
            from_user_bio: bio,
            from_user_skills: skills,
          };
        })
      );
      console.log("loadInvitations: final invitations:", invitationsWithNames);
      setInvitations(invitationsWithNames);
    }
  };

  const loadChats = async (): Promise<Chat[]> => {
    if (!userId) return [];
    const { data, error } = await supabase.from('chats').select('*').contains('participants', [userId]);
    if (error) {
      console.error(error);
      return [];
    }
    const chatsWithNames = await Promise.all(
      (data || []).map(async (c: any) => {
        const otherUser = (c.participants as string[]).find((p: string) => p !== userId) ?? "";
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, avatar_path, updated_at, roles")
          .eq("id", otherUser)
          .maybeSingle();

        if (profileError) {
          console.error("loadChats: profile error for", otherUser, profileError);
        }

        const shortId = otherUser ? `${otherUser.slice(0, 6)}...${otherUser.slice(-4)}` : "";
        const name = (profile?.full_name || "").trim() || (shortId ? `Пользователь ${shortId}` : "Пользователь");

        const avatarPath = (profile as any)?.avatar_path as string | null | undefined;
        const updatedAt = (profile as any)?.updated_at as string | null | undefined;
        const v = updatedAt ? Date.parse(updatedAt) : 0;
        const avatarUrl = avatarPath ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl : null;
        const displayAvatar = avatarUrl ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${v}` : null;

        const rolesArr = (profile as any)?.roles as string[] | null | undefined;
        const rolesText = Array.isArray(rolesArr) && rolesArr.length ? rolesArr.map((r) => r.toUpperCase()).join(" · ") : "";

        return {
          ...c,
          other_user: otherUser,
          other_user_name: name,
          other_user_avatar_url: displayAvatar,
          other_user_roles_text: rolesText,
        } as Chat;
      })
    );
    setChats(chatsWithNames);
    return chatsWithNames;
  };

  const acceptInvitation = async (invId: string, fromUser: string) => {
    if (acceptingInvitations.has(invId)) return;
    setAcceptingInvitations(prev => new Set(prev).add(invId));

    const { data: currentInv, error: checkError } = await supabase
      .from('invitations')
      .select('status')
      .eq('id', invId)
      .maybeSingle();
    if (checkError) {
      console.error('acceptInvitation checkError:', checkError);
      Alert.alert('Ошибка', 'Не удалось проверить статус приглашения');
      setAcceptingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invId);
        return newSet;
      });
      return;
    }
    if (currentInv?.status !== 'pending') {
      Alert.alert('Ошибка', 'Приглашение уже обработано');
      setAcceptingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invId);
        return newSet;
      });
      return;
    }

    try {
      // Check if chat already exists
      const { data: existingChat, error: existingError } = await supabase
        .from('chats')
        .select('id')
        .contains('participants', [userId!, fromUser]);
      if (existingError) {
        console.error('acceptInvitation existingChat error:', existingError);
        Alert.alert('Ошибка', 'Не удалось проверить существующие чаты');
        return;
      }
      if (existingChat && existingChat.length > 0) {
        Alert.alert('Ошибка', 'Чат уже существует');
        return;
      }

      const { data: invRow, error: invRowError } = await supabase
        .from("invitations")
        .select("project_id, project_title")
        .eq("id", invId)
        .maybeSingle();
      if (invRowError) throw invRowError;

      const { error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invId);
      if (updateError) {
        console.error('acceptInvitation updateError:', updateError);
        Alert.alert('Ошибка', updateError.message || 'Не удалось обновить приглашение');
        return;
      }

      const { error: insertChatError } = await supabase.from('chats').insert({
        participants: [userId!, fromUser],
        project_id: (invRow as any)?.project_id ?? null,
        project_title: (invRow as any)?.project_title ?? null,
      });
      if (insertChatError) {
        console.error('acceptInvitation insertChatError:', insertChatError);
        Alert.alert('Ошибка', insertChatError.message || 'Не удалось создать чат');
        return;
      }
      loadInvitations();
      loadChats();
    } catch (error) {
      console.error('acceptInvitation error:', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as any).message)
          : error
            ? String(error)
            : 'Не удалось принять приглашение';
      Alert.alert('Ошибка', msg);
    } finally {
      setAcceptingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invId);
        return newSet;
      });
    }
  };

  const rejectInvitation = async (invId: string) => {
    await supabase.from('invitations').update({ status: 'rejected' }).eq('id', invId);
    loadInvitations();
  };

  const deleteChat = async (chat: Chat) => {
    if (!userId) return;
    Alert.alert(
      "Удалить чат",
      "Чат и все сообщения будут удалены. Продолжить?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              const { error: messagesError, count: messagesCount } = await supabase
                .from("messages")
                .delete({ count: "exact" })
                .eq("chat_id", chat.id);
              console.log("deleteChat: deleted messages count=", messagesCount);
              if (messagesError) throw messagesError;

              const { error: chatError, count: chatsCount } = await supabase
                .from("chats")
                .delete({ count: "exact" })
                .eq("id", chat.id);
              console.log("deleteChat: deleted chats count=", chatsCount);
              if (chatError) throw chatError;

              if (selectedChat?.id === chat.id) {
                setSelectedChat(null);
                setMessages([]);
              }
              await loadChats();
            } catch (e) {
              console.error("deleteChat error:", e);
              const msg =
                e && typeof e === "object" && "message" in e
                  ? String((e as any).message)
                  : e
                    ? String(e)
                    : "Не удалось удалить чат";
              Alert.alert("Ошибка", msg);
            }
          },
        },
      ]
    );
  };

  const openChat = async (chat: Chat) => {
    setSelectedChat(chat);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });
    if (error) console.error(error);
    else {
      setMessages(data || []);
      setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !userId) return;
    try {
      await supabase.from('messages').insert({ chat_id: selectedChat.id, user_id: userId, message: newMessage.trim() });
      console.log('message sent:', newMessage.trim());
      setNewMessage('');
      openChat(selectedChat);
    } catch (error) {
      console.log('sendMessage error:', error);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    }
  };

  const loadChatProfileDetails = async (otherUserId: string) => {
    if (!otherUserId) return;
    setChatProfileLoading(true);
    try {
      const [{ data: profileData, error: profileError }, { data: skillsData, error: skillsError }] = await Promise.all([
        supabase.from("profiles").select("bio").eq("id", otherUserId).maybeSingle(),
        supabase.from("user_skills").select("skills(name)").eq("user_id", otherUserId),
      ]);

      if (profileError) throw profileError;
      if (skillsError) throw skillsError;

      const bio = (profileData as any)?.bio as string | null | undefined;
      setChatProfileBio(typeof bio === "string" ? bio : "");

      const skillNames = (skillsData ?? [])
        .map((row: any) => (row?.skills as SkillRow | null | undefined)?.name)
        .filter((v: any) => typeof v === "string" && v.trim().length > 0) as string[];
      setChatProfileSkills(skillNames);
    } catch (e) {
      console.error("loadChatProfileDetails error:", e);
      setChatProfileBio("");
      setChatProfileSkills([]);
    } finally {
      setChatProfileLoading(false);
    }
  };

  if (selectedChat) {
    return (
      <View style={styles.container}>
        <View style={styles.chatHeaderRow}>
          <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteChat(selectedChat)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Удалить</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chatHeaderProfile}>
          {selectedChat.other_user_avatar_url ? (
            <Image source={{ uri: selectedChat.other_user_avatar_url }} style={styles.chatHeaderAvatar} />
          ) : (
            <View style={[styles.chatHeaderAvatar, styles.chatAvatarPlaceholder]}>
              <Text style={styles.chatAvatarText}>{selectedChat.other_user_name?.charAt(0)?.toUpperCase() || "?"}</Text>
            </View>
          )}
          <Text style={styles.chatTitle}>{selectedChat.other_user_name}</Text>
          {selectedChat.project_title ? <Text style={styles.chatHeaderProjectText}>{selectedChat.project_title}</Text> : null}
          {selectedChat.other_user_roles_text ? (
            <Text style={[styles.chatHeaderRole, !selectedChat.project_title ? { marginTop: 0 } : null]}>
              {selectedChat.other_user_roles_text}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.chatProfileToggleBtn}
            onPress={async () => {
              const next = !isChatProfileExpanded;
              setIsChatProfileExpanded(next);
              if (next && chatProfileBio === "" && chatProfileSkills.length === 0 && !chatProfileLoading) {
                await loadChatProfileDetails(selectedChat.other_user);
              }
            }}
          >
            <Text style={styles.chatProfileToggleText}>{isChatProfileExpanded ? "СВЕРНУТЬ" : "ПРОФИЛЬ"}</Text>
          </TouchableOpacity>

          {isChatProfileExpanded ? (
            <View style={styles.chatProfileDetails}>
              {chatProfileLoading ? (
                <Text style={styles.chatProfileHint}>Загрузка...</Text>
              ) : (
                <>
                  {chatProfileSkills.length > 0 ? (
                    <View style={styles.chatSkillsWrap}>
                      {chatProfileSkills.map((name) => (
                        <View key={name} style={styles.chatSkillTag}>
                          <Text style={styles.chatSkillText}>{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.chatProfileHint}>Навыки не указаны</Text>
                  )}
                  <Text style={styles.chatBioText}>
                    {chatProfileBio.trim() ? renderTextWithLinks(chatProfileBio) : "Нет описания"}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </View>
        <ScrollView ref={messagesScrollRef} style={styles.messagesContainer}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.message, m.user_id === userId ? styles.myMessage : styles.otherMessage]}>
              <Text style={styles.messageText}>{renderTextWithLinks(m.message)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Введите сообщение"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <Text style={styles.sendText}>Отправить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приглашения</Text>
          {invitations.map((inv) => (
            <View key={inv.id} style={styles.invitation}>
              <Text style={styles.invitationText}>
                От {inv.from_user_name || 'Неизвестный'}
                {inv.role ? ` · ${inv.role}` : ""}
              </Text>
              {inv.project_title ? <Text style={styles.invitationSubText}>{inv.project_title}</Text> : null}
              {inv.from_user_bio ? <Text style={styles.invitationSubText}>{inv.from_user_bio}</Text> : null}
              {inv.from_user_skills.length > 0 ? <Text style={styles.invitationSubText}>Навыки: {inv.from_user_skills.join(', ')}</Text> : null}
              <View style={styles.invitationBtns}>
                <TouchableOpacity onPress={() => acceptInvitation(inv.id, inv.from_user)} style={[styles.acceptBtn, acceptingInvitations.has(inv.id) && styles.disabled]} disabled={acceptingInvitations.has(inv.id)}>
                  <Text style={styles.acceptText}>{acceptingInvitations.has(inv.id) ? 'Принимаю...' : 'Принять'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => rejectInvitation(inv.id)} style={styles.rejectBtn}>
                  <Text style={styles.rejectText}>Отклонить</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        {chats.length === 0 ? (
          <Text style={styles.emptyText}>Нет чатов</Text>
        ) : (
          chats.map((chat) => (
            <View key={chat.id} style={styles.chatItemRow}>
              <TouchableOpacity onPress={() => openChat(chat)} style={styles.chatItem}>
                <View style={styles.chatItemContent}>
                  {chat.other_user_avatar_url ? (
                    <Image source={{ uri: chat.other_user_avatar_url }} style={styles.chatAvatar} />
                  ) : (
                    <View style={[styles.chatAvatar, styles.chatAvatarPlaceholder]}>
                      <Text style={styles.chatAvatarText}>
                        {chat.other_user_name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.chatInfo}>
                    <Text style={styles.chatText}>{chat.other_user_name}</Text>
                    {chat.project_title ? <Text style={styles.chatProjectText}>{chat.project_title}</Text> : null}
                    {chat.other_user_roles_text ? <Text style={styles.chatRole}>{chat.other_user_roles_text}</Text> : null}
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteChat(chat)} style={styles.chatDeleteIconBtn}>
                <Text style={styles.chatDeleteIconText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 50,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  invitation: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  invitationText: {
    fontSize: 14,
    marginBottom: 10,
  },
  invitationSubText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginTop: -6,
    marginBottom: 10,
  },
  invitationBtns: {
    flexDirection: "row",
    gap: 10,
  },
  acceptBtn: {
    backgroundColor: "#0a7a2f",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
  },
  acceptText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
  rejectBtn: {
    backgroundColor: "#d00000",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
  },
  rejectText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  chatItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#000",
    padding: 12,
    borderRadius: 8,
  },
  chatItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#000",
  },
  chatAvatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  chatInfo: {
    flex: 1,
  },
  chatText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chatRole: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  chatProjectText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  backBtn: {
    marginBottom: 10,
  },
  backText: {
    fontSize: 16,
    fontWeight: "800",
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d00000",
    borderRadius: 8,
  },
  deleteText: {
    color: "#d00000",
    fontSize: 12,
    fontWeight: "800",
  },
  chatItemRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 10,
  },
  chatDeleteIconBtn: {
    width: 40,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: "#d00000",
    backgroundColor: "#d00000",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chatDeleteIconText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  chatHeaderProfile: {
    alignItems: "center",
    marginBottom: 10,
  },
  chatHeaderAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  chatHeaderRole: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    marginBottom: 16,
    textAlign: "center",
  },
  chatHeaderProjectText: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 2,
    textAlign: "center",
  },
  chatProfileToggleBtn: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 10,
  },
  chatProfileToggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },
  chatProfileDetails: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  chatProfileHint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  chatSkillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 10,
  },
  chatSkillTag: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chatSkillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
  },
  chatBioText: {
    fontSize: 12,
    color: "#000",
    textAlign: "center",
  },
  linkText: {
    textDecorationLine: "underline",
    color: "#0A66C2",
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 20,
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    maxWidth: "80%",
  },
  myMessage: {
    backgroundColor: "#e8f5e8",
    alignSelf: "flex-end",
  },
  otherMessage: {
    backgroundColor: "#f0f0f0",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
    borderRadius: 4,
  },
  sendBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 4,
  },
  sendText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});
