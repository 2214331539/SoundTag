import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../contexts/AuthContext";
import { AuthScreen } from "../screens/AuthScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { RecordsScreen } from "../screens/RecordsScreen";
import { TagDetailScreen } from "../screens/TagDetailScreen";
import { MainTabParamList, RootStackParamList } from "./types";


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();


function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#FF7B54",
        tabBarInactiveTintColor: "rgba(244, 247, 251, 0.5)",
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "靠近标签",
        }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsScreen}
        options={{
          title: "我的声音",
        }}
      />
    </Tab.Navigator>
  );
}


function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color="#FF7B54" size="large" />
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
          backgroundColor: "#08131d",
        },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Record" component={RecordScreen} />
          <Stack.Screen name="TagDetail" component={TagDetailScreen} />
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
    backgroundColor: "#08131d",
    gap: 12,
  },
  splashText: {
    color: "#F4F7FB",
    fontSize: 15,
  },
  tabBar: {
    backgroundColor: "#0c1a27",
    borderTopColor: "rgba(255,255,255,0.08)",
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});
