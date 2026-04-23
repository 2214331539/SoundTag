import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { RootStackParamList } from "../navigation/types";
import { bindTag, requestUploadCredential } from "../services/api";
import { enablePlaybackMode, enableRecordingMode } from "../services/audioMode";
import { uploadAudioToOss } from "../services/audioUpload";
import { colors, radii, shadows } from "../theme";
import { formatDuration } from "../utils/format";


type Props = NativeStackScreenProps<RootStackParamList, "Record">;


export function RecordScreen({ navigation, route }: Props) {
  const { uid, mode } = route.params;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const [recordingTitle, setRecordingTitle] = useState("我的声音");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewPositionMs, setPreviewPositionMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      const previewSound = previewSoundRef.current;

      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => undefined);
      }

      if (previewSound) {
        previewSound.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  function resetPreviewState() {
    setPreviewReady(false);
    setPreviewPlaying(false);
    setPreviewPositionMs(0);
    setPreviewDurationMs(0);
  }

  async function unloadPreviewSound() {
    const previewSound = previewSoundRef.current;
    previewSoundRef.current = null;
    resetPreviewState();

    if (!previewSound) {
      return;
    }

    previewSound.setOnPlaybackStatusUpdate(null);
    await previewSound.unloadAsync().catch(() => undefined);
  }

  function handlePreviewStatusUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      setPreviewPlaying(false);
      return;
    }

    setPreviewReady(true);
    setPreviewPlaying(status.isPlaying);
    setPreviewPositionMs(status.positionMillis ?? 0);
    setPreviewDurationMs(status.durationMillis ?? 0);

    if (status.didJustFinish) {
      setPreviewPlaying(false);
      setPreviewPositionMs(status.durationMillis ?? 0);
    }
  }

  async function preparePreview(uri: string) {
    await unloadPreviewSound();
    await enablePlaybackMode();

    const { sound, status } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, progressUpdateIntervalMillis: 250 },
    );

    sound.setOnPlaybackStatusUpdate(handlePreviewStatusUpdate);
    previewSoundRef.current = sound;

    if (status.isLoaded) {
      setPreviewReady(true);
      setPreviewPositionMs(status.positionMillis ?? 0);
      setPreviewDurationMs(status.durationMillis ?? 0);
    }
  }

  async function startRecording() {
    if (recordingRef.current) {
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("需要麦克风权限", "请先允许 SoundTag 使用麦克风。");
        return;
      }

      await unloadPreviewSound();
      await enableRecordingMode();

      const nextRecording = new Audio.Recording();
      nextRecording.setProgressUpdateInterval(250);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        setDurationMs(status.durationMillis ?? 0);
      });

      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();

      recordingRef.current = nextRecording;
      setRecording(nextRecording);
      setRecordedUri(null);
      setDurationMs(0);
    } catch (error) {
      Alert.alert("录音启动失败", extractMessage(error));
    }
  }

  async function stopRecording() {
    const activeRecording = recordingRef.current;
    if (!activeRecording) {
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync();
      const status = await activeRecording.getStatusAsync();
      const uri = activeRecording.getURI();

      if (!uri) {
        throw new Error("没有找到录音文件，请重录一次。");
      }

      const nextDurationMs = status.durationMillis ?? durationMs;
      setDurationMs(nextDurationMs);
      setRecordedUri(uri);

      await enablePlaybackMode();
      await preparePreview(uri);
    } catch (error) {
      Alert.alert("停止录音失败", extractMessage(error));
    } finally {
      activeRecording.setOnRecordingStatusUpdate(null);
      recordingRef.current = null;
      setRecording(null);
    }
  }

  async function resetRecording() {
    await unloadPreviewSound();
    setRecordedUri(null);
    setDurationMs(0);
  }

  async function togglePreviewPlayback() {
    if (!recordedUri) {
      return;
    }

    try {
      let previewSound = previewSoundRef.current;
      if (!previewSound) {
        await preparePreview(recordedUri);
        previewSound = previewSoundRef.current;
      }

      if (!previewSound) {
        return;
      }

      const status = await previewSound.getStatusAsync();
      if (!status.isLoaded) {
        await preparePreview(recordedUri);
        return;
      }

      if (status.isPlaying) {
        await previewSound.pauseAsync();
        setPreviewPlaying(false);
        return;
      }

      const hasDuration = (status.durationMillis ?? 0) > 0;
      const reachedEnd =
        hasDuration && (status.positionMillis ?? 0) >= (status.durationMillis ?? 0) - 250;

      if (reachedEnd) {
        await previewSound.replayAsync();
      } else {
        await previewSound.playAsync();
      }

      setPreviewPlaying(true);
    } catch (error) {
      Alert.alert("试听失败", extractMessage(error));
    }
  }

  async function saveRecording() {
    if (!recordedUri) {
      Alert.alert("还没有录音", "请先录制一段声音。");
      return;
    }

    const title = recordingTitle.trim();
    if (!title) {
      Alert.alert("请填写名称", "给这段声音取一个容易识别的名字。");
      return;
    }

    try {
      setSaving(true);

      if (previewSoundRef.current) {
        await previewSoundRef.current.pauseAsync().catch(() => undefined);
      }

      const { extension, mime_type } = inferAudioMetadata(recordedUri);
      const credential = await requestUploadCredential({
        uid,
        file_extension: extension,
        mime_type,
      });

      const upload = await uploadAudioToOss({
        credential,
        file_uri: recordedUri,
      });

      await bindTag(uid, {
        title,
        object_key: upload.object_key,
        file_url: upload.file_url,
        mime_type,
        duration_seconds: Math.max(1, Math.round((previewDurationMs || durationMs) / 1000)),
        file_size: upload.file_size,
      });

      navigation.replace("TagDetail", { uid });
    } catch (error) {
      Alert.alert("保存失败", extractMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const previewTotalMs = previewDurationMs || durationMs;
  const progress = previewTotalMs > 0 ? Math.min(previewPositionMs / previewTotalMs, 1) : 0;
  const timerSeconds = Math.floor((recording ? durationMs : previewTotalMs || durationMs) / 1000);
  const statusText = recording ? "录音中..." : recordedUri ? "已录制，可试听" : "准备录音";
  const centerLabel = recording ? "停止" : recordedUri ? (previewPlaying ? "暂停" : "试听") : "录音";

  return (
    <ScreenShell
      title={mode === "overwrite" ? "重新录制声音" : "录制新的声音"}
      scroll
      showBrandHeader={false}
      showPageHeader={false}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeText}>x</Text>
        </Pressable>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{statusText}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.timerWrap}>
        <View style={styles.timerOuter} />
        <View style={styles.timerMiddle} />
        <View style={styles.timerCore}>
          <Text style={styles.timerText}>{formatDuration(timerSeconds)}</Text>
        </View>
      </View>

      <View style={styles.nameField}>
        <Text style={styles.nameIcon}>edit</Text>
        <TextInput
          maxLength={100}
          onChangeText={setRecordingTitle}
          placeholder="例如：生日祝福、钥匙提示、旅行留言"
          placeholderTextColor={colors.textSoft}
          style={styles.nameInput}
          value={recordingTitle}
        />
      </View>

      <WaveGlyph
        active={Boolean(recording || previewPlaying)}
        height={104}
        style={styles.wave}
      />

      <View style={styles.controls}>
        <Pressable
          disabled={Boolean(recording) || !recordedUri}
          onPress={() => void resetRecording()}
          style={({ pressed }) => [
            styles.sideControl,
            (!recordedUri || recording) ? styles.disabledControl : null,
            pressed && recordedUri && !recording ? styles.controlPressed : null,
          ]}
        >
          <Text style={styles.sideControlText}>重录</Text>
        </Pressable>

        <Pressable
          disabled={saving}
          onPress={() => {
            if (recording) {
              void stopRecording();
              return;
            }
            if (recordedUri) {
              void togglePreviewPlayback();
              return;
            }
            void startRecording();
          }}
          style={({ pressed }) => [styles.centerControl, pressed ? styles.controlPressed : null]}
        >
          <Text style={styles.centerControlText}>{centerLabel}</Text>
        </Pressable>

        <Pressable
          disabled={!recording}
          onPress={() => void stopRecording()}
          style={({ pressed }) => [
            styles.sideControl,
            styles.stopControl,
            !recording ? styles.disabledControl : null,
            pressed && recording ? styles.controlPressed : null,
          ]}
        >
          <Text style={styles.sideControlText}>停止</Text>
        </Pressable>
      </View>

      {recordedUri ? (
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>录音预览</Text>
            <Text style={styles.previewTime}>
              {formatDuration(Math.floor(previewPositionMs / 1000))} /{" "}
              {formatDuration(Math.floor(previewTotalMs / 1000))}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.previewHint}>确认内容没问题后，再上传并绑定到这张标签。</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={mode === "overwrite" ? "确认上传并替换原声音" : "确认上传并绑定标签"}
        loading={saving}
        onPress={() => void saveRecording()}
        disabled={!recordedUri || Boolean(recording)}
        size="lg"
        style={styles.saveButton}
      />
    </ScreenShell>
  );
}


function inferAudioMetadata(uri: string) {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  const extension = match?.[1]?.toLowerCase() ?? "m4a";

  if (extension === "caf") {
    return {
      extension,
      mime_type: "audio/x-caf",
    };
  }

  if (extension === "3gp") {
    return {
      extension,
      mime_type: "audio/3gpp",
    };
  }

  return {
    extension,
    mime_type: "audio/mp4",
  };
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

  return "请检查存储配置和网络。";
}


const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    marginBottom: 28,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: "rgba(240,237,240,0.86)",
    ...shadows.soft,
  },
  closeText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 26,
  },
  statusChip: {
    borderRadius: radii.full,
    backgroundColor: "rgba(240,237,240,0.92)",
    paddingHorizontal: 22,
    paddingVertical: 10,
    ...shadows.soft,
  },
  statusChipText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 48,
  },
  timerWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 320,
    marginTop: 2,
  },
  timerOuter: {
    position: "absolute",
    width: 292,
    height: 292,
    borderRadius: 146,
    borderWidth: 1,
    borderColor: "rgba(204,211,255,0.38)",
  },
  timerMiddle: {
    position: "absolute",
    width: 246,
    height: 246,
    borderRadius: 123,
    backgroundColor: "rgba(240,237,240,0.46)",
    borderWidth: 3,
    borderColor: "rgba(204,211,255,0.52)",
  },
  timerCore: {
    alignItems: "center",
    justifyContent: "center",
    width: 206,
    height: 206,
    borderRadius: 103,
    backgroundColor: "rgba(251,248,252,0.82)",
    ...shadows.soft,
  },
  timerText: {
    color: colors.primary,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -1,
  },
  nameField: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 72,
    borderRadius: radii.lg,
    backgroundColor: "rgba(240,237,240,0.9)",
    paddingHorizontal: 20,
    gap: 14,
    ...shadows.soft,
  },
  nameIcon: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  nameInput: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    minHeight: 56,
    textAlign: "center",
  },
  wave: {
    marginTop: 52,
    marginBottom: 46,
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
  },
  sideControl: {
    alignItems: "center",
    justifyContent: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(240,237,240,0.9)",
    ...shadows.soft,
  },
  stopControl: {
    backgroundColor: "rgba(204,211,255,0.78)",
  },
  sideControlText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
  },
  centerControl: {
    alignItems: "center",
    justifyContent: "center",
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  centerControlText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
  },
  disabledControl: {
    opacity: 0.42,
  },
  controlPressed: {
    transform: [{ scale: 0.96 }],
  },
  previewCard: {
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.42)",
    padding: 18,
    marginTop: 36,
    ...shadows.soft,
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  previewTime: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  progressTrack: {
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 14,
  },
  saveButton: {
    marginTop: 22,
    marginBottom: 18,
  },
});
