import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { useAuth } from "../contexts/AuthContext";
import { lookupTag } from "../services/api";
import { scanTagUid } from "../services/nfc";
import { colors, radii, shadows } from "../theme";


export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();

  const [manualUid, setManualUid] = useState("04AABBCCDD66");
  const [lastAction, setLastAction] = useState("等待识别");
  const [busy, setBusy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

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
      title="准备扫描"
      scroll
      showPageHeader={false}
      headerAction={<PrimaryButton label="退出" onPress={handleLogout} variant="ghost" size="sm" />}
      contentStyle={styles.screen}
    >
      <View style={styles.scanArea}>
        <View style={styles.scanRings}>
          <View style={styles.outerRing} />
          <View style={styles.middleRing} />
          <View style={styles.innerRing} />
          <Pressable
            disabled={busy}
            onPress={() => void handleScan()}
            style={({ pressed }) => [
              styles.scanButton,
              pressed && !busy ? styles.scanButtonPressed : null,
            ]}
          >
            <Text style={styles.scanButtonText}>NFC</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>准备扫描</Text>
        <Text style={styles.subtitle}>请将手机靠近 SoundTag 标签来收听或录音</Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{lastAction}</Text>
        </View>

        <PrimaryButton
          label={busy ? "正在扫描..." : "开始扫描"}
          loading={busy}
          onPress={handleScan}
          size="lg"
          style={styles.mainAction}
        />

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>如何操作？</Text>
          <Text style={styles.tipsText}>
            新标签会直接进入录音；已经保存声音的标签会打开播放页，并提供重录入口。
          </Text>
        </View>
      </View>

      <Pressable onPress={() => setShowDebug((value) => !value)} style={styles.debugToggle}>
        <Text style={styles.debugToggleText}>{showDebug ? "收起开发调试" : "开发调试"}</Text>
      </Pressable>

      {showDebug ? (
        <View style={styles.devCard}>
          <Text style={styles.devTitle}>模拟识别标签</Text>
          <Text style={styles.devText}>真机 NFC 不方便测试时，可以输入标签码模拟一次识别。</Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setManualUid}
            placeholder="调试标签码"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            value={manualUid}
          />
          <PrimaryButton
            label="模拟识别"
            onPress={() => void routeByUid(manualUid)}
            variant="ghost"
          />
        </View>
      ) : null}
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
  screen: {
    paddingBottom: 116,
  },
  scanArea: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 600,
  },
  scanRings: {
    alignItems: "center",
    justifyContent: "center",
    width: 308,
    height: 308,
    marginBottom: 42,
  },
  outerRing: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(204,211,255,0.14)",
  },
  middleRing: {
    position: "absolute",
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: "rgba(204,211,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
  },
  innerRing: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: "rgba(204,211,255,0.5)",
    ...shadows.ambient,
  },
  scanButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  scanButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  scanButtonText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 30,
    marginTop: 16,
    maxWidth: 310,
    textAlign: "center",
  },
  statusPill: {
    borderRadius: radii.full,
    backgroundColor: "rgba(240,237,240,0.9)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 30,
    ...shadows.soft,
  },
  statusText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  mainAction: {
    alignSelf: "stretch",
    marginTop: 18,
  },
  tipsCard: {
    alignSelf: "stretch",
    borderRadius: radii.lg,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.42)",
    marginTop: 18,
  },
  tipsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  tipsText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  debugToggle: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  debugToggleText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  devCard: {
    borderRadius: radii.lg,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.56)",
    gap: 12,
    marginBottom: 18,
  },
  devTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  devText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.text,
    paddingHorizontal: 18,
    fontSize: 16,
  },
});
