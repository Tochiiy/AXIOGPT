import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/models": "http://localhost:9999",
      "/conversations": "http://localhost:9999",
      "/history": "http://localhost:9999",
      "/upload": "http://localhost:9999",
      "/chat": "http://localhost:9999",
    },
  },
});
