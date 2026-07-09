/** @type {import('@bacons/apple-targets/app.plugin').Config} */
// Widget màn hình chính (streak 🔥 kiểu Duolingo) — xem _bmad-output/planning-artifacts/widget-plan-2026-07-09.md
module.exports = {
  type: "widget",
  name: "McUpWidget",
  bundleIdentifier: "vn.mcup.app.widget",
  deploymentTarget: "17.0",
  colors: {
    $widgetBackground: "#FFF8F0",
    $accent: "#FF6B5B",
    // Bảng màu "Sân khấu ấm" — dùng trong SwiftUI qua Color("...")
    cream: "#FFF8F0",
    coral: "#FF6B5B",
    gold: "#FFC24B",
    plum: "#3B2A4A",
    inkSoft: "#8A7A6E",
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.vn.mcup.app"],
  },
};
