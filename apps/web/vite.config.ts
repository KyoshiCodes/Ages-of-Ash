/** Development same-origin proxy and lean static production build. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  root: "apps/web",
  plugins: [react(), tailwind()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/live": { target: "ws://127.0.0.1:3000", ws: true },
    },
  },
  build: { manifest: true, outDir: "../../dist/web", emptyOutDir: true },
});
