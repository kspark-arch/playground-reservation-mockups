import { defineConfig } from "vite";
import { resolve } from "node:path";

const port = Number(process.env.PORT) || 4173;

export default defineConfig({
  root: ".",
  publicDir: "public",
  appType: "mpa",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tests: resolve(__dirname, "tests.html")
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    strictPort: false
  },
  preview: {
    host: "0.0.0.0",
    port,
    strictPort: false
  }
});
