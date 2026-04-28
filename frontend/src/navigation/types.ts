import { NavigatorScreenParams } from "@react-navigation/native";


export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Record: {
    uid: string;
    mode: "create" | "overwrite";
  };
  TagDetail: {
    uid: string;
  };
  FriendProfile: {
    friendId: string;
    displayName?: string | null;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  Friends: undefined;
};
