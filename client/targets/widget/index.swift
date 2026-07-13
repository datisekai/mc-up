// McUp — widget streak (WidgetKit).
// Data do app ghi vào App Group (ExtensionStorage) mỗi lần refresh tiến độ:
//   streak (Int) · lastPracticeDay ("yyyy-MM-dd", set khi ĐÃ luyện hôm đó)
//   energy (Int) · xp (Int) · isPro (Bool)
// Trạng thái tự đổi theo GIỜ (không cần mở app): đã luyện / chưa luyện / sau 20h chưa luyện.
import SwiftUI
import WidgetKit

let APP_GROUP = "group.vn.mcup.app"

struct McUpEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let practicedToday: Bool
    let danger: Bool // sau 20h mà chưa luyện → lửa sắp tắt
    let energy: Int
    let energyMax: Int
    let xp: Int
    let isPro: Bool
    let week: [Bool]        // 7 ngày gần nhất (cũ → hôm nay) có luyện không
    let weekLabels: [String] // nhãn thứ: T2..CN theo đúng ngày
}

func loadEntry(for date: Date) -> McUpEntry {
    let d = UserDefaults(suiteName: APP_GROUP)
    let streak = d?.integer(forKey: "streak") ?? 0
    let last = d?.string(forKey: "lastPracticeDay") ?? ""
    let energy = d?.integer(forKey: "energy") ?? 0
    let energyMax = max(1, d?.integer(forKey: "energyMax") ?? 30)
    let xp = d?.integer(forKey: "xp") ?? 0
    let isPro = d?.bool(forKey: "isPro") ?? false
    // lịch sử ngày luyện (app ghi JSON ["yyyy-MM-dd", ...])
    var days = Set<String>()
    if let raw = d?.string(forKey: "practicedDays"),
       let arr = try? JSONDecoder().decode([String].self, from: Data(raw.utf8)) {
        days = Set(arr)
    }

    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    let todayStr = fmt.string(from: date)
    let practiced = (last == todayStr) || days.contains(todayStr)
    let hour = Calendar.current.component(.hour, from: date)

    // 7 chấm tuần: 6 ngày trước → hôm nay
    let cal = Calendar.current
    var week: [Bool] = []
    var labels: [String] = []
    let thu = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    for off in stride(from: -6, through: 0, by: 1) {
        let day = cal.date(byAdding: .day, value: off, to: date) ?? date
        let ds = fmt.string(from: day)
        week.append(days.contains(ds) || (off == 0 && practiced))
        labels.append(thu[cal.component(.weekday, from: day) - 1])
    }
    return McUpEntry(date: date, streak: streak, practicedToday: practiced,
                     danger: !practiced && hour >= 20,
                     energy: energy, energyMax: energyMax, xp: xp, isPro: isPro,
                     week: week, weekLabels: labels)
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> McUpEntry {
        McUpEntry(date: Date(), streak: 3, practicedToday: true, danger: false,
                  energy: 30, energyMax: 30, xp: 120, isPro: false,
                  week: [false, true, true, false, true, true, true],
                  weekLabels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"])
    }

    func getSnapshot(in context: Context, completion: @escaping (McUpEntry) -> Void) {
        completion(loadEntry(for: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<McUpEntry>) -> Void) {
        // Entry mỗi giờ trong 36h tới: widget tự chuyển "sau 20h" + reset qua nửa đêm
        // kể cả khi user không mở app. App mở → reloadAllTimelines ghi đè bằng data mới.
        var entries: [McUpEntry] = [loadEntry(for: Date())]
        let cal = Calendar.current
        let nextHour = cal.date(bySetting: .minute, value: 0, of: Date().addingTimeInterval(3600))
            ?? Date().addingTimeInterval(3600)
        for i in 0..<36 {
            entries.append(loadEntry(for: nextHour.addingTimeInterval(Double(i) * 3600)))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// ===== Views =====

// Miệng cong — up=true là cười, false là lo
struct MouthShape: Shape {
    var happy: Bool
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: happy ? r.minY : r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: happy ? r.minY : r.maxY),
                       control: CGPoint(x: r.midX, y: happy ? r.maxY : r.minY))
        return p
    }
}

// Misa — mascot McUp (bản SwiftUI rút gọn cho widget, đồng bộ client/src/Misa.tsx)
struct MisaView: View {
    let mood: String        // "vui" | "covu" | "lo"
    var onCoral: Bool = false   // nền coral (danger) → viền trắng cho nổi
    var size: CGFloat = 46
    var body: some View {
        let k = size / 46
        let line: Color = onCoral ? .white : Color("plum")
        ZStack {
            RoundedRectangle(cornerRadius: 6 * k)
                .fill(line)
                .frame(width: 13 * k, height: 24 * k)
                .offset(y: 17 * k)
            Circle()
                .fill(Color("coral"))
                .overlay(Circle().stroke(line, lineWidth: 2.8 * k))
                .frame(width: 34 * k, height: 34 * k)
                .offset(y: -5 * k)
            // mắt
            HStack(spacing: 7 * k) {
                eye(k: k); eye(k: k)
            }.offset(y: -8 * k)
            // miệng
            MouthShape(happy: mood != "lo")
                .stroke(line, lineWidth: 2.4 * k)
                .frame(width: 12 * k, height: 5 * k)
                .offset(y: 2.5 * k)
        }
        .frame(width: 46 * k, height: 64 * k)
    }
    func eye(k: CGFloat) -> some View {
        ZStack {
            Circle().fill(.white).frame(width: 8.4 * k, height: 8.4 * k)
            Circle().fill(Color("plum")).frame(width: 4.4 * k, height: 4.4 * k).offset(x: 0.8 * k, y: 0.8 * k)
        }
    }
}

// 7 chấm tuần — chấm đầy = ngày có luyện, hôm nay có viền
struct WeekDots: View {
    let week: [Bool]
    let labels: [String]
    var onCoral: Bool = false
    var showLabels: Bool = false
    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<week.count, id: \.self) { i in
                VStack(spacing: 2) {
                    if showLabels {
                        Text(labels[i]).font(.system(size: 8, weight: .semibold, design: .rounded))
                            .foregroundColor(onCoral ? .white.opacity(0.85) : Color("inkSoft"))
                    }
                    Circle()
                        .fill(week[i] ? (onCoral ? Color.white : Color("gold")) : (onCoral ? Color.white.opacity(0.25) : Color("inkSoft").opacity(0.22)))
                        .frame(width: 8, height: 8)
                        .overlay(Circle().stroke(i == week.count - 1 ? (onCoral ? Color.white : Color("coral")) : Color.clear, lineWidth: 1.6).frame(width: 12, height: 12))
                }
            }
        }
    }
}

// thanh năng lượng vẽ shape (không emoji)
struct EnergyBar: View {
    let value: Int
    let max: Int
    let isPro: Bool
    var onCoral: Bool = false
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(onCoral ? .white : Color("gold"))
            if isPro {
                Text("∞").font(.system(size: 14, weight: .heavy, design: .rounded))
                    .foregroundColor(onCoral ? .white : Color("coral"))
            } else {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(onCoral ? Color.white.opacity(0.3) : Color("inkSoft").opacity(0.2))
                        Capsule().fill(onCoral ? Color.white : Color("gold"))
                            .frame(width: geo.size.width * CGFloat(value) / CGFloat(max))
                    }
                }
                .frame(height: 7)
                Text("\(value)").font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(onCoral ? .white : Color("plum"))
            }
        }
    }
}

struct SmallView: View {
    let entry: McUpEntry
    var body: some View {
        VStack(spacing: 2) {
            MisaView(mood: entry.danger ? "lo" : entry.practicedToday ? "vui" : "covu",
                     onCoral: entry.danger, size: 38)
            Text("\(entry.streak)")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundColor(entry.danger ? .white : Color("plum"))
            Text(statusLine)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(entry.danger ? .white.opacity(0.95) : Color("inkSoft"))
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            WeekDots(week: entry.week, labels: entry.weekLabels, onCoral: entry.danger)
                .padding(.top, 2)
        }
    }
    var statusLine: String {
        if entry.danger { return "Lửa sắp tắt!" }
        if entry.practicedToday { return "Đỉnh! Mai gặp lại" }
        return "Giữ lửa nào!"
    }
}

struct MediumView: View {
    let entry: McUpEntry
    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 0) {
                MisaView(mood: entry.danger ? "lo" : entry.practicedToday ? "vui" : "covu",
                         onCoral: entry.danger, size: 44)
                Text("\(entry.streak)")
                    .font(.system(size: 34, weight: .heavy, design: .rounded))
                    .foregroundColor(entry.danger ? .white : Color("plum"))
                Text("ngày liên tiếp")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(entry.danger ? .white.opacity(0.95) : Color("inkSoft"))
            }
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 8) {
                Text(entry.danger ? "Lửa sắp tắt — vào luyện 1 bài nhé!"
                     : entry.practicedToday ? "Hôm nay xong rồi, đỉnh!"
                     : "Chưa luyện hôm nay — giữ lửa nào!")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(entry.danger ? .white : Color("plum"))
                    .lineLimit(2)
                WeekDots(week: entry.week, labels: entry.weekLabels, onCoral: entry.danger, showLabels: true)
                EnergyBar(value: entry.energy, max: entry.energyMax, isPro: entry.isPro, onCoral: entry.danger)
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(entry.danger ? .white : Color("gold"))
                    Text("\(entry.xp) XP")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(entry.danger ? .white.opacity(0.95) : Color("inkSoft"))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct McUpWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: McUpEntry

    var body: some View {
        Group {
            if family == .systemMedium { MediumView(entry: entry) }
            else { SmallView(entry: entry) }
        }
        .containerBackground(for: .widget) {
            entry.danger ? Color("coral") : Color("cream")
        }
        .widgetURL(URL(string: "mcup://"))
    }
}

struct McUpWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "McUpWidget", provider: Provider()) { entry in
            McUpWidgetView(entry: entry)
        }
        .configurationDisplayName("Chuỗi ngày luyện")
        .description("Giữ lửa luyện nói mỗi ngày 🔥")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct McUpWidgetBundle: WidgetBundle {
    var body: some Widget {
        McUpWidget()
    }
}
