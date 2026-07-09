// McUp — widget streak kiểu Duolingo (WidgetKit).
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
    let xp: Int
    let isPro: Bool
}

func loadEntry(for date: Date) -> McUpEntry {
    let d = UserDefaults(suiteName: APP_GROUP)
    let streak = d?.integer(forKey: "streak") ?? 0
    let last = d?.string(forKey: "lastPracticeDay") ?? ""
    let energy = d?.integer(forKey: "energy") ?? 0
    let xp = d?.integer(forKey: "xp") ?? 0
    let isPro = d?.bool(forKey: "isPro") ?? false

    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    let practiced = (last == fmt.string(from: date))
    let hour = Calendar.current.component(.hour, from: date)
    return McUpEntry(date: date, streak: streak, practicedToday: practiced,
                     danger: !practiced && hour >= 20,
                     energy: energy, xp: xp, isPro: isPro)
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> McUpEntry {
        McUpEntry(date: Date(), streak: 3, practicedToday: true, danger: false,
                  energy: 30, xp: 120, isPro: false)
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

struct FlameView: View {
    let practiced: Bool
    let size: CGFloat
    var body: some View {
        Text("🔥")
            .font(.system(size: size))
            .saturation(practiced ? 1 : 0)      // chưa luyện → lửa xám
            .opacity(practiced ? 1 : 0.55)
    }
}

struct SmallView: View {
    let entry: McUpEntry
    var body: some View {
        VStack(spacing: 2) {
            FlameView(practiced: entry.practicedToday, size: 34)
            Text("\(entry.streak)")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundColor(entry.danger ? .white : Color("plum"))
            Text(statusLine)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(entry.danger ? .white.opacity(0.95) : Color("inkSoft"))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
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
                FlameView(practiced: entry.practicedToday, size: 40)
                Text("\(entry.streak)")
                    .font(.system(size: 34, weight: .heavy, design: .rounded))
                    .foregroundColor(entry.danger ? .white : Color("plum"))
                Text("ngày liên tiếp")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(entry.danger ? .white.opacity(0.95) : Color("inkSoft"))
            }
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 10) {
                Text(entry.danger ? "Lửa sắp tắt — vào luyện 1 bài nhé!"
                     : entry.practicedToday ? "Hôm nay xong rồi, đỉnh! 🎤"
                     : "Chưa luyện hôm nay — giữ lửa nào!")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(entry.danger ? .white : Color("plum"))
                    .lineLimit(2)
                HStack(spacing: 5) {
                    Text("⚡").font(.system(size: 13))
                    Text(entry.isPro ? "∞" : "\(entry.energy)")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundColor(entry.danger ? .white : Color("coral"))
                    Text("·").foregroundColor(Color("inkSoft"))
                    Text("⭐ \(entry.xp) XP")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
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
