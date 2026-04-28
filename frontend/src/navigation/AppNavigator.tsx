import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../contexts/AuthContext";
import { AuthScreen } from "../screens/AuthScreen";
import { FriendProfileScreen } from "../screens/FriendProfileScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { RecordsScreen } from "../screens/RecordsScreen";
import { TagDetailScreen } from "../screens/TagDetailScreen";
import { colors, radii, shadows } from "../theme";
import { MainTabParamList, RootStackParamList } from "./types";


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();


function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#4338CA",
        tabBarInactiveTintColor: "#9AA4B8",
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "扫描",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="NFC" />,
        }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsScreen}
        options={{
          title: "音频",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="♪" />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          title: "好友",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="友" />,
        }}
      />
    </Tab.Navigator>
  );
}


function TabIcon({ focused, icon }: { focused: boolean; icon: string }) {
  return (
    <View style={[styles.tabIcon, focused ? styles.tabIconActive : null]}>
      <Text style={[styles.tabIconText, focused ? styles.tabIconTextActive : null]}>{icon}</Text>
    </View>
  );
}


function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.splashText}>正在恢复 SoundTag 会话...</Text>
    </View>
  );
}


export function AppNavigator() {
  const { user, is_loading } = useAuth();

  if (is_loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Record" component={RecordScreen} />
          <Stack.Screen name="TagDetail" component={TagDetailScreen} />
          <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}


const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: 12,
  },
  splashText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(204,211,255,0.45)",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.ambient,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  tabItem: {
    paddingTop: 2,
  },
  tabIcon: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    minHeight: 36,
    borderRadius: radii.full,
  },
  tabIconActive: {
    backgroundColor: "rgba(204,211,255,0.42)",
  },
  tabIconText: {
    color: "#9AA4B8",
    fontSize: 15,
    fontWeight: "900",
  },
  tabIconTextActive: {
    color: "#4338CA",
  },
});
