import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { useAuth } from "../contexts/AuthContext";


export function AuthScreen() {
  const { requestCode, verifyCode } = useAuth();

  const [phone, setPhone] = useState("+8613800138000");
  const [displayName, setDisplayName] = useState("我的 SoundTag");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleRequestCode() {
    try {
      setRequesting(true);
      const response = await requestCode(phone.trim());
      setDebugCode(response.debug_code ?? null);
      Alert.alert("验证码已发送", "开发模式下可直接使用页面展示的验证码登录。");
    } catch (error) {
      Alert.alert("发送失败", extractMessage(error));
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerifyCode() {
    try {
      setVerifying(true);
      await verifyCode(phone.trim(), code.trim(), displayName.trim() || undefined);
    } catch (error) {
      Alert.alert("登录失败", extractMessage(error));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <ScreenShell
      title="给实体物品贴一段声音"
      subtitle="MVP 默认使用手机号验证码登录。后端开启 DEBUG_EXPOSE_OTP 后，页面会显示调试验证码，便于联调。"
      scroll
    >
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>身份认证</Text>
        <Text style={styles.panelText}>
          录音绑定、标签覆写和个人记录列表都依赖当前账号。先登录，再开始扫描 NFC 标签。
        </Text>

        <Text style={styles.fieldLabel}>手机号</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="+8613800138000"
          placeholderTextColor="rgba(244,247,251,0.35)"
          style={styles.input}
          value={phone}
        />

        <Text style={styles.fieldLabel}>昵称（可选）</Text>
        <TextInput
          onChangeText={setDisplayName}
          placeholder="我的 SoundTag"
          placeholderTextColor="rgba(244,247,251,0.35)"
          style={styles.input}
          value={displayName}
        />

        <PrimaryButton label="获取验证码" loading={requesting} onPress={handleRequestCode} />

        <Text style={styles.fieldLabel}>验证码</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setCode}
          placeholder="输入 6 位验证码"
          placeholderTextColor="rgba(244,247,251,0.35)"
          style={styles.input}
          value={code}
        />

        {debugCode ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugLabel}>调试验证码</Text>
            <Text style={styles.debugValue}>{debugCode}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label="登录并进入 SoundTag"
          loading={verifying}
          onPress={handleVerifyCode}
        />
      </View>
    </ScreenShell>
  );
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "请检查后端服务和网络配置。";
}


const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(10, 22, 34, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 22,
    gap: 14,
  },
  panelTitle: {
    color: "#F4F7FB",
    fontSize: 22,
    fontWeight: "800",
  },
  panelText: {
    color: "rgba(244,247,251,0.76)",
    fontSize: 14,
    lineHeight: 22,
  },
  fieldLabel: {
    color: "#7FB8D5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 6,
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
  debugCard: {
    backgroundColor: "rgba(255,123,84,0.12)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,123,84,0.2)",
  },
  debugLabel: {
    color: "#FFB49C",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  debugValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 4,
  },
});
