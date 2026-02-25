import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { supabase } from "../lib/supabase";

type Invitation = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  created_at: string;
  from_user_name?: string;
};

type Chat = {
  id: string;
  participants: string[];
  created_at: string;
  other_user: string;
  other_user_name: string;
};

type Message = {
  id: string;
  chat_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

export default function ChatsScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadInvitations();
      loadChats();
    }
  }, [userId]);

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
      .select("id, from_user, to_user, status, created_at")
      .eq("to_user", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    console.log("loadInvitations: raw data:", data, "error:", error);
    if (error) console.error("loadInvitations error:", error);
    else {
      const invitationsWithNames = await Promise.all(
        (data || []).map(async (i: Invitation) => {
          console.log("loadInvitations: fetching name for", i.from_user);
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", i.from_user)
            .maybeSingle();
          console.log("loadInvitations: profile for", i.from_user, ":", profile, "error:", profileError);
          return { ...i, from_user_name: profile?.full_name };
        })
      );
      console.log("loadInvitations: final invitations:", invitationsWithNames);
      setInvitations(invitationsWithNames);
    }
  };

  const loadChats = async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('chats').select('*').contains('participants', [userId]);
    if (error) console.error(error);
    else {
      const chatsWithNames = await Promise.all(
        (data || []).map(async (c: any) => {
          const otherUser = (c.participants as string[]).find((p: string) => p !== userId) ?? "";
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", otherUser)
            .maybeSingle();
          return { ...c, other_user: otherUser, other_user_name: profile?.full_name || "Unknown" } as Chat;
        })
      );
      setChats(chatsWithNames);
    }
  };

  const acceptInvitation = async (invId: string, fromUser: string) => {
    try {
      await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invId);
      await supabase.from('chats').insert({ participants: [userId!, fromUser] });
      loadInvitations();
      loadChats();
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось принять приглашение');
    }
  };

  const rejectInvitation = async (invId: string) => {
    await supabase.from('invitations').update({ status: 'rejected' }).eq('id', invId);
    loadInvitations();
  };

  const openChat = async (chat: Chat) => {
    setSelectedChat(chat);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });
    if (error) console.error(error);
    else setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !userId) return;
    try {
      await supabase.from('messages').insert({ chat_id: selectedChat.id, user_id: userId, message: newMessage.trim() });
      setNewMessage('');
      openChat(selectedChat);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    }
  };

  if (selectedChat) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.chatTitle}>{selectedChat.other_user_name}</Text>
        <ScrollView style={styles.messagesContainer}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.message, m.user_id === userId ? styles.myMessage : styles.otherMessage]}>
              <Text style={styles.messageText}>{m.message}</Text>
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
              <Text style={styles.invitationText}>От {inv.from_user_name || 'Неизвестный'}</Text>
              <View style={styles.invitationBtns}>
                <TouchableOpacity onPress={() => acceptInvitation(inv.id, inv.from_user)} style={styles.acceptBtn}>
                  <Text style={styles.acceptText}>Принять</Text>
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
        <Text style={styles.sectionTitle}>Чаты</Text>
        {chats.length === 0 ? (
          <Text style={styles.emptyText}>Нет чатов</Text>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity key={chat.id} onPress={() => openChat(chat)} style={styles.chatItem}>
              <Text style={styles.chatText}>{chat.other_user_name}</Text>
            </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: "#000",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  chatText: {
    fontSize: 16,
    fontWeight: "600",
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
    color: "#000",
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
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
