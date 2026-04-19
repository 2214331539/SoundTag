import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { useAuth } from "../contexts/AuthContext";
import { lookupTag } from "../services/api";
import { scanTagUid } from "../services/nfc";


export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();

  const [manualUid, setManualUid] = useState("04AABBCCDD66");
  const [lastUid, setLastUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function routeByUid(uid: string) {
    const cleanUid = uid.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (!cleanUid) {
      Alert.alert("UID 无效", "请输入或扫描有效的 NFC 标签 UID。");
      return;
    }

    setBusy(true);
    setLastUid(cleanUid);

    try {
      const tag = await lookupTag(cleanUid);
      if (tag.status === "new") {
        navigation.navigate("Record", {
          uid: cleanUid,
          mode: "create",
        });
        return;
      }

      if (tag.status === "owned") {
        navigation.navigate("TagDetail", {
          uid: cleanUid,
        });
        return;
      }

      Alert.alert("当前账号无权限", "该标签已经被其他账号绑定，MVP 阶段默认不开放跨账号播放。");
    } catch (error) {
      Alert.alert("查询失败", extractMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleScan() {
    try {
      const uid = await scanTagUid();
      await routeByUid(uid);
    } catch (error) {
      Alert.alert("扫描失败", extractMessage(error));
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <ScreenShell
      title="扫描你的随声贴"
      subtitle="识别 NTAG213 标签 UID 后，系统会自动路由到新建录音或播放详情。Expo Go 不支持此 NFC 原生能力，请使用 Dev Client。"
      headerAction={<PrimaryButton label="退出" onPress={handleLogout} variant="ghost" />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>当前账号</Text>
        <Text style={styles.heroTitle}>{user?.display_name || user?.phone}</Text>
        <Text style={styles.heroText}>
          将手机靠近 NFC 贴纸，SoundTag 会读取 UID，并根据后端绑定状态决定下一步动作。
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{lastUid ?? "--"}</Text>
            <Text style={styles.metricLabel}>最近 UID</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>NFC</Text>
            <Text style={styles.metricLabel}>扫描入口</Text>
          </View>
        </View>

        <PrimaryButton label="开始扫描 NFC 标签" loading={busy} onPress={handleScan} />
      </View>

      <View style={styles.devCard}>
        <Text style={styles.devTitle}>开发态手动 UID 路由</Text>
        <Text style={styles.devText}>
          模拟器没有 NFC 时，可以直接输入一个 UID 继续调试录音、上传、绑定和播放链路。
        </Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setManualUid}
          placeholder="04AABBCCDD66"
          placeholderTextColor="rgba(244,247,251,0.35)"
          style={styles.input}
          value={manualUid}
        />
        <PrimaryButton label="按 UID 进入" onPress={() => void routeByUid(manualUid)} variant="ghost" />
      </View>
    </ScreenShell>
  );
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "请确认接口服务已经启动。";
}


const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "rgba(8, 20, 32, 0.88)",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 16,
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
    fontSize: 28,
    fontWeight: "800",
  },
  heroText: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 22,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  metricLabel: {
    color: "rgba(244,247,251,0.54)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  devCard: {
    marginTop: 18,
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(18, 50, 72, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(127,184,213,0.18)",
    gap: 12,
  },
  devTitle: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "800",
  },
  devText: {
    color: "rgba(244,247,251,0.74)",
    fontSize: 14,
    lineHeight: 22,
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
});
