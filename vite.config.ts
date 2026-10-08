import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `npm run build:preview` builds with relative asset paths and hash routing so
// the app can run from any folder or inside an embedded preview.
export default defineConfig(({ mode }) => ({
  base: mode === "preview" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
          if (id.includes("node_modules/react-router")) return "router";
        },
      },
    },
  },
}));
