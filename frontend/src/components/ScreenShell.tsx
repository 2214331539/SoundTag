import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";


type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  scroll?: boolean;
  headerAction?: ReactNode;
}>;


export function ScreenShell({
  title,
  subtitle,
  scroll = false,
  headerAction,
  children,
}: ScreenShellProps) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <LinearGradient colors={["#08131d", "#123248", "#0d1f2d"]} style={styles.gradient}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SoundTag MVP</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerAction ? <View style={styles.action}>{headerAction}</View> : null}
        </View>

        <View style={styles.orbLarge} />
        <View style={styles.orbSmall} />
        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 10,
    marginBottom: 24,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: "#7FB8D5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    color: "#F4F7FB",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    color: "rgba(244, 247, 251, 0.76)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  action: {
    paddingTop: 6,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  orbLarge: {
    position: "absolute",
    right: -36,
    top: 72,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 123, 84, 0.12)",
  },
  orbSmall: {
    position: "absolute",
    left: -28,
    top: 220,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(122, 209, 255, 0.10)",
  },
});
