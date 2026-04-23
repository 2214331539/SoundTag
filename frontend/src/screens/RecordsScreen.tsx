import { useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { deleteTimelineRecord, listTimelineRecords, renameTimelineRecord } from "../services/api";
import { colors, radii, shadows } from "../theme";
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
      subtitle="每张标签只展示当前生效的一段声音，可重命名、删除、播放或重录。"
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadRecords()}
          variant="ghost"
          size="sm"
          disabled={loading}
        />
      }
    >
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={[styles.card, index === 0 ? styles.highlightCard : null]}>
            <Pressable
              onPress={() => navigation.navigate("TagDetail", { uid: item.uid })}
              style={({ pressed }) => [styles.cardMain, pressed ? styles.cardPressed : null]}
            >
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>♪</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.title}>{item.title?.trim() || "未命名声音"}</Text>
                <Text style={styles.meta}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={styles.durationBlock}>
                <Text style={styles.duration}>{formatDuration(item.duration_seconds)}</Text>
                <Text style={styles.playHint}>播放</Text>
              </View>
            </Pressable>

            <View style={styles.actions}>
              <PrimaryButton
                label="重命名"
                onPress={() => openRename(item)}
                variant="ghost"
                size="sm"
                disabled={deletingId === item.id}
                style={styles.actionButton}
              />
              <PrimaryButton
                label="删除"
                onPress={() => confirmDelete(item)}
                variant="danger"
                size="sm"
                loading={deletingId === item.id}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <WaveGlyph height={54} color={colors.textSoft} accentColor={colors.textSoft} />
            </View>
            <Text style={styles.emptyTitle}>你还没有标记任何东西</Text>
            <Text style={styles.emptyText}>先扫描一张 NFC 标签并录制声音，保存后就会出现在这里。</Text>
            <PrimaryButton
              label="开始扫描"
              onPress={() => navigation.navigate("Home")}
              style={styles.emptyButton}
            />
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
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              value={renameTitle}
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label="取消"
                onPress={closeRename}
                variant="ghost"
                disabled={renaming}
                style={styles.modalButton}
              />
              <PrimaryButton
                label="保存名称"
                onPress={() => void submitRename()}
                loading={renaming}
                style={styles.modalButton}
              />
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
    gap: 16,
    paddingBottom: 116,
  },
  card: {
    borderRadius: radii.lg,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.42)",
    gap: 14,
    ...shadows.soft,
  },
  highlightCard: {
    backgroundColor: "rgba(204,211,255,0.68)",
    borderColor: "rgba(204,211,255,0.72)",
  },
  cardMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  iconBubble: {
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface,
  },
  iconText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
  },
  cardCopy: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  meta: {
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
    fontSize: 17,
    fontWeight: "800",
  },
  playHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    padding: 28,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(198,197,207,0.9)",
    marginTop: 8,
  },
  emptyIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceMid,
    marginBottom: 22,
    ...shadows.soft,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 10,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 22,
    minWidth: 180,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(27,27,30,0.35)",
    padding: 20,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.62)",
    gap: 14,
    ...shadows.ambient,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  modalText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },
  input: {
    minHeight: 58,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    paddingHorizontal: 20,
    fontSize: 17,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});
