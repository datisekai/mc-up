// Marketplace — đặt buổi 1:1 với MC (mô hình kinh doanh McUp).
// Học viên: xem dịch vụ → đặt → theo dõi lịch. MC: quản lý dịch vụ + booking đến.
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { C, F, shadow, T } from "./theme";
import { Btn3D } from "./ui";
import { FadeInUp, SkeletonList } from "./anim";
import { Api } from "./api";
import Misa from "./Misa";
import { Calendar, Check, Heart, Mic, Video, X } from "./icons";

const money = (v: number) => v.toLocaleString("vi-VN") + "đ";
const STATUS: Record<string, [string, string]> = {
  requested: ["Chờ MC xác nhận", "#B8860B"],
  confirmed: ["Đã xác nhận", "#1E7A52"],
  done: ["Đã hoàn thành", C.ink2],
  cancelled: ["Đã huỷ", "#B33724"],
};

// ===== HỌC VIÊN: chợ dịch vụ + đặt =====
export function MarketScreen({ token, onClose }: { token: string; onClose: () => void }) {
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [services, setServices] = useState<any[] | null>(null);
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [booking, setBooking] = useState<any>(null); // service đang đặt

  async function load() {
    try { setServices((await Api.services(token)).services); } catch {}
    try { setBookings((await Api.myBookings(token)).bookings); } catch {}
  }
  useEffect(() => { load(); }, []);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.base }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}><X size={22} color={C.ink} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: F.displayX, fontSize: 19, color: C.ink, marginRight: 26 }}>Học 1:1 với MC</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 6 }}>
          {[["browse", "Dịch vụ MC"], ["mine", `Lịch của tôi${bookings?.length ? ` (${bookings.length})` : ""}`]].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k as any)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 12, backgroundColor: tab === k ? C.ink : C.sunken }}>
              <Text style={{ fontFamily: F.title, fontSize: 13.5, color: tab === k ? "#fff" : C.ink2 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tab === "browse" ? (
            !services ? <SkeletonList rows={4} avatar={false} /> :
            services.length === 0 ? <Empty text="Chưa có dịch vụ nào — quay lại sau nhé!" /> :
            services.map((s, i) => (
              <FadeInUp key={s.id} delay={i * 50}><View style={card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {s.mode === "live" ? <Video size={18} color={C.primary} /> : <Mic size={18} color={C.primary} />}
                  <Text style={{ fontFamily: F.title, fontSize: 15.5, color: C.ink, flex: 1 }}>{s.title}</Text>
                </View>
                <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2, marginBottom: 6 }}>
                  {s.mc_name} · {s.mc_title}{s.duration_min ? ` · ${s.duration_min} phút` : " · nhận xét qua clip"}
                </Text>
                <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink, lineHeight: 20 }}>{s.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <Text style={{ fontFamily: F.displayX, fontSize: 18, color: C.primary }}>{money(s.price_vnd)}</Text>
                  <TouchableOpacity onPress={() => setBooking(s)}
                    style={{ backgroundColor: C.spot, borderRadius: 12, borderBottomWidth: 3, borderBottomColor: "#E09B18", paddingHorizontal: 18, paddingVertical: 9 }}>
                    <Text style={{ fontFamily: F.title, fontSize: 14, color: "#5a3d00" }}>Đặt buổi</Text>
                  </TouchableOpacity>
                </View>
              </View></FadeInUp>
            ))
          ) : (
            !bookings ? <SkeletonList rows={3} /> :
            bookings.length === 0 ? <Empty text="Bạn chưa đặt buổi nào. Chọn một MC để bắt đầu nhé!" /> :
            bookings.map((b) => <BookingCard key={b.id} b={b} token={token} isMc={false} onChange={load} />)
          )}
        </ScrollView>
      </View>

      {booking && <BookSheet token={token} service={booking} onClose={() => setBooking(null)} onDone={() => { setBooking(null); setTab("mine"); load(); }} />}
    </Modal>
  );
}

function BookSheet({ token, service, onClose, onDone }: { token: string; service: any; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [pref, setPref] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await Api.bookService(token, service.id, note, pref); onDone(); } catch {}
    setBusy(false);
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(59,42,74,0.4)", justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: C.base, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 }}>
          <Text style={{ fontFamily: F.displayX, fontSize: 20, color: C.ink }}>Đặt: {service.title}</Text>
          <Text style={{ fontFamily: F.med, fontSize: 13, color: C.ink2, marginTop: 2 }}>{service.mc_name} · {money(service.price_vnd)}</Text>
          <Text style={label}>Khung giờ bạn mong muốn</Text>
          <TextInput value={pref} onChangeText={setPref} placeholder="VD: tối T7 hoặc CN sáng" placeholderTextColor={C.ink2} style={input} />
          <Text style={label}>Lời nhắn cho MC (tuỳ chọn)</Text>
          <TextInput value={note} onChangeText={setNote} placeholder="Bạn muốn luyện điều gì?" placeholderTextColor={C.ink2} multiline style={[input, { height: 72, textAlignVertical: "top" }]} />
          <View style={{ backgroundColor: "#FFEFC9", borderRadius: 12, padding: 11, marginTop: 10 }}>
            <Text style={{ fontFamily: F.med, fontSize: 12.5, color: "#8a5a13" }}>Sau khi bạn gửi, MC sẽ xác nhận giờ + gửi link buổi học. Thanh toán trao đổi trực tiếp với MC.</Text>
          </View>
          <Btn3D kind="gold" loading={busy} label="Gửi yêu cầu đặt buổi" onPress={submit} />
          <Btn3D kind="white" label="Để sau" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function BookingCard({ b, token, isMc, onChange }: { b: any; token: string; isMc: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [rate, setRate] = useState(false);
  const [st, stColor] = STATUS[b.status] ?? ["", C.ink2];
  return (
    <View style={card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink, flex: 1 }}>{b.service_title}</Text>
        <View style={{ backgroundColor: stColor + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 11.5, color: stColor }}>{st}</Text>
        </View>
      </View>
      <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2, marginTop: 2 }}>
        {isMc ? "Học viên: " : "MC: "}{b.other_name} · {money(b.price_vnd)}
      </Text>
      {b.preferred ? <Text style={{ fontSize: 13, color: C.ink, marginTop: 6 }}>Mong muốn: {b.preferred}</Text> : null}
      {b.note ? <Text style={{ fontSize: 13, color: C.ink, marginTop: 2 }}>Lời nhắn: "{b.note}"</Text> : null}
      {b.scheduled_at ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Calendar size={16} color="#1E7A52" /><Text style={{ fontFamily: F.semi, fontSize: 13.5, color: "#1E7A52" }}>{b.scheduled_at}</Text>
        </View>
      ) : null}
      {b.meeting_link ? (
        <TouchableOpacity onPress={() => Linking.openURL(b.meeting_link)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Video size={16} color={C.primary} /><Text style={{ fontFamily: F.semi, fontSize: 13.5, color: C.primary, textDecorationLine: "underline" }}>Vào buổi học</Text>
        </TouchableOpacity>
      ) : null}

      {/* hành động */}
      {isMc && b.status === "requested" && <Btn3D kind="primary" small label="Xác nhận & gửi lịch" onPress={() => setConfirm(true)} />}
      {isMc && b.status === "confirmed" && <Btn3D kind="success" small label="Đánh dấu đã xong" onPress={async () => { setBusy(true); try { await Api.doneBooking(token, b.id); onChange(); } catch {} setBusy(false); }} />}
      {!isMc && b.status === "done" && !b.rating && <Btn3D kind="gold" small label="Đánh giá buổi học" onPress={() => setRate(true)} />}
      {!isMc && b.rating ? <Text style={{ marginTop: 8, color: "#B8860B", fontFamily: F.semi, fontSize: 13 }}>{"★".repeat(b.rating)} {b.review ? `· "${b.review}"` : ""}</Text> : null}
      {!isMc && (b.status === "requested" || b.status === "confirmed") && (
        <TouchableOpacity onPress={async () => { await Api.cancelBooking(token, b.id); onChange(); }}><Text style={{ color: C.ink2, fontSize: 12.5, textDecorationLine: "underline", marginTop: 8 }}>Huỷ đặt</Text></TouchableOpacity>
      )}

      {confirm && <ConfirmSheet token={token} bookingId={b.id} onClose={() => setConfirm(false)} onDone={() => { setConfirm(false); onChange(); }} />}
      {rate && <RateSheet token={token} bookingId={b.id} onClose={() => setRate(false)} onDone={() => { setRate(false); onChange(); }} />}
    </View>
  );
}

function ConfirmSheet({ token, bookingId, onClose, onDone }: any) {
  const [when, setWhen] = useState(""); const [link, setLink] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={onClose} title="Xác nhận buổi học">
      <Text style={label}>Thời gian đã chốt</Text>
      <TextInput value={when} onChangeText={setWhen} placeholder="VD: 20:00 T7 15/07" placeholderTextColor={C.ink2} style={input} />
      <Text style={label}>Link buổi học (Zoom/Meet)</Text>
      <TextInput value={link} onChangeText={setLink} placeholder="https://meet.google.com/..." placeholderTextColor={C.ink2} autoCapitalize="none" style={input} />
      <Btn3D kind="primary" loading={busy} label="Gửi cho học viên" onPress={async () => { if (!when) return; setBusy(true); try { await Api.confirmBooking(token, bookingId, when, link); onDone(); } catch {} setBusy(false); }} />
    </Sheet>
  );
}

function RateSheet({ token, bookingId, onClose, onDone }: any) {
  const [stars, setStars] = useState(5); const [rev, setRev] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={onClose} title="Đánh giá buổi học">
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => setStars(n)}><Text style={{ fontSize: 34, color: n <= stars ? "#F5B841" : C.hair }}>★</Text></TouchableOpacity>
        ))}
      </View>
      <TextInput value={rev} onChangeText={setRev} placeholder="Cảm nhận của bạn (tuỳ chọn)" placeholderTextColor={C.ink2} multiline style={[input, { height: 72, textAlignVertical: "top" }]} />
      <Btn3D kind="gold" loading={busy} label="Gửi đánh giá" onPress={async () => { setBusy(true); try { await Api.rateBooking(token, bookingId, stars, rev); onDone(); } catch {} setBusy(false); }} />
    </Sheet>
  );
}

// ===== MC: quản lý dịch vụ + booking =====
export function McMarketPanel({ token }: { token: string }) {
  const [tab, setTab] = useState<"bookings" | "services">("bookings");
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [services, setServices] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  async function load() {
    try { setBookings((await Api.mcBookings(token)).bookings); } catch {}
    try { setServices((await Api.mcServices(token)).services); } catch {}
  }
  useEffect(() => { load(); }, []);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {[["bookings", `Lượt đặt${bookings?.filter((b) => b.status === "requested").length ? ` · ${bookings.filter((b) => b.status === "requested").length} mới` : ""}`], ["services", "Dịch vụ của tôi"]].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k as any)} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: tab === k ? C.ink : C.sunken }}>
            <Text style={{ fontFamily: F.title, fontSize: 13, color: tab === k ? "#fff" : C.ink2 }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "bookings" ? (
        !bookings ? <SkeletonList rows={2} /> :
        bookings.length === 0 ? <Empty text="Chưa có ai đặt buổi. Thêm dịch vụ hấp dẫn để thu hút học viên nhé!" /> :
        bookings.map((b) => <BookingCard key={b.id} b={b} token={token} isMc onChange={load} />)
      ) : (
        <>
          {services?.map((s) => (
            <TouchableOpacity key={s.id} style={card} onPress={() => setEdit(s)}>
              <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink }}>{s.title}</Text>
              <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2, marginTop: 2 }}>{s.mode === "live" ? "Gọi video" : "Nhận xét clip"} · {money(s.price_vnd)}</Text>
            </TouchableOpacity>
          ))}
          <Btn3D kind="primary" label="+ Thêm dịch vụ" onPress={() => setEdit({ title: "", description: "", mode: "live", duration_min: 30, price_vnd: 0, active: true })} />
        </>
      )}
      {edit && <ServiceEditor token={token} svc={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
    </View>
  );
}

function ServiceEditor({ token, svc, onClose, onDone }: any) {
  const [f, setF] = useState({ ...svc });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((o: any) => ({ ...o, [k]: v }));
  return (
    <Sheet onClose={onClose} title={svc.id ? "Sửa dịch vụ" : "Dịch vụ mới"}>
      <Text style={label}>Tên dịch vụ</Text>
      <TextInput value={f.title} onChangeText={(v) => set("title", v)} placeholder="VD: Coaching dẫn cưới 1:1" placeholderTextColor={C.ink2} style={input} />
      <Text style={label}>Mô tả</Text>
      <TextInput value={f.description} onChangeText={(v) => set("description", v)} placeholder="Buổi học gồm những gì?" placeholderTextColor={C.ink2} multiline style={[input, { height: 66, textAlignVertical: "top" }]} />
      <Text style={label}>Hình thức</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[["live", "Gọi video"], ["async", "Nhận xét clip"]].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => set("mode", k)} style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, backgroundColor: f.mode === k ? C.primary : C.sunken }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: f.mode === k ? "#fff" : C.ink2 }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={label}>Thời lượng (phút)</Text>
          <TextInput value={String(f.duration_min)} onChangeText={(v) => set("duration_min", parseInt(v) || 0)} keyboardType="number-pad" style={input} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={label}>Giá (VND)</Text>
          <TextInput value={String(f.price_vnd)} onChangeText={(v) => set("price_vnd", parseInt(v) || 0)} keyboardType="number-pad" style={input} />
        </View>
      </View>
      <Btn3D kind="primary" loading={busy} label="Lưu dịch vụ" onPress={async () => { if (!f.title) return; setBusy(true); try { await Api.saveService(token, f); onDone(); } catch {} setBusy(false); }} />
    </Sheet>
  );
}

// ===== helpers =====
function Sheet({ title, children, onClose }: any) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(59,42,74,0.4)", justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: C.base, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 }}>
          <Text style={{ fontFamily: F.displayX, fontSize: 20, color: C.ink, marginBottom: 4 }}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 30 }}>
      <Misa mood="chao" size={90} />
      <Text style={{ color: C.ink2, fontSize: 13.5, textAlign: "center", marginTop: 8, paddingHorizontal: 24 }}>{text}</Text>
    </View>
  );
}
const card: any = { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10, ...shadow.card };
const label: any = { fontFamily: F.semi, fontSize: 12.5, color: C.ink2, marginTop: 12, marginBottom: 4 };
const input: any = { backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.hair, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, fontFamily: F.body };
