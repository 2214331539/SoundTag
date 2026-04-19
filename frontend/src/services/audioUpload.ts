import * as FileSystem from "expo-file-system";
import CryptoJS from "crypto-js";

import { UploadCredential } from "../types";


type UploadAudioArgs = {
  credential: UploadCredential;
  file_uri: string;
};


export async function uploadAudioToOss({ credential, file_uri }: UploadAudioArgs) {
  const fileInfo = await FileSystem.getInfoAsync(file_uri, { size: true });
  if (!fileInfo.exists) {
    throw new Error("录音文件不存在，无法上传。");
  }

  const policyDocument = JSON.stringify({
    expiration: credential.expiration,
    conditions: [
      ["eq", "$key", credential.object_key],
      ["content-length-range", 0, 20 * 1024 * 1024],
    ],
  });

  const policy = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(policyDocument));
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA1(policy, credential.access_key_secret),
  );

  const formData = new FormData();
  formData.append("key", credential.object_key);
  formData.append("policy", policy);
  formData.append("OSSAccessKeyId", credential.access_key_id);
  formData.append("x-oss-security-token", credential.security_token);
  formData.append("success_action_status", "200");
  formData.append("Signature", signature);
  formData.append("Content-Type", credential.mime_type);
  formData.append("file", {
    uri: file_uri,
    name: credential.object_key.split("/").pop() ?? "soundtag-audio.m4a",
    type: credential.mime_type,
  } as any);

  const response = await fetch(credential.upload_url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OSS 上传失败: ${response.status} ${message}`);
  }

  return {
    object_key: credential.object_key,
    file_url: credential.file_url,
    file_size: "size" in fileInfo ? fileInfo.size : undefined,
  };
}
