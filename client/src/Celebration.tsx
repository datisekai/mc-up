// Celebration.tsx — overlay khoảnh khắc thưởng (P0-cam-xuc-spec §1).
// Timeline: backdrop+haptic → spotlight spring → confetti+ting → icon drop → chữ.
// Tôn trọng "Giảm chuyển động" (§1.7): chỉ fade, giữ haptic + âm.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import Confetti from "./Confetti";
import { C, F } from "./theme";
import { Fire, Star, Ticket, Trophy } from "./icons";
import {
  CELEB_STREAK, CELEB_SUB, CELEB_TICKET, CELEB_TIER, CELEB_XP,
  ConfettiVariant, fill, pick, pickVariant,
} from "./variety";

export type CelebKind = "ticket" | "tier" | "streak" | "xp";

const TITLE_POOL: Record<CelebKind, string[]> = {
  ticket: CELEB_TICKET, tier: CELEB_TIER, streak: CELEB_STREAK, xp: CELEB_XP,
};

function titleFor(kind: CelebKind, value?: number | string): string {
  const tpl = pick(TITLE_POOL[kind], `celeb-${kind}`);
  return fill(tpl, { tier: value ?? "", n: value ?? "", xp: value ?? "" });
}

const AUTO_DISMISS_MS = 2600;

export default function Celebration({ kind, value, onClose }: {
  kind: CelebKind; value?: number | string; onClose: () => void;
}) {
  const [reduced, setReduced] = useState(false);
  const [confettiVariant] = useState<ConfettiVariant>(() => pickVariant());
  const [title] = useState(() => titleFor(kind, value));
  const [sub] = useState(() => pick(CELEB_SUB[kind], `celebsub-${kind}`));

  const backdrop = useRef(new Animated.Value(0)).current;
  const spot = useRef(new Animated.Value(0)).current;
  const icon = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const closed = useRef(false);

  function close() {
    if (closed.current) return;
    closed.current = true;
    Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onClose());
  }

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduced(v));

    // haptic theo cường độ (§1.5)
    if (kind === "ticket" || kind === "tier") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    // âm "ting!" (§1.6) — tôn trọng chế độ im lặng (không ép playsInSilentMode)
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/ting.wav"), { volume: 0.6, shouldPlay: false });
        if (!mounted) { sound.unloadAsync(); return; }
        soundRef.current = sound;
        setTimeout(() => sound.playAsync().catch(() => {}), 180);
      } catch {}
    })();

    Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    Animated.spring(spot, { toValue: 1, damping: 14, delay: 120, useNativeDriver: true }).start();
    Animated.spring(icon, { toValue: 1, damping: 11, delay: 240, useNativeDriver: true }).start();
    Animated.timing(text, { toValue: 1, duration: 420, delay: 360, useNativeDriver: true }).start();

    const t = setTimeout(close, AUTO_DISMISS_MS);
    return () => { mounted = false; clearTimeout(t); soundRef.current?.unloadAsync(); };
  }, []);

  const IconCmp = kind === "ticket" ? Ticket : kind === "tier" ? Trophy : kind === "streak" ? Fire : Star;
  // reduced-motion: mọi thứ chỉ fade — không scale/translate (§1.7)
  const spotStyle = reduced
    ? { opacity: spot }
    : { opacity: spot, transform: [{ scale: spot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };
  const iconStyle = reduced
    ? { opacity: icon }
    : { opacity: icon, transform: [{ translateY: icon.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] };
  const textStyle = reduced
    ? { opacity: text }
    : { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  return (
    <Animated.View style={[st.backdrop, { opacity: backdrop }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      <Animated.View style={[st.spot, spotStyle]} pointerEvents="none" />
      {!reduced && <Confetti variant={confettiVariant} />}
      <Animated.View style={[st.iconWrap, iconStyle]}>
        <IconCmp size={38} color="#5a3d00" />
      </Animated.View>
      <Animated.View style={[textStyle, { alignItems: "center" }]}>
        <Text style={st.title} accessibilityRole="header">{title}</Text>
        <Text style={st.sub}>{sub}</Text>
        <TouchableOpacity style={st.btn} onPress={close} accessibilityLabel="Đóng">
          <Text style={st.btnT}>Tuyệt vời!</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject, zIndex: 99, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(59,42,74,0.55)",
  },
  spot: {
    position: "absolute", width: 360, height: 360, borderRadius: 180,
    backgroundColor: "rgba(255,194,75,0.32)",
  },
  iconWrap: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: C.spot,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    shadowColor: "#F5A623", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  title: { fontSize: 27, fontFamily: F.displayX, color: "#FFF8F0", textAlign: "center", paddingHorizontal: 24 },
  sub: { fontSize: 13, fontFamily: F.med, color: "#F3E4CE", marginTop: 6, textAlign: "center" },
  btn: { marginTop: 22, backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  btnT: { color: "#fff", fontFamily: F.title, fontSize: 14 },
});
