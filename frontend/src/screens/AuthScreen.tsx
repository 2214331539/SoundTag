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
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("我的 SoundTag");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCountdown(0);
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const withoutCountryCode = digits.startsWith("86") && digits.length > 11 ? digits.slice(2) : digits;
    setPhone(withoutCountryCode.slice(0, 11));
  }

  function getNormalizedPhone() {
    if (!isValidPhone) {
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
      Alert.alert("两次密码不一致", "请确认两次输入的密码相同。");
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

    if (!isCodeReady) {
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
  const isPasswordLogin = authMode === "password_login";
  const usesCode = !isPasswordLogin;
  const needsPasswordSetup = authMode === "register" || authMode === "reset_password";
  const isValidPhone = /^1\d{10}$/.test(phone);
  const isCodeReady = /^\d{4,6}$/.test(code.trim());
  const canRequestCode = isValidPhone && countdown <= 0 && !requesting;
  const requestLabel = countdown > 0 ? `${countdown}s` : requesting ? "发送中" : "获取验证码";
  const canSubmit = getCanSubmit({
    authMode,
    phoneReady: isValidPhone,
    codeReady: isCodeReady,
    displayNameReady: displayName.trim().length > 0,
    password,
    confirmPassword,
  });

  return (
    <ScreenShell
      title={modeCopy.title}
      scroll
      showPageHeader={false}
      contentStyle={styles.screenContent}
    >
      <View style={styles.authWrap}>
        <View style={styles.hero}>
          <View style={styles.soundMark}>
            <WaveGlyph height={42} color={colors.primary} accentColor={colors.primary} />
          </View>
          <Text style={styles.title}>{modeCopy.title}</Text>
          <Text style={styles.subtitle}>{modeCopy.subtitle}</Text>
        </View>

        <View style={styles.formCard}>
          <PhoneField phone={phone} onChange={handlePhoneChange} onClear={() => setPhone("")} />

          {usesCode ? (
            <>
              <CodeField
                code={code}
                onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                onRequest={handleRequestCode}
                requestLabel={requestLabel}
                requestDisabled={!canRequestCode}
              />

              {debugCode ? (
                <View style={styles.debugCard}>
                  <Text style={styles.debugLabel}>调试验证码</Text>
                  <Text style={styles.debugValue}>{debugCode}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {authMode === "register" ? (
            <PlainField
              label="昵称"
              value={displayName}
              onChange={setDisplayName}
              placeholder="用于展示的昵称"
              maxLength={64}
            />
          ) : null}

          {isPasswordLogin ? (
            <PasswordField
              label="密码"
              value={password}
              onChange={setPassword}
              placeholder="请输入账号密码"
              visible={showPassword}
              onToggleVisible={() => setShowPassword((current) => !current)}
            />
          ) : null}

          {needsPasswordSetup ? (
            <>
              <PasswordField
                label={authMode === "register" ? "设置密码" : "新密码"}
                value={password}
                onChange={setPassword}
                placeholder="至少 8 位"
                visible={showPassword}
                onToggleVisible={() => setShowPassword((current) => !current)}
              />
              <PasswordField
                label="确认密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="再次输入密码"
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword((current) => !current)}
              />
            </>
          ) : null}

          <View style={styles.assistRow}>
            <Pressable onPress={() => handleModeChange(isPasswordLogin ? "sms_login" : "password_login")}>
              <Text style={styles.assistLink}>{isPasswordLogin ? "验证码登录" : "密码登录"}</Text>
            </Pressable>

            <Pressable onPress={() => handleModeChange("reset_password")}>
              <Text style={styles.assistLink}>忘记密码</Text>
            </Pressable>
          </View>

          <PrimaryButton
            label={modeCopy.submitLabel}
            loading={submitting}
            disabled={!canSubmit}
            onPress={isPasswordLogin ? handlePasswordLogin : handleVerifyCode}
            size="lg"
            style={styles.submitButton}
            textStyle={styles.submitText}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{modeCopy.switchHint}</Text>
          <Pressable onPress={() => handleModeChange(modeCopy.switchMode)}>
            <Text style={styles.switchLink}>{modeCopy.switchLabel}</Text>
          </Pressable>
        </View>

        <Text style={styles.agreement}>登录或注册即代表同意《用户协议》和《隐私政策》</Text>
      </View>
    </ScreenShell>
  );
}


function PhoneField({
  phone,
  onChange,
  onClear,
}: {
  phone: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.fieldShell}>
      <View style={styles.fieldLeft}>
        <Text style={styles.fieldBadge}>手机号</Text>
        <Text style={styles.countryCode}>+86</Text>
      </View>
      <TextInput
        autoCapitalize="none"
        keyboardType="number-pad"
        maxLength={11}
        onChangeText={onChange}
        placeholder="请输入手机号"
        placeholderTextColor={colors.textSoft}
        style={styles.fieldInput}
        value={phone}
      />
      {phone ? (
        <Pressable hitSlop={10} onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearText}>清空</Text>
        </Pressable>
      ) : null}
    </View>
  );
}


function CodeField({
  code,
  onChange,
  onRequest,
  requestLabel,
  requestDisabled,
}: {
  code: string;
  onChange: (value: string) => void;
  onRequest: () => void;
  requestLabel: string;
  requestDisabled: boolean;
}) {
  return (
    <View style={styles.fieldShell}>
      <View style={styles.fieldLeft}>
        <Text style={styles.fieldBadge}>验证码</Text>
      </View>
      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={onChange}
        placeholder="请输入验证码"
        placeholderTextColor={colors.textSoft}
        style={styles.fieldInput}
        value={code}
      />
      <Pressable
        disabled={requestDisabled}
        onPress={onRequest}
        style={({ pressed }) => [
          styles.codeButton,
          requestDisabled ? styles.codeButtonDisabled : null,
          pressed && !requestDisabled ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.codeButtonText, requestDisabled ? styles.codeButtonTextDisabled : null]}>
          {requestLabel}
        </Text>
      </Pressable>
    </View>
  );
}


function PlainField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldShell}>
      <View style={styles.fieldLeft}>
        <Text style={styles.fieldBadge}>{label}</Text>
      </View>
      <TextInput
        maxLength={maxLength}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}


function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <View style={styles.fieldShell}>
      <View style={styles.fieldLeft}>
        <Text style={styles.fieldBadge}>{label}</Text>
      </View>
      <TextInput
        maxLength={128}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        secureTextEntry={!visible}
        style={styles.fieldInput}
        value={value}
      />
      <Pressable hitSlop={10} onPress={onToggleVisible} style={styles.visibilityButton}>
        <Text style={styles.visibilityText}>{visible ? "隐藏" : "显示"}</Text>
      </Pressable>
    </View>
  );
}


function getModeCopy(mode: AuthMode) {
  switch (mode) {
    case "sms_login":
      return {
        title: "验证码登录",
        subtitle: "输入手机号，使用短信验证码快速进入 SoundTag",
        submitLabel: "登录",
        switchHint: "没有账号？去",
        switchLabel: "注册",
        switchMode: "register" as AuthMode,
      };
    case "register":
      return {
        title: "创建账号",
        subtitle: "验证手机号后设置密码，之后可用账号密码登录",
        submitLabel: "注册",
        switchHint: "已有账号？去",
        switchLabel: "登录",
        switchMode: "password_login" as AuthMode,
      };
    case "reset_password":
      return {
        title: "找回密码",
        subtitle: "验证手机号后设置新的账号密码",
        submitLabel: "重置密码",
        switchHint: "想起密码了？去",
        switchLabel: "登录",
        switchMode: "password_login" as AuthMode,
      };
    default:
      return {
        title: "欢迎回来",
        subtitle: "使用手机号和密码登录 SoundTag",
        submitLabel: "登录",
        switchHint: "没有账号？去",
        switchLabel: "注册",
        switchMode: "register" as AuthMode,
      };
  }
}


function getCanSubmit({
  authMode,
  phoneReady,
  codeReady,
  displayNameReady,
  password,
  confirmPassword,
}: {
  authMode: AuthMode;
  phoneReady: boolean;
  codeReady: boolean;
  displayNameReady: boolean;
  password: string;
  confirmPassword: string;
}) {
  if (!phoneReady) {
    return false;
  }

  if (authMode === "password_login") {
    return password.length > 0;
  }

  if (authMode === "sms_login") {
    return codeReady;
  }

  if (authMode === "register") {
    return codeReady && displayNameReady && password.length >= 8 && confirmPassword.length >= 8;
  }

  return codeReady && password.length >= 8 && confirmPassword.length >= 8;
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
  screenContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 42,
  },
  authWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: 8,
  },
  hero: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 22,
  },
  soundMark: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.55)",
    marginBottom: 18,
    ...shadows.soft,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    textAlign: "center",
  },
  formCard: {
    gap: 14,
    borderRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.46)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    ...shadows.soft,
  },
  fieldShell: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 58,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.72)",
    paddingLeft: 16,
    paddingRight: 10,
  },
  fieldLeft: {
    alignItems: "center",
    flexDirection: "row",
    minWidth: 72,
  },
  fieldBadge: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: "800",
  },
  countryCode: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 10,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 10,
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  clearText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  codeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    minWidth: 96,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    paddingHorizontal: 13,
  },
  codeButtonDisabled: {
    backgroundColor: colors.surfaceHigh,
  },
  codeButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  codeButtonTextDisabled: {
    color: colors.textSoft,
  },
  visibilityButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  visibilityText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  assistRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  assistLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  submitButton: {
    width: "100%",
    marginTop: 4,
  },
  submitText: {
    fontWeight: "900",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  debugCard: {
    alignItems: "center",
    borderRadius: radii.lg,
    padding: 14,
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
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 5,
    marginTop: 6,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 22,
  },
  switchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  switchLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 3,
  },
  agreement: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 18,
    paddingHorizontal: 22,
    textAlign: "center",
  },
});
