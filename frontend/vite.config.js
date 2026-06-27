import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/models": "http://localhost:8000",
      "/conversations": "http://localhost:8000",
      "/history": "http://localhost:8000",
      "/upload": "http://localhost:8000",
      "/chat": "http://localhost:8000",
    },
  },
});
