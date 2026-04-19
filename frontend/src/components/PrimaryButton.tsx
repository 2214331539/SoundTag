import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";


type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "ghost";
};


export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "solid",
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "ghost" ? styles.ghost : styles.solid,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? "#F4F7FB" : "#08131D"} />
      ) : (
        <Text style={[styles.label, variant === "ghost" ? styles.ghostLabel : styles.solidLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20,
  },
  solid: {
    backgroundColor: "#FF7B54",
    shadowColor: "#FF7B54",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  ghost: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  solidLabel: {
    color: "#08131D",
  },
  ghostLabel: {
    color: "#F4F7FB",
  },
});
