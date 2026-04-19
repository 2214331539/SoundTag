import NfcManager, { NfcTech } from "react-native-nfc-manager";


let hasStarted = false;


function normalizeUid(uid: string) {
  return uid.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}


export async function ensureNfcReady() {
  if (!hasStarted) {
    await NfcManager.start();
    hasStarted = true;
  }

  const supported = await NfcManager.isSupported();
  if (!supported) {
    throw new Error("当前设备不支持 NFC。");
  }

  const enabled = await NfcManager.isEnabled();
  if (!enabled) {
    throw new Error("NFC 尚未开启，请先在系统设置中启用。");
  }
}


export async function scanTagUid() {
  await ensureNfcReady();

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = (await NfcManager.getTag()) as
      | { id?: string; uid?: string; serialNumber?: string }
      | null;

    const uid = tag?.id ?? tag?.uid ?? tag?.serialNumber;
    if (!uid) {
      throw new Error("读取到了标签，但没有拿到 UID。");
    }

    return normalizeUid(uid);
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
