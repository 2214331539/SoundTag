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
  const [lastAction, setLastAction] = useState("等待识别");
  const [busy, setBusy] = useState(false);

  async function routeByUid(uid: string) {
    const cleanUid = uid.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (!cleanUid) {
      Alert.alert("没有识别到标签", "请重新靠近 NFC 标签，或检查输入的调试标签码。");
      return;
    }

    setBusy(true);
    setLastAction("正在识别标签...");

    try {
      const tag = await lookupTag(cleanUid);
      if (tag.status === "new") {
        setLastAction("新标签，进入录音");
        navigation.navigate("Record", {
          uid: cleanUid,
          mode: "create",
        });
        return;
      }

      if (tag.status === "owned") {
        setLastAction("已有声音，进入播放");
        navigation.navigate("TagDetail", {
          uid: cleanUid,
        });
        return;
      }

      setLastAction("标签不可用");
      Alert.alert("无法使用这张标签", "这张标签已绑定到其他账号，当前账号不能播放或覆盖。");
    } catch (error) {
      setLastAction("识别失败");
      Alert.alert("识别失败", extractMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleScan() {
    try {
      setBusy(true);
      setLastAction("请将手机靠近 NFC 标签");
      const uid = await scanTagUid();
      await routeByUid(uid);
    } catch (error) {
      setLastAction("扫描失败");
      Alert.alert("扫描失败", extractMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <ScreenShell
      title="靠近标签"
      subtitle="新标签会直接进入录音；已经有声音的标签会直接播放。"
      headerAction={<PrimaryButton label="退出" onPress={handleLogout} variant="ghost" />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>当前账号</Text>
        <Text style={styles.heroTitle}>{user?.display_name || user?.phone}</Text>
        <Text style={styles.heroText}>
          把手机靠近 NFC 标签。SoundTag 只读取标签编号，不要求标签里已有内容；空白新标签也可以直接开始录音。
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusValue}>{lastAction}</Text>
          <Text style={styles.statusLabel}>最近状态</Text>
        </View>

        <PrimaryButton label="扫描 NFC 标签" loading={busy} onPress={handleScan} />
      </View>

      <View style={styles.devCard}>
        <Text style={styles.devTitle}>开发调试入口</Text>
        <Text style={styles.devText}>
          真机 NFC 不方便测试时，可以输入标签码模拟一次识别。正式使用时用户不会看到标签码。
        </Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setManualUid}
          placeholder="调试标签码"
          placeholderTextColor="rgba(244,247,251,0.35)"
          style={styles.input}
          value={manualUid}
        />
        <PrimaryButton label="模拟识别标签" onPress={() => void routeByUid(manualUid)} variant="ghost" />
      </View>
    </ScreenShell>
  );
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "请确认 NFC 已开启，手机靠近标签的芯片区域，并且后端服务可访问。";
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
  statusCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  statusValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  statusLabel: {
    color: "rgba(244,247,251,0.54)",
    fontSize: 12,
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
