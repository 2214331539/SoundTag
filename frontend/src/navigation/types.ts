export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
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
