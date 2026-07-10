import { defineConfig } from "vite";

// Relative base so the built bundle works whether it is hosted at a domain
// root (Vercel / Netlify) or under a sub-path (GitHub Pages: /blueline/).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    host: true,
    open: true,
  },
});
