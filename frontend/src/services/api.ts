import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";

import { AuthPurpose, AuthUser, AudioRecord, RequestCodeResponse, TagState, TimelineRecord, TokenResponse, UploadCredential } from "../types";


const SESSION_TOKEN_KEY = "soundtag/access-token";
const SESSION_USER_KEY = "soundtag/current-user";
const DEFAULT_API_PORT = "8000";
// Expo statically inlines EXPO_PUBLIC_* env vars during bundling.
// @ts-expect-error React Native's process.env typing does not include Expo public env vars.
const EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function getDefaultApiBaseUrl() {
  if (Platform.OS === "android") {
    return `http://10.0.2.2:${DEFAULT_API_PORT}/api/v1`;
  }

  if (Platform.OS === "web") {
    return `http://localhost:${DEFAULT_API_PORT}/api/v1`;
  }

  return `http://127.0.0.1:${DEFAULT_API_PORT}/api/v1`;
}

function resolveApiBaseUrl(rawValue?: string) {
  const value = rawValue?.trim();
  if (!value) {
    return getDefaultApiBaseUrl();
  }

  try {
    const parsed = new URL(value);

    if (!parsed.port) {
      parsed.port = DEFAULT_API_PORT;
    }

    // Android 模拟器中的 localhost 指向模拟器自身，而不是宿主机。
    if (Platform.OS === "android" && parsed.hostname === "localhost") {
      parsed.hostname = "10.0.2.2";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

export const API_BASE_URL = resolveApiBaseUrl(EXPO_PUBLIC_API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

let accessToken: string | null = null;


api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && !error.response) {
      return Promise.reject(
        new Error(`无法连接接口 ${API_BASE_URL}，请检查后端是否启动，以及当前设备是否能访问这个地址。`),
      );
    }

    return Promise.reject(error);
  },
);


export function setAccessToken(token: string | null) {
  accessToken = token;
}


export async function hydrateSession() {
  const [token, userRaw] = await Promise.all([
    AsyncStorage.getItem(SESSION_TOKEN_KEY),
    AsyncStorage.getItem(SESSION_USER_KEY),
  ]);

  if (token) {
    setAccessToken(token);
  }

  return {
    token,
    user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
  };
}


export async function persistSession(token: string, user: AuthUser) {
  setAccessToken(token);
  await Promise.all([
    AsyncStorage.setItem(SESSION_TOKEN_KEY, token),
    AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(user)),
  ]);
}


export async function clearSession() {
  setAccessToken(null);
  await Promise.all([
    AsyncStorage.removeItem(SESSION_TOKEN_KEY),
    AsyncStorage.removeItem(SESSION_USER_KEY),
  ]);
}


export async function requestCode(phone: string, purpose: AuthPurpose): Promise<RequestCodeResponse> {
  const response = await api.post<RequestCodeResponse>("/auth/request-code", { phone, purpose });
  return response.data;
}


export async function verifyCode(
  phone: string,
  code: string,
  purpose: AuthPurpose,
  display_name?: string,
  password?: string,
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/auth/verify-code", {
    phone,
    code,
    purpose,
    display_name,
    password,
  });
  return response.data;
}


export async function passwordLogin(phone: string, password: string): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/auth/password-login", {
    phone,
    password,
  });
  return response.data;
}


export async function getMe(): Promise<AuthUser> {
  const response = await api.get<AuthUser>("/auth/me");
  return response.data;
}


export async function lookupTag(uid: string): Promise<TagState> {
  const response = await api.get<TagState>(`/tags/${encodeURIComponent(uid)}`);
  return response.data;
}


export async function requestUploadCredential(payload: {
  uid: string;
  file_extension: string;
  mime_type: string;
}): Promise<UploadCredential> {
  const response = await api.post<UploadCredential>("/tags/uploads/sts", payload);
  return response.data;
}


export async function bindTag(
  uid: string,
  payload: {
    title?: string;
    object_key: string;
    file_url: string;
    image_object_key?: string;
    image_url?: string;
    mime_type: string;
    duration_seconds: number;
    file_size?: number;
  },
): Promise<AudioRecord> {
  const response = await api.post<AudioRecord>(`/tags/${encodeURIComponent(uid)}/bind`, payload);
  return response.data;
}


export async function listTimelineRecords(): Promise<TimelineRecord[]> {
  const response = await api.get<TimelineRecord[]>("/records");
  return response.data;
}


export async function renameTimelineRecord(id: string, title: string): Promise<TimelineRecord> {
  const response = await api.patch<TimelineRecord>(`/records/${encodeURIComponent(id)}`, { title });
  return response.data;
}


export async function deleteTimelineRecord(id: string): Promise<void> {
  await api.delete(`/records/${encodeURIComponent(id)}`);
}
