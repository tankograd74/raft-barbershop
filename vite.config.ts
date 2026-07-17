import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site: https://<user>.github.io/raft-barbershop/
// For a custom domain or username.github.io root site, set VITE_BASE=/
const base = process.env.VITE_BASE || "/raft-barbershop/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
