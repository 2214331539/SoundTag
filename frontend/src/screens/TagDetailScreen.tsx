import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { lookupTag } from "../services/api";
import { TagState } from "../types";
import { formatDate, formatDuration } from "../utils/format";
import { RootStackParamList } from "../navigation/types";


type Props = NativeStackScreenProps<RootStackParamList, "TagDetail">;


export function TagDetailScreen({ navigation, route }: Props) {
  const { uid } = route.params;
  const isFocused = useIsFocused();
  const soundRef = useRef<Audio.Sound | null>(null);

  const [tagState, setTagState] = useState<TagState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isFocused) {
      void loadTag();
    } else {
      void unloadSound();
    }
  }, [isFocused]);

  useEffect(() => {
    return () => {
      void unloadSound();
    };
  }, []);

  async function unloadSound() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
      setIsPlaying(false);
    }
  }

  async function playFromUrl(file_url: string) {
    try {
      await unloadSound();

      const { sound } = await Audio.Sound.createAsync(
        { uri: file_url },
        { shouldPlay: true },
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }
        setIsPlaying(status.isPlaying);
      });

      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      throw error;
    }
  }

  async function loadTag() {
    try {
      setLoading(true);
      const response = await lookupTag(uid);
      setTagState(response);

      if (response.status === "owned" && response.latest_record?.file_url) {
        await playFromUrl(response.latest_record.file_url);
      } else {
        await unloadSound();
      }
    } catch (error) {
      Alert.alert("加载失败", extractMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function togglePlayback() {
    try {
      const fileUrl = tagState?.latest_record?.file_url;
      if (!fileUrl) {
        return;
      }

      if (!soundRef.current) {
        await playFromUrl(fileUrl);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        await playFromUrl(fileUrl);
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      Alert.alert("播放失败", extractMessage(error));
    }
  }

  const latestRecord = tagState?.latest_record;

  return (
    <ScreenShell
      title="播放标签详情"
      subtitle={`UID: ${uid}`}
      scroll
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadTag()}
          variant="ghost"
          disabled={loading}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>绑定状态</Text>
        <Text style={styles.heroTitle}>
          {loading ? "加载中..." : tagState?.status === "owned" ? "已绑定" : "未绑定"}
        </Text>
        <Text style={styles.heroText}>
          进入该页面后，SoundTag 会自动流式播放最新的云端录音；你也可以暂停、继续或直接重新录音覆盖。
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>当前音频</Text>
        <Text style={styles.infoLine}>
          时长：{latestRecord ? formatDuration(latestRecord.duration_seconds) : "--"}
        </Text>
        <Text style={styles.infoLine}>
          创建时间：{latestRecord ? formatDate(latestRecord.created_at) : "--"}
        </Text>
        <Text style={styles.infoLine}>
          云端地址：{latestRecord?.file_url ?? "--"}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isPlaying ? "暂停播放" : "继续播放"}
          onPress={() => void togglePlayback()}
          disabled={!latestRecord}
        />
        <PrimaryButton
          label="重新录音"
          onPress={() => navigation.navigate("Record", { uid, mode: "overwrite" })}
          variant="ghost"
          disabled={!latestRecord && tagState?.status !== "owned"}
        />
      </View>
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
  heroCard: {
    backgroundColor: "rgba(8, 20, 32, 0.88)",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  heroLabel: {
    color: "#7FB8D5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#F4F7FB",
    fontSize: 30,
    fontWeight: "800",
  },
  heroText: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    marginTop: 18,
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(18, 50, 72, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(127,184,213,0.18)",
    gap: 10,
  },
  infoTitle: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  infoLine: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    marginTop: 18,
    gap: 12,
  },
});
