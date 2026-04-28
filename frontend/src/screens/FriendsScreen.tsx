import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { addFriend, listFriends, searchFriend } from "../services/api";
import { colors, radii, shadows } from "../theme";
import { Friend, FriendSearchResponse } from "../types";
import { formatDate } from "../utils/format";


export function FriendsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [phone, setPhone] = useState("");
  const [searchResult, setSearchResult] = useState<FriendSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isFocused) {
      void loadFriends();
    }
  }, [isFocused]);

  async function loadFriends() {
    try {
      setLoading(true);
      const response = await listFriends();
      setFriends(response);
    } catch (error) {
      Alert.alert("加载好友失败", extractMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const withoutCountryCode = digits.startsWith("86") && digits.length > 11 ? digits.slice(2) : digits;
    setPhone(withoutCountryCode.slice(0, 11));
    setSearchResult(null);
  }

  function getNormalizedPhone() {
    if (!/^1\d{10}$/.test(phone)) {
      Alert.alert("手机号格式不正确", "请输入 11 位中国大陆手机号。");
      return null;
    }

    return `+86${phone}`;
  }

  async function handleSearch() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    try {
      setSearching(true);
      const response = await searchFriend(normalizedPhone);
      setSearchResult(response);
    } catch (error) {
      setSearchResult(null);
      Alert.alert("搜索失败", extractMessage(error));
    } finally {
      setSearching(false);
    }
  }

  async function handleAddFriend() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    try {
      setAdding(true);
      const friend = await addFriend(normalizedPhone);
      setFriends((current) => {
        if (current.some((item) => item.id === friend.id)) {
          return current;
        }

        return [friend, ...current];
      });
      setSearchResult({ user: friend, is_friend: true });
      Alert.alert("添加成功", "你们现在可以互相访问主页音频。");
    } catch (error) {
      Alert.alert("添加失败", extractMessage(error));
    } finally {
      setAdding(false);
    }
  }

  function openProfile(friend: Friend) {
    navigation.navigate("FriendProfile", {
      friendId: friend.id,
      displayName: friend.display_name,
    });
  }

  const canSearch = /^1\d{10}$/.test(phone) && !searching && !adding;

  return (
    <ScreenShell
      title="好友"
      subtitle="通过手机号添加好友。添加后双方都可以访问对方主页，并查看主页里保存的音频。"
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadFriends()}
          variant="ghost"
          size="sm"
          disabled={loading}
        />
      }
    >
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={friends}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.searchCard}>
            <Text style={styles.sectionTitle}>添加好友</Text>
            <View style={styles.phoneField}>
              <Text style={styles.countryCode}>+86</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={11}
                onChangeText={handlePhoneChange}
                placeholder="输入好友手机号"
                placeholderTextColor={colors.textSoft}
                style={styles.phoneInput}
                value={phone}
              />
              {phone ? (
                <Pressable hitSlop={10} onPress={() => handlePhoneChange("")}>
                  <Text style={styles.clearText}>清空</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.searchActions}>
              <PrimaryButton
                label="搜索"
                onPress={() => void handleSearch()}
                variant="ghost"
                loading={searching}
                disabled={!canSearch}
                style={styles.searchButton}
              />
              <PrimaryButton
                label={searchResult?.is_friend ? "已是好友" : "添加好友"}
                onPress={() => void handleAddFriend()}
                loading={adding}
                disabled={!searchResult || searchResult.is_friend}
                style={styles.searchButton}
              />
            </View>

            {searchResult ? (
              <View style={styles.resultCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitial(searchResult.user.display_name)}</Text>
                </View>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultName}>{searchResult.user.display_name || "SoundTag 用户"}</Text>
                  <Text style={styles.resultMeta}>{searchResult.user.phone}</Text>
                </View>
                <Text style={styles.resultState}>{searchResult.is_friend ? "已添加" : "可添加"}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openProfile(item)}
            style={({ pressed }) => [styles.friendCard, pressed ? styles.pressed : null]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(item.display_name)}</Text>
            </View>
            <View style={styles.friendCopy}>
              <Text style={styles.friendName}>{item.display_name || "SoundTag 用户"}</Text>
              <Text style={styles.friendMeta}>{item.phone}</Text>
              <Text style={styles.friendSince}>添加于 {formatDate(item.friendship_created_at)}</Text>
            </View>
            <Text style={styles.openHint}>主页</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有好友</Text>
            <Text style={styles.emptyText}>输入对方注册手机号，添加后即可看到对方分享的音频。</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={() => void loadFriends()}
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
  searchCard: {
    borderRadius: radii.xl,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.46)",
    gap: 14,
    ...shadows.soft,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  phoneField: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 58,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 16,
  },
  countryCode: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    minHeight: 54,
  },
  clearText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  searchActions: {
    flexDirection: "row",
    gap: 10,
  },
  searchButton: {
    flex: 1,
  },
  resultCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: radii.lg,
    backgroundColor: "rgba(204,211,255,0.38)",
    padding: 12,
    gap: 12,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.56)",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  resultCopy: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  resultState: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  friendCard: {
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
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  friendCopy: {
    flex: 1,
    gap: 4,
  },
  friendName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  friendMeta: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  friendSince: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  openHint: {
    color: colors.primary,
    fontSize: 13,
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
