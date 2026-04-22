import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { RootStackParamList } from "../navigation/types";
import { bindTag, requestUploadCredential } from "../services/api";
import { uploadAudioToOss } from "../services/audioUpload";
import { formatDuration } from "../utils/format";


type Props = NativeStackScreenProps<RootStackParamList, "Record">;


export function RecordScreen({ navigation, route }: Props) {
  const { uid, mode } = route.params;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

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
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

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
        Alert.alert("权限不足", "请先授予麦克风权限。");
        return;
      }

      await unloadPreviewSound();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

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
        throw new Error("录音文件路径为空。");
      }

      const nextDurationMs = status.durationMillis ?? durationMs;
      setDurationMs(nextDurationMs);
      setRecordedUri(uri);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
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
  }

  async function saveRecording() {
    if (!recordedUri) {
      Alert.alert("还没有录音", "请先录制一段音频。");
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

  const previewLabel = previewPlaying ? "暂停试听" : "播放试听";
  const previewTotalMs = previewDurationMs || durationMs;
  const statusText = recording
    ? "正在录音，请完成后停止。"
    : recordedUri
      ? "录制完成，可先试听再上传。"
      : "等待开始录音。";

  return (
    <ScreenShell
      title={mode === "overwrite" ? "重新录音覆盖标签" : "创建新的声音标签"}
      subtitle={`UID: ${uid}`}
      scroll
    >
      <View style={styles.panel}>
        <Text style={styles.durationLabel}>当前录音时长</Text>
        <Text style={styles.durationValue}>{formatDuration(Math.floor(durationMs / 1000))}</Text>
        <Text style={styles.statusText}>{statusText}</Text>
        <Text style={styles.description}>
          停止录音后，先在本地试听结果；确认没有问题，再上传并绑定到当前标签。
        </Text>
      </View>

      <View style={styles.controlPanel}>
        <PrimaryButton
          label={recording ? "录音中..." : "开始录音"}
          onPress={() => void startRecording()}
          disabled={Boolean(recording)}
        />
        <PrimaryButton
          label="停止录音"
          onPress={() => void stopRecording()}
          disabled={!recording}
          variant="ghost"
        />
        <PrimaryButton
          label="重录"
          onPress={() => void resetRecording()}
          disabled={Boolean(recording) || !recordedUri}
          variant="ghost"
        />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>录音摘要</Text>
        <Text style={styles.summaryLine}>
          状态：{recordedUri ? "已完成录音，可试听和上传" : "等待录音"}
        </Text>
        <Text style={styles.summaryLine}>
          模式：{mode === "overwrite" ? "覆盖已有录音" : "首次绑定标签"}
        </Text>
        <Text style={styles.summaryLine}>文件：{recordedUri ?? "--"}</Text>
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>录音预览</Text>
        <Text style={styles.previewLine}>
          试听进度：{formatDuration(Math.floor(previewPositionMs / 1000))} /{" "}
          {formatDuration(Math.floor(previewTotalMs / 1000))}
        </Text>
        <Text style={styles.previewLine}>
          试听状态：
          {!recordedUri
            ? "等待录音"
            : previewPlaying
              ? "正在试听"
              : previewReady
                ? "已加载，可播放"
                : "正在加载本地录音"}
        </Text>
        <PrimaryButton
          label={previewLabel}
          onPress={() => void togglePreviewPlayback()}
          disabled={!recordedUri || Boolean(recording) || !previewReady}
          variant="ghost"
        />
      </View>

      <PrimaryButton
        label={mode === "overwrite" ? "确认上传并覆盖标签" : "确认上传并绑定标签"}
        loading={saving}
        onPress={() => void saveRecording()}
        disabled={!recordedUri || Boolean(recording)}
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
  panel: {
    alignItems: "center",
    backgroundColor: "rgba(8,20,32,0.88)",
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  durationLabel: {
    color: "#7FB8D5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  durationValue: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statusText: {
    color: "#FFB49C",
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    color: "rgba(244,247,251,0.74)",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  controlPanel: {
    marginTop: 18,
    gap: 12,
  },
  summaryCard: {
    marginTop: 18,
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(18, 50, 72, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(127,184,213,0.18)",
    gap: 12,
  },
  summaryTitle: {
    color: "#F4F7FB",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryLine: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 20,
  },
  previewCard: {
    marginTop: 18,
    marginBottom: 18,
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(10, 22, 34, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  previewTitle: {
    color: "#F4F7FB",
    fontSize: 18,
    fontWeight: "800",
  },
  previewLine: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 20,
  },
});
