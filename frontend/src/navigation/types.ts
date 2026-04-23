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
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
};
