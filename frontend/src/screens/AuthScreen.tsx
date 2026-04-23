import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenShell } from "../components/ScreenShell";
import { WaveGlyph } from "../components/WaveGlyph";
import { useAuth } from "../contexts/AuthContext";
import { colors, radii, shadows } from "../theme";
import { AuthPurpose } from "../types";


type AuthMode = "password_login" | "sms_login" | "register" | "reset_password";


export function AuthScreen() {
  const { passwordLogin, requestCode, verifyCode } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>("password_login");
  const [phone, setPhone] = useState("13800138000");
  const [displayName, setDisplayName] = useState("我的 SoundTag");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleModeChange(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setCode("");
    setDebugCode(null);
    setPassword("");
    setConfirmPassword("");
    setCountdown(0);
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

  function getCodePurpose(): AuthPurpose {
    if (authMode === "register") {
      return "register";
    }

    if (authMode === "reset_password") {
      return "reset_password";
    }

    return "login";
  }

  function validatePasswordPair() {
    if (password.length < 8) {
      Alert.alert("密码太短", "请设置至少 8 位密码。");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("两次密码不一致", "请确认两次输入的新密码相同。");
      return false;
    }

    return true;
  }

  async function handleRequestCode() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    try {
      setRequesting(true);
      const response = await requestCode(normalizedPhone, getCodePurpose());
      setDebugCode(response.debug_code ?? null);
      setCountdown(60);
      Alert.alert("验证码已发送", getRequestSuccessMessage(response.debug_code));
    } catch (error) {
      Alert.alert("发送失败", extractMessage(error));
    } finally {
      setRequesting(false);
    }
  }

  async function handlePasswordLogin() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone) {
      return;
    }

    if (!password) {
      Alert.alert("请输入密码", "请填写你的账号密码。");
      return;
    }

    try {
      setSubmitting(true);
      await passwordLogin(normalizedPhone, password);
    } catch (error) {
      Alert.alert("登录失败", extractMessage(error));
    } finally {
      setSubmitting(false);
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

    if ((authMode === "register" || authMode === "reset_password") && !validatePasswordPair()) {
      return;
    }

    try {
      setSubmitting(true);
      await verifyCode(
        normalizedPhone,
        code.trim(),
        getCodePurpose(),
        authMode === "register" ? displayName.trim() : undefined,
        authMode === "register" || authMode === "reset_password" ? password : undefined,
      );
    } catch (error) {
      Alert.alert(getSubmitErrorTitle(authMode), extractMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const modeCopy = getModeCopy(authMode);
  const usesCode = authMode !== "password_login";
  const needsPasswordSetup = authMode === "register" || authMode === "reset_password";
  const requestLabel = countdown > 0 ? `${countdown}s 后重发` : "获取验证码  ->";

  return (
    <ScreenShell title={modeCopy.title} scroll showPageHeader={false}>
      <View style={styles.hero}>
        <View style={styles.soundMark}>
          <WaveGlyph height={58} color={colors.primary} accentColor={colors.primary} />
        </View>
        <Text style={styles.title}>{modeCopy.title}</Text>
        <Text style={styles.subtitle}>{modeCopy.subtitle}</Text>
      </View>

      <View style={styles.segmented}>
        <ModeButton active={authMode === "password_login"} label="密码登录" onPress={() => handleModeChange("password_login")} />
        <ModeButton active={authMode === "sms_login"} label="验证码登录" onPress={() => handleModeChange("sms_login")} />
        <ModeButton active={authMode === "register"} label="注册" onPress={() => handleModeChange("register")} />
        <ModeButton active={authMode === "reset_password"} label="忘记密码" onPress={() => handleModeChange("reset_password")} />
      </View>

      <View style={styles.form}>
        <PhoneField phone={phone} onChange={handlePhoneChange} />

        {authMode === "register" ? (
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

        {authMode === "password_login" ? (
          <PasswordField label="密码" value={password} onChange={setPassword} placeholder="请输入账号密码" />
        ) : null}

        {usesCode ? (
          <>
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
          </>
        ) : null}

        {needsPasswordSetup ? (
          <>
            <PasswordField
              label={authMode === "register" ? "设置密码" : "新密码"}
              value={password}
              onChange={setPassword}
              placeholder="至少 8 位"
            />
            <PasswordField
              label="确认密码"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="再次输入密码"
            />
          </>
        ) : null}

        <PrimaryButton
          label={modeCopy.submitLabel}
          loading={submitting}
          onPress={authMode === "password_login" ? handlePasswordLogin : handleVerifyCode}
          variant="secondary"
        />
      </View>

      <Text style={styles.agreement}>登录或注册即代表同意 用户协议 和 隐私政策</Text>
    </ScreenShell>
  );
}


function PhoneField({ phone, onChange }: { phone: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>手机号</Text>
      <View style={styles.phoneField}>
        <Text style={styles.countryCode}>+86</Text>
        <View style={styles.divider} />
        <TextInput
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={11}
          onChangeText={onChange}
          placeholder="请输入手机号"
          placeholderTextColor={colors.textSoft}
          style={styles.phoneInput}
          value={phone}
        />
      </View>
    </View>
  );
}


function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        maxLength={128}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        secureTextEntry
        style={styles.input}
        value={value}
      />
    </View>
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


function getModeCopy(mode: AuthMode) {
  switch (mode) {
    case "sms_login":
      return {
        title: "验证码登录",
        subtitle: "通过短信验证码快速进入 SoundTag",
        submitLabel: "验证并登录",
      };
    case "register":
      return {
        title: "创建 SoundTag 账号",
        subtitle: "验证手机号后设置密码，后续可用密码登录",
        submitLabel: "注册并进入",
      };
    case "reset_password":
      return {
        title: "找回密码",
        subtitle: "验证手机号后设置一个新的账号密码",
        submitLabel: "重置密码并登录",
      };
    default:
      return {
        title: "欢迎回来",
        subtitle: "使用手机号和密码登录",
        submitLabel: "登录",
      };
  }
}


function getSubmitErrorTitle(mode: AuthMode) {
  if (mode === "register") {
    return "注册失败";
  }

  if (mode === "reset_password") {
    return "重置失败";
  }

  return "登录失败";
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
    paddingTop: 48,
    paddingBottom: 24,
  },
  soundMark: {
    alignItems: "center",
    justifyContent: "center",
    width: 104,
    height: 104,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMid,
    marginBottom: 28,
    ...shadows.soft,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 27,
    marginTop: 10,
    textAlign: "center",
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "rgba(240,237,240,0.88)",
    borderRadius: radii.lg,
    padding: 6,
    marginBottom: 22,
    gap: 6,
    ...shadows.soft,
  },
  modeButton: {
    alignItems: "center",
    justifyContent: "center",
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 44,
    borderRadius: radii.full,
    paddingHorizontal: 8,
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
    fontSize: 14,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: colors.primary,
  },
  form: {
    gap: 16,
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
    minHeight: 62,
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
    minHeight: 58,
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
