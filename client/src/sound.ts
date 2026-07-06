// sound.ts — hệ âm thanh McUp (SFX + nhạc nền), quản lý tập trung.
// Nguyên tắc: (1) nhạc nền KHÔNG BAO GIỜ kêu khi thu âm (không phá clip chấm);
// (2) một công tắc Bật/Tắt trong Hồ sơ, nhớ qua AsyncStorage;
// (3) SFX preload sẵn để chạm là kêu ngay, không trễ.
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

// SFX: Kenney "Interface Sounds" (kenney.nl, CC0 1.0 — public domain). Xem assets/CREDITS.md
const SFX_FILES = {
  tap: require("../assets/tap.wav"),        // chạm nút (click_001)
  pop: require("../assets/pop.wav"),        // đổi tab / pill (select_002)
  start: require("../assets/start.wav"),    // bắt đầu thu — sweep đi lên (maximize_003)
  stop: require("../assets/stop.wav"),      // dừng thu — sweep đi xuống (minimize_003)
  success: require("../assets/success.wav"),// màn điểm hiện (confirmation_001)
  ting: require("../assets/ting.wav"),      // khoảnh khắc thưởng (confirmation_002)
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
    // Nhạc nền: "Wholesome" — Kevin MacLeod (incompetech.com), CC BY 4.0.
    // Đoạn 76s fade mượt để loop. Credit bắt buộc: xem assets/CREDITS.md + màn Hồ sơ.
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/ambient.m4a"), { isLooping: true, volume: 0.2, shouldPlay: false });
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
  if (!v) {
    // Thu xong: trả audio mode về mặc định — TÔN TRỌNG công tắc im lặng iOS trở lại
    // (lúc thu buộc phải bật playsInSilentModeIOS; không reset thì nhạc nền kêu cả khi máy gạt im lặng)
    Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false }).catch(() => {});
  }
  syncMusic();
}

export function soundEnabled() { return enabled; }

export async function setSoundEnabled(v: boolean) {
  enabled = v;
  await AsyncStorage.setItem("sound", v ? "on" : "off");
  syncMusic();
}
