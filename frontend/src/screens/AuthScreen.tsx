import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { useAuth } from "../contexts/AuthContext";
import { colors, radii, shadows } from "../theme";


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
    <ScreenShell title="欢迎来到 SoundTag" scroll showPageHeader={false}>
      <View style={styles.hero}>
        <View style={styles.soundMark}>
          <WaveGlyph height={58} color={colors.primary} accentColor={colors.primary} />
        </View>
        <Text style={styles.title}>欢迎来到 SoundTag</Text>
        <Text style={styles.subtitle}>请输入手机号以安全登录</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>手机号</Text>
          <View style={styles.phoneField}>
            <Text style={styles.countryCode}>+86</Text>
            <View style={styles.divider} />
            <TextInput
              autoCapitalize="none"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="手机号"
              placeholderTextColor={colors.textSoft}
              style={styles.phoneInput}
              value={phone}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            onChangeText={setDisplayName}
            placeholder="我的 SoundTag"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            value={displayName}
          />
        </View>

        <PrimaryButton
          label="获取验证码  ->"
          loading={requesting}
          onPress={handleRequestCode}
          size="lg"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>验证码</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setCode}
            placeholder="输入 6 位验证码"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            value={code}
          />
        </View>

        {debugCode ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugLabel}>调试验证码</Text>
            <Text style={styles.debugValue}>{debugCode}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label="登录并进入"
          loading={verifying}
          onPress={handleVerifyCode}
          variant="secondary"
        />
      </View>

      <Text style={styles.agreement}>登录即代表同意 用户协议 和 隐私政策</Text>
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
  hero: {
    alignItems: "center",
    paddingTop: 86,
    paddingBottom: 42,
  },
  soundMark: {
    alignItems: "center",
    justifyContent: "center",
    width: 112,
    height: 112,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMid,
    marginBottom: 42,
    ...shadows.soft,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 12,
    textAlign: "center",
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    paddingLeft: 8,
  },
  phoneField: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 64,
    borderRadius: radii.full,
    backgroundColor: "rgba(240,237,240,0.88)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.7)",
    paddingHorizontal: 22,
    ...shadows.soft,
  },
  countryCode: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    minWidth: 48,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(198,197,207,0.82)",
    marginHorizontal: 18,
  },
  phoneInput: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 54,
  },
  input: {
    minHeight: 60,
    borderRadius: radii.full,
    backgroundColor: "rgba(240,237,240,0.88)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.7)",
    color: colors.text,
    paddingHorizontal: 22,
    fontSize: 17,
    ...shadows.soft,
  },
  debugCard: {
    alignItems: "center",
    borderRadius: radii.lg,
    padding: 18,
    backgroundColor: "rgba(204,211,255,0.48)",
    borderWidth: 1,
    borderColor: "rgba(85,92,130,0.12)",
  },
  debugLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  debugValue: {
    color: colors.primaryText,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 5,
    marginTop: 8,
  },
  agreement: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 34,
    textAlign: "center",
  },
});
