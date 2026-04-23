import { useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { deleteTimelineRecord, listTimelineRecords, renameTimelineRecord } from "../services/api";
import { TimelineRecord } from "../types";
import { formatDate, formatDuration } from "../utils/format";


export function RecordsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [records, setRecords] = useState<TimelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingRecord, setRenamingRecord] = useState<TimelineRecord | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function openRename(record: TimelineRecord) {
    setRenamingRecord(record);
    setRenameTitle(record.title?.trim() || "");
  }

  function closeRename() {
    if (renaming) {
      return;
    }

    setRenamingRecord(null);
    setRenameTitle("");
  }

  async function submitRename() {
    if (!renamingRecord) {
      return;
    }

    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      Alert.alert("请填写名称", "声音名称不能为空。");
      return;
    }

    try {
      setRenaming(true);
      const updated = await renameTimelineRecord(renamingRecord.id, nextTitle);
      setRecords((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRenamingRecord(null);
      setRenameTitle("");
    } catch (error) {
      Alert.alert("重命名失败", extractMessage(error));
    } finally {
      setRenaming(false);
    }
  }

  function confirmDelete(record: TimelineRecord) {
    Alert.alert(
      "删除这段声音？",
      "删除后，这张标签会变为空标签。下次靠近它时，可以重新录制新的声音。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => void deleteRecord(record),
        },
      ],
    );
  }

  async function deleteRecord(record: TimelineRecord) {
    try {
      setDeletingId(record.id);
      await deleteTimelineRecord(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
    } catch (error) {
      Alert.alert("删除失败", extractMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ScreenShell
      title="我的声音"
      subtitle="这里仅展示每张标签当前保存的声音。你可以重命名、删除，或进入详情播放和重录。"
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
          <View style={styles.card}>
            <Pressable
              onPress={() => navigation.navigate("TagDetail", { uid: item.uid })}
              style={({ pressed }) => [styles.cardMain, pressed ? styles.cardPressed : null]}
            >
              <Text style={styles.title}>{item.title?.trim() || "未命名声音"}</Text>
              <Text style={styles.meta}>
                {formatDate(item.created_at)} · {formatDuration(item.duration_seconds)}
              </Text>
              <Text style={styles.hint}>点击卡片播放，或使用下方操作管理这段声音。</Text>
            </Pressable>
            <View style={styles.actions}>
              <PrimaryButton
                label="重命名"
                onPress={() => openRename(item)}
                variant="ghost"
                disabled={deletingId === item.id}
              />
              <PrimaryButton
                label="删除"
                onPress={() => confirmDelete(item)}
                variant="ghost"
                loading={deletingId === item.id}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有声音</Text>
            <Text style={styles.emptyText}>先靠近一张 NFC 标签并录制一段声音，保存后就会出现在这里。</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={() => void loadRecords()}
        showsVerticalScrollIndicator={false}
      />

      <Modal transparent visible={Boolean(renamingRecord)} animationType="fade" onRequestClose={closeRename}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>重命名声音</Text>
            <Text style={styles.modalText}>给这段声音取一个更容易识别的名字。</Text>
            <TextInput
              autoFocus
              maxLength={100}
              onChangeText={setRenameTitle}
              placeholder="输入新的声音名称"
              placeholderTextColor="rgba(244,247,251,0.35)"
              style={styles.input}
              value={renameTitle}
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="取消" onPress={closeRename} variant="ghost" disabled={renaming} />
              <PrimaryButton label="保存名称" onPress={() => void submitRename()} loading={renaming} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
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

    if ("message" in axiosError) {
      return String(axiosError.message);
    }
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
    gap: 16,
  },
  cardMain: {
    gap: 12,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  title: {
    color: "#F4F7FB",
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: "#7FB8D5",
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    color: "rgba(244,247,251,0.72)",
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.64)",
    padding: 20,
  },
  modalCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#0c1a27",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 14,
  },
  modalTitle: {
    color: "#F4F7FB",
    fontSize: 22,
    fontWeight: "800",
  },
  modalText: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#F4F7FB",
    paddingHorizontal: 16,
    fontSize: 16,
  },
  modalActions: {
    gap: 10,
  },
});
