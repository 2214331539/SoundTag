import NfcManager, { NfcTech } from "react-native-nfc-manager";


let hasStarted = false;


type TagLike = {
  id?: unknown;
  uid?: unknown;
  serialNumber?: unknown;
};


function normalizeUid(uid: string) {
  return uid.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}


function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}


function readUidValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = normalizeUid(value);
    return normalized || null;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return bytesToHex(value);
  }

  return null;
}


function extractUid(tag: TagLike | null) {
  return readUidValue(tag?.id) ?? readUidValue(tag?.uid) ?? readUidValue(tag?.serialNumber);
}


export async function ensureNfcReady() {
  const supported = await NfcManager.isSupported();
  if (!supported) {
    throw new Error("当前设备不支持 NFC。");
  }

  if (!hasStarted) {
    await NfcManager.start();
    hasStarted = true;
  }

  const enabled = await NfcManager.isEnabled();
  if (!enabled) {
    throw new Error("NFC 尚未开启，请先在系统设置中启用。");
  }
}


export async function scanTagUid() {
  await ensureNfcReady();

  try {
    await NfcManager.requestTechnology([
      NfcTech.NfcA,
      NfcTech.MifareUltralight,
      NfcTech.NdefFormatable,
      NfcTech.Ndef,
    ]);

    const tag = (await NfcManager.getTag()) as TagLike | null;
    const uid = extractUid(tag);
    if (!uid) {
      throw new Error("已识别到 NFC 标签，但没有读取到标签编号，请重新靠近标签。");
    }

    return uid;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
