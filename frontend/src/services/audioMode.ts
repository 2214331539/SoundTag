import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";


const AUDIO_FOCUS_RETRY_DELAY_MS = 220;


export async function enableRecordingMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: false,
    staysActiveInBackground: false,
  });
}


export async function enablePlaybackMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
    staysActiveInBackground: false,
  });

  await wait(AUDIO_FOCUS_RETRY_DELAY_MS);
}


export async function playSoundWithFocusRetry(sound: Audio.Sound, restart = false) {
  try {
    if (restart) {
      return await sound.replayAsync();
    }

    return await sound.playAsync();
  } catch (error) {
    if (!isAudioFocusError(error)) {
      throw error;
    }

    await enablePlaybackMode();

    if (restart) {
      await sound.setPositionAsync(0).catch(() => undefined);
    }

    return await sound.playAsync();
  }
}


function isAudioFocusError(error: unknown) {
  return error instanceof Error && error.message.includes("AudioFocusNotAcquired");
}


function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
