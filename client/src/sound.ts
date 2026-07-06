// sound.ts — hệ âm thanh McUp (SFX + nhạc nền), quản lý tập trung.
// Nguyên tắc: (1) nhạc nền KHÔNG BAO GIỜ kêu khi thu âm (không phá clip chấm);
// (2) một công tắc Bật/Tắt trong Hồ sơ, nhớ qua AsyncStorage;
// (3) SFX preload sẵn để chạm là kêu ngay, không trễ.
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SFX_FILES = {
  tap: require("../assets/tap.wav"),        // chạm nút
  pop: require("../assets/pop.wav"),        // đổi tab / pill
  start: require("../assets/start.wav"),    // bắt đầu thu (2 nốt lên)
  stop: require("../assets/stop.wav"),      // dừng thu (2 nốt xuống)
  success: require("../assets/success.wav"),// màn điểm hiện
  ting: require("../assets/ting.wav"),      // khoảnh khắc thưởng
} as const;
export type SfxName = keyof typeof SFX_FILES;

let enabled = true;
let inited = false;
const sfxPool: Partial<Record<SfxName, Audio.Sound>> = {};
let music: Audio.Sound | null = null;
let musicWanted = false; // nơi hiện tại có muốn nhạc không (feed/hồ sơ)
let recording = false;   // đang thu → chặn nhạc tuyệt đối

export async function initSound() {
  if (inited) return;
  inited = true;
  enabled = (await AsyncStorage.getItem("sound")) !== "off";
  for (const [name, mod] of Object.entries(SFX_FILES)) {
    try {
      const { sound } = await Audio.Sound.createAsync(mod, { shouldPlay: false, volume: 0.55 });
      sfxPool[name as SfxName] = sound;
    } catch { /* thiếu 1 file không làm app vỡ */ }
  }
}

export function sfx(name: SfxName) {
  if (!enabled) return;
  sfxPool[name]?.replayAsync().catch(() => {});
}

async function ensureMusic(): Promise<Audio.Sound | null> {
  if (music) return music;
  try {
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/ambient.wav"), { isLooping: true, volume: 0.2, shouldPlay: false });
    music = sound;
    return music;
  } catch { return null; }
}

async function syncMusic() {
  const shouldPlay = enabled && musicWanted && !recording;
  const m = await ensureMusic();
  if (!m) return;
  try {
    if (shouldPlay) await m.playAsync();
    else await m.pauseAsync();
  } catch { /* bỏ qua race unload */ }
}

/** Gọi khi đổi màn: nhạc chỉ ở bản đồ/hồ sơ/màn điểm — không ở màn thu. */
export function setMusicScene(wanted: boolean) {
  musicWanted = wanted;
  syncMusic();
}

/** RecordScreen/ReelsPager gọi quanh lúc thu — chặn nhạc tuyệt đối khi mic mở. */
export function setRecording(v: boolean) {
  recording = v;
  syncMusic();
}

export function soundEnabled() { return enabled; }

export async function setSoundEnabled(v: boolean) {
  enabled = v;
  await AsyncStorage.setItem("sound", v ? "on" : "off");
  syncMusic();
}
