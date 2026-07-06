import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Build vào api/app/web/admin-dist → FastAPI serve same-origin tại /admin-web
export default defineConfig({
  plugins: [react()],
  base: "/admin-web/",
  build: { outDir: "../api/app/web/admin-dist", emptyOutDir: true },
  server: {
    proxy: {
      "/auth": "http://localhost:8000",
      "/admin": "http://localhost:8000",
    },
  },
});
