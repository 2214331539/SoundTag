import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, shadows } from "../theme";


type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  scroll?: boolean;
  headerAction?: ReactNode;
  headerLeading?: ReactNode;
  showBrandHeader?: boolean;
  showPageHeader?: boolean;
  centeredPageHeader?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;


export function ScreenShell({
  title,
  subtitle,
  scroll = false,
  headerAction,
  headerLeading,
  showBrandHeader = true,
  showPageHeader = true,
  centeredPageHeader = false,
  contentStyle,
  children,
}: ScreenShellProps) {
  const pageHeader = showPageHeader ? (
    <View style={[styles.pageHeader, centeredPageHeader ? styles.centeredPageHeader : null]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  ) : null;

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {pageHeader}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>
      {pageHeader}
      {children}
    </View>
  );

  return (
    <LinearGradient colors={[colors.background, "#F8F6FC", colors.backgroundWarm]} style={styles.gradient}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.lavenderOrb} />
        <View style={styles.warmOrb} />

        {showBrandHeader ? (
          <View style={styles.topBar}>
            <View style={styles.topSide}>{headerLeading ?? <DefaultAvatar />}</View>
            <Text style={styles.brand}>SoundTag</Text>
            <View style={[styles.topSide, styles.topSideRight]}>{headerAction ?? <MoonMark />}</View>
          </View>
        ) : null}

        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}


function DefaultAvatar() {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>ST</Text>
    </View>
  );
}


function MoonMark() {
  return (
    <View style={styles.moonButton}>
      <Text style={styles.moonText}>◐</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 64,
    paddingTop: 4,
    paddingBottom: 10,
  },
  topSide: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 72,
  },
  topSideRight: {
    alignItems: "flex-end",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: "rgba(198,197,207,0.7)",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  brand: {
    color: "#5B61F2",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  moonButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: radii.full,
  },
  moonText: {
    color: "#4F46E5",
    fontSize: 28,
    fontWeight: "800",
  },
  pageHeader: {
    marginTop: 26,
    marginBottom: 24,
  },
  centeredPageHeader: {
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 43,
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 10,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
  },
  lavenderOrb: {
    position: "absolute",
    right: -120,
    top: 78,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(204,211,255,0.24)",
    ...shadows.ambient,
  },
  warmOrb: {
    position: "absolute",
    left: -96,
    bottom: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(231,229,182,0.28)",
  },
});
