import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import { AuthUser, AudioRecord, RequestCodeResponse, TagState, TimelineRecord, TokenResponse, UploadCredential } from "../types";


const SESSION_TOKEN_KEY = "soundtag/access-token";
const SESSION_USER_KEY = "soundtag/current-user";
const env = process.env as Record<string, string | undefined>;

const api = axios.create({
  baseURL: env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8000/api/v1",
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


export async function requestCode(phone: string): Promise<RequestCodeResponse> {
  const response = await api.post<RequestCodeResponse>("/auth/request-code", { phone });
  return response.data;
}


export async function verifyCode(
  phone: string,
  code: string,
  display_name?: string,
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/auth/verify-code", {
    phone,
    code,
    display_name,
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
    object_key: string;
    file_url: string;
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
