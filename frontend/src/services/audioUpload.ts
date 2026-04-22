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

  const response = await FileSystem.uploadAsync(credential.upload_url, file_uri, {
    fieldName: "file",
    httpMethod: "POST",
    mimeType: credential.mime_type,
    parameters: {
      key: credential.object_key,
      policy,
      OSSAccessKeyId: credential.access_key_id,
      "x-oss-security-token": credential.security_token,
      success_action_status: "200",
      Signature: signature,
      "Content-Type": credential.mime_type,
    },
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  });

  if (response.status !== 200) {
    throw new Error(`OSS上传失败：${response.status}. ${response.body}`);
  }

  return {
    object_key: credential.object_key,
    file_url: credential.file_url,
    file_size: "size" in fileInfo ? fileInfo.size : undefined,
  };
}
