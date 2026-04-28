import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { useAuth } from "../contexts/AuthContext";
import { getFriendProfile, listFriendMessages, sendFriendMessage } from "../services/api";
import { colors, radii, shadows } from "../theme";
import { ChatMessage, FriendProfile, TimelineRecord } from "../types";
import { RootStackParamList } from "../navigation/types";
import { formatDate, formatDuration } from "../utils/format";


type FriendProfileRoute = RouteProp<RootStackParamList, "FriendProfile">;


export function FriendProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<FriendProfileRoute>();
  const { friendId, displayName } = route.params;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadProfile();
  }, [friendId]);

  async function loadProfile() {
    try {
      setLoading(true);
      const [response, messageResponse] = await Promise.all([
        getFriendProfile(friendId),
        listFriendMessages(friendId),
      ]);
      setProfile(response);
      setMessages(messageResponse);
    } catch (error) {
      Alert.alert("加载好友主页失败", extractMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    const body = draft.trim();
    if (!body) {
      return;
    }

    try {
      setSending(true);
      const message = await sendFriendMessage(friendId, body);
      setMessages((current) => [...current, message]);
      setDraft("");
    } catch (error) {
      Alert.alert("发送失败", extractMessage(error));
    } finally {
      setSending(false);
    }
  }

  function openRecord(record: TimelineRecord) {
    navigation.navigate("TagDetail", { uid: record.uid });
  }

  const user = profile?.user;
  const title = user?.display_name || displayName || "好友主页";

  return (
    <ScreenShell
      title={title}
      subtitle="这里展示好友主页中当前有效的音频。点击音频可以进入播放页面。"
      headerLeading={
        <PrimaryButton label="返回" onPress={() => navigation.goBack()} variant="ghost" size="sm" />
      }
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadProfile()}
          variant="ghost"
          size="sm"
          disabled={loading}
        />
      }
    >
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={profile?.records ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerBlocks}>
            {user ? (
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitial(user.display_name)}</Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{user.display_name || "SoundTag 用户"}</Text>
                  <Text style={styles.profilePhone}>{user.phone}</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countValue}>{profile.records.length}</Text>
                  <Text style={styles.countLabel}>音频</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>聊天</Text>
                <PrimaryButton
                  label="刷新消息"
                  onPress={() => void loadProfile()}
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                />
              </View>
              <View style={styles.messageList}>
                {messages.length ? (
                  messages.slice(-8).map((message) => {
                    const isMine = message.sender_id === currentUser?.id;
                    return (
                      <View
                        key={message.id}
                        style={[styles.messageBubble, isMine ? styles.myMessage : styles.friendMessage]}
                      >
                        <Text style={[styles.messageBody, isMine ? styles.myMessageText : null]}>{message.body}</Text>
                        <Text style={[styles.messageTime, isMine ? styles.myMessageTime : null]}>
                          {formatDate(message.created_at)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noMessages}>还没有聊天记录，发送第一条消息。</Text>
                )}
              </View>
              <View style={styles.messageComposer}>
                <TextInput
                  maxLength={1000}
                  onChangeText={setDraft}
                  placeholder="输入消息"
                  placeholderTextColor={colors.textSoft}
                  style={styles.messageInput}
                  value={draft}
                />
                <PrimaryButton
                  label="发送"
                  onPress={() => void handleSendMessage()}
                  loading={sending}
                  disabled={!draft.trim()}
                  size="sm"
                />
              </View>
            </View>

            <Text style={styles.recordsTitle}>共享音频</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => openRecord(item)}
            style={({ pressed }) => [
              styles.recordCard,
              index === 0 ? styles.highlightCard : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.iconBubble}>
              <Text style={styles.iconText}>♪</Text>
            </View>
            <View style={styles.recordCopy}>
              <Text style={styles.recordTitle}>{item.title?.trim() || "未命名音频"}</Text>
              <Text style={styles.recordMeta}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={styles.durationBlock}>
              <Text style={styles.duration}>{formatDuration(item.duration_seconds)}</Text>
              <Text style={styles.playHint}>播放</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>暂无可共享音频</Text>
              <Text style={styles.emptyText}>好友录制并保存到 NFC 标签后，会显示在这里。</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={() => void loadProfile()}
        showsVerticalScrollIndicator={false}
      />
    </ScreenShell>
  );
}


function getInitial(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "友";
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error) {
    const axiosError = error as {
      message?: unknown;
      response?: {
        data?: unknown;
      };
    };
    const detail = axiosError.response?.data;

    if (
      typeof detail === "object" &&
      detail &&
      "detail" in detail &&
      typeof detail.detail === "string"
    ) {
      return detail.detail;
    }

    if (typeof axiosError.message === "string") {
      return axiosError.message;
    }
  }

  return "请确认网络和后端服务正常。";
}


const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    gap: 14,
    paddingBottom: 116,
  },
  headerBlocks: {
    gap: 14,
  },
  profileCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: radii.xl,
    padding: 18,
    backgroundColor: "rgba(204,211,255,0.48)",
    borderWidth: 1,
    borderColor: "rgba(204,211,255,0.72)",
    gap: 14,
    ...shadows.soft,
  },
  chatCard: {
    borderRadius: radii.xl,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.46)",
    gap: 12,
    ...shadows.soft,
  },
  chatHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chatTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  messageList: {
    gap: 8,
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  friendMessage: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceLow,
  },
  messageBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  myMessageText: {
    color: colors.white,
  },
  messageTime: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.72)",
  },
  noMessages: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  messageComposer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  messageInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  recordsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.56)",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  profileCopy: {
    flex: 1,
    gap: 5,
  },
  profileName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  profilePhone: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  countBadge: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.62)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  countValue: {
    color: colors.primary,
    fontSize: 21,
    fontWeight: "900",
  },
  countLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  recordCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: radii.lg,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.42)",
    gap: 14,
    ...shadows.soft,
  },
  highlightCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  iconBubble: {
    alignItems: "center",
    justifyContent: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
  },
  iconText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
  },
  recordCopy: {
    flex: 1,
    gap: 5,
  },
  recordTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  recordMeta: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  durationBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  duration: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  playHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    padding: 26,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(198,197,207,0.9)",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    textAlign: "center",
  },
});
