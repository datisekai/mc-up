// Mentors.tsx — danh sách MC hợp tác (feedback #5). Mục tiêu: cho học viên thấy
// "app có MC xịn" → nền cho Marketplace (đặt khoá 1:1, quảng cáo — feedback #7).
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { C, F } from "./theme";
import { Mic, Star, Trophy } from "./icons";

export type Mentor = {
  id: string; name: string; title?: string | null; bio?: string | null;
  featured: boolean; specialties: string[]; reviews: number;
};

export default function Mentors({ mentors, refreshControl }: { mentors: Mentor[]; refreshControl?: any }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} refreshControl={refreshControl}>
      <Text style={st.kicker}>MC ĐỒNG HÀNH CÙNG BẠN</Text>
      <Text style={st.sub}>Những người thật, nghề thật — sẽ nghe bạn dẫn khi bạn gửi Vé Vàng.</Text>

      {mentors.length === 0 && <Text style={st.empty}>Đang cập nhật danh sách MC…</Text>}

      {mentors.map((m) => (
        <View key={m.id} style={[st.card, m.featured && st.featured]}>
          {m.featured && (
            <View style={st.badge}><Star size={11} color="#5a3d00" /><Text style={st.badgeT}>MC nổi bật</Text></View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={st.avatar}><Text style={st.avatarT}>{(m.name || "M").replace(/^MC /, "")[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{m.name}</Text>
              {m.title ? <Text style={st.title}>{m.title}</Text> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Trophy size={12} color="#F5A623" />
                <Text style={st.reviews}>{m.reviews} nhận xét đã gửi</Text>
              </View>
            </View>
          </View>
          {m.bio ? <Text style={st.bio}>{m.bio}</Text> : null}
          {m.specialties.length > 0 && (
            <View style={st.tags}>
              {m.specialties.map((sp, i) => <View key={i} style={st.tag}><Text style={st.tagT}>{sp}</Text></View>)}
            </View>
          )}
          {/* Marketplace hook (feedback #7) — hiện "sắp có", nối booking/thanh toán sau (cụm dev-build) */}
          <TouchableOpacity style={st.cta} disabled>
            <Mic size={14} color={C.ink2} />
            <Text style={st.ctaT}>Đặt buổi 1:1 · sắp có</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  kicker: { fontSize: 11, fontFamily: F.title, letterSpacing: 1, color: C.ink2, textTransform: "uppercase" },
  sub: { fontSize: 13, color: C.ink2, fontFamily: F.body, marginTop: 4, marginBottom: 12, lineHeight: 19 },
  empty: { color: C.ink2, fontSize: 13, textAlign: "center", padding: 20 },
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 12 },
  featured: { borderWidth: 1.5, borderColor: C.spot },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: C.spot, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, marginBottom: 10 },
  badgeT: { fontSize: 10.5, fontFamily: F.title, color: "#5a3d00" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarT: { color: "#fff", fontFamily: F.displayX, fontSize: 20 },
  name: { fontFamily: F.title, fontSize: 16, color: C.ink },
  title: { fontSize: 12.5, color: C.ink2, fontFamily: F.body },
  reviews: { fontSize: 11.5, color: C.ink2, fontFamily: F.semi },
  bio: { fontSize: 13.5, color: C.ink, fontFamily: F.body, lineHeight: 20, marginTop: 10, fontStyle: "italic" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: C.sunken, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagT: { fontSize: 11.5, color: C.ink, fontFamily: F.semi },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.sunken, borderRadius: 999, padding: 11, marginTop: 12 },
  ctaT: { fontSize: 12.5, color: C.ink2, fontFamily: F.semi },
});
