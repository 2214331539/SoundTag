import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { useAuth } from "../contexts/AuthContext";
import { colors, radii, shadows } from "../theme";
import { AuthPurpose } from "../types";


export function AuthScreen() {
  const { requestCode, verifyCode } = useAuth();

  const [authMode, setAuthMode] = useState<AuthPurpose>("login");
  const [phone, setPhone] = useState("13800138000");
  const [displayName, setDisplayName] = useState("我的 SoundTag");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleModeChange(nextMode: AuthPurpose) {
    setAuthMode(nextMode);
    setCode("");
    setDebugCode(null);
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const withoutCountryCode = digits.startsWith("86") && digits.length > 11 ? digits.slice(2) : digits;
    setPhone(withoutCountryCode.slice(0, 11));
  }

  function getNormalizedPhone() {
    if (!/^1\d{10}$/.test(phone)) {
      Alert.alert("手机号格式不正确", "请输入 11 位中国大陆手机号，输入框前已固定显示 +86。");
      return null;
    }

    return `+86${phone}`;
  }

  async function handleRequestCode() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    try {
      setRequesting(true);
      const response = await requestCode(normalizedPhone, authMode);
      setDebugCode(response.debug_code ?? null);
      setCountdown(60);
      Alert.alert("验证码已发送", getRequestSuccessMessage(response.debug_code));
    } catch (error) {
      Alert.alert("发送失败", extractMessage(error));
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerifyCode() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    if (!/^\d{4,6}$/.test(code.trim())) {
      Alert.alert("验证码格式不正确", "请输入短信里的 4-6 位数字验证码。");
      return;
    }

    if (authMode === "register" && !displayName.trim()) {
      Alert.alert("请填写昵称", "注册时需要设置一个用于展示的昵称。");
      return;
    }

    try {
      setVerifying(true);
      await verifyCode(
        normalizedPhone,
        code.trim(),
        authMode,
        authMode === "register" ? displayName.trim() : undefined,
      );
    } catch (error) {
      Alert.alert(authMode === "register" ? "注册失败" : "登录失败", extractMessage(error));
    } finally {
      setVerifying(false);
    }
  }

  const isRegister = authMode === "register";
  const title = isRegister ? "创建 SoundTag 账号" : "欢迎回来";
  const subtitle = isRegister ? "用手机号注册后即可绑定你的 NFC 声音标签" : "输入手机号和验证码登录";
  const requestLabel = countdown > 0 ? `${countdown}s 后重发` : "获取验证码  ->";

  return (
    <ScreenShell title={title} scroll showPageHeader={false}>
      <View style={styles.hero}>
        <View style={styles.soundMark}>
          <WaveGlyph height={58} color={colors.primary} accentColor={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.segmented}>
        <ModeButton active={authMode === "login"} label="登录" onPress={() => handleModeChange("login")} />
        <ModeButton active={authMode === "register"} label="注册" onPress={() => handleModeChange("register")} />
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>手机号</Text>
          <View style={styles.phoneField}>
            <Text style={styles.countryCode}>+86</Text>
            <View style={styles.divider} />
            <TextInput
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={11}
              onChangeText={handlePhoneChange}
              placeholder="请输入手机号"
              placeholderTextColor={colors.textSoft}
              style={styles.phoneInput}
              value={phone}
            />
          </View>
        </View>

        {isRegister ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>昵称</Text>
            <TextInput
              maxLength={64}
              onChangeText={setDisplayName}
              placeholder="我的 SoundTag"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              value={displayName}
            />
          </View>
        ) : null}

        <PrimaryButton
          label={requestLabel}
          loading={requesting}
          disabled={countdown > 0}
          onPress={handleRequestCode}
          size="lg"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>验证码</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            placeholder="输入短信验证码"
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
          label={isRegister ? "注册并进入" : "登录"}
          loading={verifying}
          onPress={handleVerifyCode}
          variant="secondary"
        />
      </View>

      <Text style={styles.agreement}>登录或注册即代表同意 用户协议 和 隐私政策</Text>
    </ScreenShell>
  );
}


function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        active ? styles.modeButtonActive : null,
        pressed ? styles.modeButtonPressed : null,
      ]}
    >
      <Text style={[styles.modeButtonText, active ? styles.modeButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}


function getRequestSuccessMessage(debugCode?: string | null) {
  if (debugCode) {
    return "当前开启了调试验证码展示，可直接使用页面中的验证码完成登录。";
  }

  return "请查看手机短信，并在 5 分钟内完成验证。";
}


function extractMessage(error: unknown) {
  if (typeof error === "object" && error) {
    const maybeAxiosError = error as {
      message?: unknown;
      response?: {
        data?: unknown;
      };
    };
    const data = maybeAxiosError.response?.data;

    if (
      typeof data === "object" &&
      data &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (typeof maybeAxiosError.message === "string") {
      return maybeAxiosError.message;
    }
  }

  return "请检查后端服务和网络配置。";
}


const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 70,
    paddingBottom: 28,
  },
  soundMark: {
    alignItems: "center",
    justifyContent: "center",
    width: 108,
    height: 108,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMid,
    marginBottom: 34,
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
  segmented: {
    flexDirection: "row",
    backgroundColor: "rgba(240,237,240,0.88)",
    borderRadius: radii.full,
    padding: 6,
    marginBottom: 22,
    ...shadows.soft,
  },
  modeButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 46,
    borderRadius: radii.full,
  },
  modeButtonActive: {
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  modeButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  modeButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: colors.primary,
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
    minWidth: 42,
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
