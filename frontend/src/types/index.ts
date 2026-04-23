export type AuthPurpose = "login" | "register";

export type AuthUser = {
  id: string;
  phone: string;
  display_name?: string | null;
  created_at: string;
};

export type RequestCodeResponse = {
  message: string;
  debug_code?: string | null;
  expires_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type AudioRecord = {
  id: string;
  tag_id: string;
  owner_id: string;
  title?: string | null;
  object_key: string;
  file_url: string;
  mime_type: string;
  duration_seconds: number;
  file_size?: number | null;
  is_active: boolean;
  replaced_at?: string | null;
  created_at: string;
};

export type TagState = {
  uid: string;
  status: "new" | "owned" | "locked";
  latest_record?: AudioRecord | null;
};

export type UploadCredential = {
  access_key_id: string;
  access_key_secret: string;
  security_token: string;
  expiration: string;
  bucket: string;
  upload_url: string;
  object_key: string;
  file_url: string;
  mime_type: string;
};

export type TimelineRecord = {
  id: string;
  uid: string;
  title?: string | null;
  object_key: string;
  file_url: string;
  mime_type: string;
  duration_seconds: number;
  file_size?: number | null;
  is_active: boolean;
  replaced_at?: string | null;
  created_at: string;
};
