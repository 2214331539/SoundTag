import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { bindTag, requestUploadCredential } from "../services/api";
import { uploadAudioToOss } from "../services/audioUpload";
import { formatDuration } from "../utils/format";
import { RootStackParamList } from "../navigation/types";


type Props = NativeStackScreenProps<RootStackParamList, "Record">;


export function RecordScreen({ navigation, route }: Props) {
  const { uid, mode } = route.params;

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recording) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (status.isLoaded) {
          setDurationMs(status.durationMillis ?? 0);
        }
      } catch {
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("权限不足", "请先授予麦克风权限。");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();

      setDurationMs(0);
      setRecordedUri(null);
      setRecording(nextRecording);
    } catch (error) {
      Alert.alert("录音启动失败", extractMessage(error));
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error("录音文件路径为空。");
      }

      if (status.isLoaded) {
        setDurationMs(status.durationMillis ?? durationMs);
      }

      setRecordedUri(uri);
      setRecording(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      Alert.alert("停止录音失败", extractMessage(error));
    }
  }

  function resetRecording() {
    setRecording(null);
    setRecordedUri(null);
    setDurationMs(0);
  }

  async function saveRecording() {
    if (!recordedUri) {
      Alert.alert("还没有录音", "请先录制一段音频。");
      return;
    }

    try {
      setSaving(true);
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
        duration_seconds: Math.max(1, Math.round(durationMs / 1000)),
        file_size: upload.file_size,
      });

      navigation.replace("TagDetail", { uid });
    } catch (error) {
      Alert.alert("保存失败", extractMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenShell
      title={mode === "overwrite" ? "重新录音覆盖标签" : "创建新的声音标签"}
      subtitle={`UID: ${uid}`}
      scroll
    >
      <View style={styles.panel}>
        <Text style={styles.durationLabel}>当前录音时长</Text>
        <Text style={styles.durationValue}>{formatDuration(Math.floor(durationMs / 1000))}</Text>
        <Text style={styles.description}>
          录音结束后，客户端会先向后端申请 OSS 临时凭证，再直接把音频上传到对象存储，最后写入标签绑定关系。
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
          onPress={resetRecording}
          disabled={Boolean(recording) || !recordedUri}
          variant="ghost"
        />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>录音摘要</Text>
        <Text style={styles.summaryLine}>状态：{recordedUri ? "已完成录音，可上传保存" : "等待录音"}</Text>
        <Text style={styles.summaryLine}>模式：{mode === "overwrite" ? "覆写旧录音" : "首次绑定标签"}</Text>
        <Text style={styles.summaryLine}>文件：{recordedUri ?? "--"}</Text>
      </View>

      <PrimaryButton
        label={mode === "overwrite" ? "上传并覆写标签" : "上传并绑定标签"}
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
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
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
    marginBottom: 18,
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
});
