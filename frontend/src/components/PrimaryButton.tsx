import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

import { colors, radii, shadows } from "../theme";


type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "ghost" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};


export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "solid",
  size = "md",
  style,
  textStyle,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const indicatorColor = variant === "solid" || variant === "danger" ? colors.white : colors.primary;
  const labelSizeStyle =
    size === "sm" ? styles.smLabel : size === "lg" ? styles.lgLabel : styles.mdLabel;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        variant === "ghost" ? styles.ghost : styles.solid,
        variant === "secondary" ? styles.secondary : null,
        variant === "danger" ? styles.danger : null,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text
          style={[
            styles.label,
            labelSizeStyle,
            variant === "ghost" ? styles.ghostLabel : styles.solidLabel,
            variant === "secondary" ? styles.secondaryLabel : null,
            variant === "danger" ? styles.dangerLabel : null,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sm: {
    minHeight: 40,
    paddingHorizontal: 16,
  },
  md: {
    minHeight: 54,
    paddingHorizontal: 22,
  },
  lg: {
    minHeight: 64,
    paddingHorizontal: 28,
  },
  solid: {
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  secondary: {
    backgroundColor: colors.accent,
    shadowColor: "#E7E5B6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 5,
  },
  danger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  smLabel: {
    fontSize: 13,
  },
  mdLabel: {
    fontSize: 16,
  },
  lgLabel: {
    fontSize: 18,
  },
  solidLabel: {
    color: colors.white,
  },
  ghostLabel: {
    color: colors.primary,
  },
  secondaryLabel: {
    color: colors.accentStrong,
  },
  dangerLabel: {
    color: colors.white,
  },
});
