import React from "react";
import { createRoot } from "react-dom/client";
import { App as AntApp, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import App from "./App";
import "./styles.css";

// Theme "Sân khấu ấm" phủ lên Ant Design: san hô làm primary, bo góc mềm, nền kem
const theme = {
  token: {
    colorPrimary: "#FF6B5B",
    colorInfo: "#FF6B5B",
    colorSuccess: "#3FB984",
    colorWarning: "#F5A623",
    colorTextBase: "#3B2A4A",
    colorBgLayout: "#F6EDE2",
    borderRadius: 10,
    fontFamily: "'Be Vietnam Pro', -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: { siderBg: "#3B2A4A", triggerBg: "#2E2239" },
    Menu: {
      darkItemBg: "#3B2A4A", darkItemSelectedBg: "rgba(255,107,91,0.22)",
      darkItemSelectedColor: "#fff", darkItemColor: "#C9BBD6",
    },
    Card: { borderRadiusLG: 14 },
  },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider theme={theme} locale={viVN}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
