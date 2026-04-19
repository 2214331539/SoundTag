import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { listTimelineRecords } from "../services/api";
import { TimelineRecord } from "../types";
import { formatDate, formatDuration } from "../utils/format";


export function RecordsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [records, setRecords] = useState<TimelineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFocused) {
      void loadRecords();
    }
  }, [isFocused]);

  async function loadRecords() {
    try {
      setLoading(true);
      const response = await listTimelineRecords();
      setRecords(response);
    } catch (error) {
      Alert.alert("加载失败", extractMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell
      title="我的声音记录"
      subtitle="这里按时间轴展示当前账号绑定过的所有标签与录音。"
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadRecords()}
          variant="ghost"
          disabled={loading}
        />
      }
    >
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("TagDetail", { uid: item.uid })}
            style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.uid}>{item.uid}</Text>
              <Text style={styles.badge}>{item.is_active ? "当前版本" : "历史版本"}</Text>
            </View>
            <Text style={styles.meta}>
              {formatDate(item.created_at)} · {formatDuration(item.duration_seconds)}
            </Text>
            <Text style={styles.url} numberOfLines={2}>
              {item.file_url}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有绑定记录</Text>
            <Text style={styles.emptyText}>先去扫描一个标签并录下一段声音，这里就会开始形成时间轴。</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={() => void loadRecords()}
        showsVerticalScrollIndicator={false}
      />
    </ScreenShell>
  );
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "请确认网络和后端服务正常。";
}


const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(8, 20, 32, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  uid: {
    color: "#F4F7FB",
    fontSize: 18,
    fontWeight: "800",
  },
  badge: {
    color: "#FFB49C",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(255,123,84,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  meta: {
    color: "#7FB8D5",
    fontSize: 13,
    fontWeight: "600",
  },
  url: {
    color: "rgba(244,247,251,0.72)",
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(18, 50, 72, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(127,184,213,0.18)",
    gap: 10,
  },
  emptyTitle: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 22,
  },
});
