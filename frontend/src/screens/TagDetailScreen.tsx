import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { RootStackParamList } from "../navigation/types";
import { lookupTag } from "../services/api";
import { enablePlaybackMode, playSoundWithFocusRetry } from "../services/audioMode";
import { colors, radii, shadows } from "../theme";
import { TagState } from "../types";
import { formatDate, formatDuration } from "../utils/format";


type Props = NativeStackScreenProps<RootStackParamList, "TagDetail">;


export function TagDetailScreen({ navigation, route }: Props) {
  const { uid } = route.params;
  const isFocused = useIsFocused();
  const soundRef = useRef<Audio.Sound | null>(null);

  const [tagState, setTagState] = useState<TagState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);

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
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
      setIsPlaying(false);
    }
  }

  async function playFromUrl(fileUrl: string) {
    await unloadSound();
    await enablePlaybackMode();

    const { sound, status } = await Audio.Sound.createAsync(
      { uri: fileUrl },
      { shouldPlay: false, progressUpdateIntervalMillis: 300 },
    );

    sound.setOnPlaybackStatusUpdate((nextStatus) => {
      if (!nextStatus.isLoaded) {
        return;
      }

      setIsPlaying(nextStatus.isPlaying);
      setPlaybackPositionMs(nextStatus.positionMillis ?? 0);
      setPlaybackDurationMs(nextStatus.durationMillis ?? 0);

      if (nextStatus.didJustFinish) {
        setIsPlaying(false);
      }
    });

    if (status.isLoaded) {
      setPlaybackPositionMs(status.positionMillis ?? 0);
      setPlaybackDurationMs(status.durationMillis ?? 0);
    }

    soundRef.current = sound;
    await playSoundWithFocusRetry(sound);
    setIsPlaying(true);
  }

  async function loadTag() {
    try {
      setLoading(true);
      const response = await lookupTag(uid);
      setTagState(response);

      if (response.status !== "owned" || !response.latest_record?.file_url) {
        await unloadSound();
        setPlaybackPositionMs(0);
        setPlaybackDurationMs(0);
        return;
      }

      try {
        await playFromUrl(response.latest_record.file_url);
      } catch (error) {
        Alert.alert("播放失败", extractMessage(error));
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

      const duration = status.durationMillis ?? 0;
      const reachedEnd = duration > 0 && (status.positionMillis ?? 0) >= duration - 250;

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else if (reachedEnd) {
        await playSoundWithFocusRetry(soundRef.current, true);
        setIsPlaying(true);
      } else {
        await playSoundWithFocusRetry(soundRef.current);
        setIsPlaying(true);
      }
    } catch (error) {
      Alert.alert("播放失败", extractMessage(error));
    }
  }

  async function seekBy(deltaMs: number) {
    try {
      const sound = soundRef.current;
      if (!sound) {
        return;
      }

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        return;
      }

      const duration = status.durationMillis ?? playbackDurationMs;
      const nextPosition = Math.max(0, Math.min((status.positionMillis ?? 0) + deltaMs, duration));
      await sound.setPositionAsync(nextPosition);
      setPlaybackPositionMs(nextPosition);
    } catch (error) {
      Alert.alert("调整进度失败", extractMessage(error));
    }
  }

  const latestRecord = tagState?.latest_record;
  const title = latestRecord?.title?.trim() || "未命名声音";
  const fallbackDurationMs = latestRecord ? latestRecord.duration_seconds * 1000 : 0;
  const totalMs = playbackDurationMs || fallbackDurationMs;
  const progress = totalMs > 0 ? Math.min(playbackPositionMs / totalMs, 1) : 0;

  return (
    <ScreenShell
      title="播放声音"
      showPageHeader={false}
      scroll
      headerLeading={
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      }
      headerAction={
        <PrimaryButton
          label="刷新"
          onPress={() => void loadTag()}
          variant="ghost"
          size="sm"
          disabled={loading}
        />
      }
    >
      <View style={styles.artwork}>
        {latestRecord?.image_url ? (
          <Image source={{ uri: latestRecord.image_url }} style={styles.coverImage} />
        ) : (
          <LinearGradient colors={["#184E4B", "#17413F", "#E7E5B6"]} style={styles.defaultArtwork}>
            <View style={styles.windowShape}>
              <View style={styles.windowPane} />
              <View style={styles.windowPane} />
            </View>
            <View style={styles.defaultArtworkCopy}>
              <WaveGlyph color="rgba(255,255,255,0.66)" accentColor={colors.accent} height={74} />
              <Text style={styles.defaultArtworkHint}>可在录音时插入图片</Text>
            </View>
          </LinearGradient>
        )}
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>已绑定声音</Text>
        </View>
        <Text style={styles.title}>{loading ? "加载中..." : title}</Text>
        <Text style={styles.date}>
          {latestRecord ? `录制于 ${formatDate(latestRecord.created_at)}` : "这张标签还没有可播放的声音"}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatDuration(Math.floor(playbackPositionMs / 1000))}</Text>
        <Text style={styles.timeText}>{formatDuration(Math.floor(totalMs / 1000))}</Text>
      </View>

      <View style={styles.playControls}>
        <Pressable onPress={() => void seekBy(-10000)} disabled={!latestRecord} style={styles.skipButton}>
          <Text style={styles.skipText}>-10s</Text>
        </Pressable>
        <Pressable
          disabled={!latestRecord}
          onPress={() => void togglePlayback()}
          style={({ pressed }) => [
            styles.playButton,
            !latestRecord ? styles.disabledButton : null,
            pressed && latestRecord ? styles.pressed : null,
          ]}
        >
          <Text style={styles.playText}>{isPlaying ? "暂停" : "播放"}</Text>
        </Pressable>
        <Pressable onPress={() => void seekBy(10000)} disabled={!latestRecord} style={styles.skipButton}>
          <Text style={styles.skipText}>+10s</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="重新录制"
          onPress={() => navigation.navigate("Record", { uid, mode: "overwrite" })}
          variant="ghost"
          disabled={!latestRecord && tagState?.status !== "owned"}
          style={styles.actionButton}
        />
        <PrimaryButton
          label="查看我的声音"
          onPress={() => navigation.navigate("MainTabs", { screen: "Records" })}
          variant="secondary"
          style={styles.actionButton}
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
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: radii.full,
  },
  backText: {
    color: colors.primary,
    fontSize: 38,
    fontWeight: "400",
    lineHeight: 40,
  },
  artwork: {
    height: 372,
    borderRadius: radii.xl,
    marginTop: 24,
    overflow: "hidden",
    backgroundColor: colors.surfaceMid,
    ...shadows.ambient,
  },
  defaultArtwork: {
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: "100%",
    paddingVertical: 48,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  defaultArtworkCopy: {
    alignItems: "center",
    gap: 16,
  },
  defaultArtworkHint: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 15,
    fontWeight: "900",
  },
  windowShape: {
    flexDirection: "row",
    width: 126,
    height: 92,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    padding: 8,
    gap: 8,
  },
  windowPane: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "rgba(204,211,255,0.45)",
  },
  titleBlock: {
    alignItems: "center",
    paddingTop: 38,
    paddingBottom: 30,
  },
  categoryChip: {
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 14,
  },
  categoryText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  date: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
    marginTop: 12,
    textAlign: "center",
  },
  progressTrack: {
    height: 14,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  playControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginTop: 42,
  },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "900",
  },
  playButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  playText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.48,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 48,
    marginBottom: 22,
  },
  actionButton: {
    flex: 1,
  },
});
