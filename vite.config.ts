import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `npm run build:preview` builds with relative asset paths and hash routing so
// the app can run from any folder or inside an embedded preview.
// `npm run build` also makes the server renderer (dist-ssr/entry-server.mjs), which the API
// server uses to send search engines fully rendered pages. It bundles every dependency so
// the server needs nothing extra installed.
export default defineConfig(({ mode, isSsrBuild }) => ({
  base: mode === "preview" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  ssr: { noExternal: true },
  build: isSsrBuild
    ? {
        outDir: "dist-ssr",
        copyPublicDir: false,
        rollupOptions: { output: { format: "es", entryFileNames: "[name].mjs", chunkFileNames: "chunks/[name]-[hash].mjs" } },
      }
    : {
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
